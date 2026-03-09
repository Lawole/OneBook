// ============================================
// routes/invoice.js - Invoice Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// Get all invoices
router.get('/', authMiddleware, async (req, res) => {
  const { search, status, page = 1, per_page = 10 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    let query = `
      SELECT i.*, c.name as customer_name, cur.code as currency_code, cur.symbol as currency_symbol
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN currencies cur ON i.currency_id = cur.id
      WHERE i.company_id = $1
    `;
    let params = [req.companyId];

    if (search) {
      query += ` AND (i.invoice_number ILIKE $${params.length + 1} OR c.name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (status) {
      query += ` AND i.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(per_page, offset);

    const result = await pool.query(query, params);

    // Get invoice items for each invoice
    for (let invoice of result.rows) {
      const itemsResult = await pool.query(
        `SELECT ii.*, i.name as item_name 
         FROM invoice_items ii
         LEFT JOIN items i ON ii.item_id = i.id
         WHERE ii.invoice_id = $1`,
        [invoice.id]
      );
      invoice.items = itemsResult.rows.map(item => ({
        id: item.id,
        item_id: item.item_id,
        item_name: item.item_name,
        description: item.description,
        quantity: item.quantity,
        unit_price: parseFloat(item.unit_price),
        line_total: parseFloat(item.line_total)
      }));
    }

    const countQuery = `SELECT COUNT(*) FROM invoices WHERE company_id = $1`;
    const countResult = await pool.query(countQuery, [req.companyId]);

    res.json({
      invoices: result.rows.map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_id: inv.customer_id,
        customer_name: inv.customer_name,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        subtotal: parseFloat(inv.subtotal),
        tax_amount: parseFloat(inv.tax_amount),
        total_amount: parseFloat(inv.total_amount),
        amount: parseFloat(inv.total_amount),
        currency_id: inv.currency_id,
        currency_code: inv.currency_code,
        notes: inv.notes,
        status: inv.status,
        items: inv.items,
        created_at: inv.created_at,
        updated_at: inv.updated_at
      })),
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(countResult.rows[0].count / per_page),
      current_page: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
});

// Create invoice
router.post('/', authMiddleware, async (req, res) => {
  const { customer_id, invoice_date, due_date, currency_id, notes, items, tax_rate } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate invoice number
    const lastInvoiceResult = await client.query(
      `SELECT invoice_number FROM invoices WHERE company_id = $1 ORDER BY id DESC LIMIT 1`,
      [req.companyId]
    );

    let invoice_number;
    if (lastInvoiceResult.rows.length > 0) {
      const lastNumber = parseInt(lastInvoiceResult.rows[0].invoice_number.split('-')[1]);
      invoice_number = `INV-${String(lastNumber + 1).padStart(4, '0')}`;
    } else {
      invoice_number = 'INV-0001';
    }

    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.quantity * item.unit_price;
    });

    const tax_amount = subtotal * ((tax_rate || 0) / 100);
    const total_amount = subtotal + tax_amount;

    // Create invoice
    const invoiceResult = await client.query(
      `INSERT INTO invoices (company_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, currency_id, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
      [req.companyId, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, currency_id, notes, 'draft']
    );

    const invoice = invoiceResult.rows[0];

    // Create invoice items and update inventory (FIFO)
    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, item.item_id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );

      // Update inventory using FIFO
      if (item.item_id) {
        await updateInventoryFIFO(client, item.item_id, item.quantity, invoice.id);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Invoice created successfully',
      invoice: invoice
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error creating invoice', error: error.message });
  } finally {
    client.release();
  }
});

// Generate invoice PDF
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    // Get invoice with all details
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name as customer_name, c.company_name as customer_company, 
              c.address as customer_address, c.email as customer_email,
              cur.code as currency_code, cur.symbol as currency_symbol,
              comp.name as company_name, comp.address as company_address,
              comp.phone as company_phone, comp.email as company_email
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN currencies cur ON i.currency_id = cur.id
       LEFT JOIN companies comp ON i.company_id = comp.id
       WHERE i.id = $1 AND i.company_id = $2`,
      [req.params.id, req.companyId]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    // Get invoice items
    const itemsResult = await pool.query(
      `SELECT ii.*, i.name as item_name 
       FROM invoice_items ii
       LEFT JOIN items i ON ii.item_id = i.id
       WHERE ii.invoice_id = $1`,
      [invoice.id]
    );

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoice_number}.pdf`);
    
    doc.pipe(res);

    // Company header
    doc.fontSize(20).text(invoice.company_name, 50, 50);
    doc.fontSize(10).text(invoice.company_address || '', 50, 75);
    doc.text(invoice.company_phone || '', 50, 90);
    doc.text(invoice.company_email || '', 50, 105);

    // Invoice title
    doc.fontSize(25).text('INVOICE', 400, 50);
    doc.fontSize(12).text(`#${invoice.invoice_number}`, 400, 80);

    // Customer info
    doc.fontSize(12).text('Bill To:', 50, 150);
    doc.fontSize(10).text(invoice.customer_name, 50, 170);
    if (invoice.customer_company) doc.text(invoice.customer_company, 50, 185);
    if (invoice.customer_address) doc.text(invoice.customer_address, 50, 200);
    if (invoice.customer_email) doc.text(invoice.customer_email, 50, 215);

    // Invoice dates
    doc.fontSize(10).text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, 400, 150);
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 400, 165);

    // Table header
    const tableTop = 280;
    doc.fontSize(10);
    doc.text('Description', 50, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Price', 370, tableTop);
    doc.text('Total', 470, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    let y = tableTop + 25;
    const symbol = invoice.currency_symbol || '$';

    itemsResult.rows.forEach(item => {
      doc.text(item.description, 50, y);
      doc.text(item.quantity.toString(), 300, y);
      doc.text(`${symbol}${parseFloat(item.unit_price).toFixed(2)}`, 370, y);
      doc.text(`${symbol}${parseFloat(item.line_total).toFixed(2)}`, 470, y);
      y += 25;
    });

    // Totals
    y += 20;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    
    y += 15;
    doc.text('Subtotal:', 370, y);
    doc.text(`${symbol}${parseFloat(invoice.subtotal).toFixed(2)}`, 470, y);

    if (invoice.tax_amount > 0) {
      y += 20;
      doc.text('Tax:', 370, y);
      doc.text(`${symbol}${parseFloat(invoice.tax_amount).toFixed(2)}`, 470, y);
    }

    y += 20;
    doc.fontSize(12).text('Total:', 370, y);
    doc.text(`${symbol}${parseFloat(invoice.total_amount).toFixed(2)}`, 470, y);

    // Notes
    if (invoice.notes) {
      doc.fontSize(10).text('Notes:', 50, y + 50);
      doc.text(invoice.notes, 50, y + 65, { width: 500 });
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Error generating PDF', error: error.message });
  }
});

// Update invoice (status only OR full edit)
router.put('/:id', authMiddleware, async (req, res) => {
  const { status, customer_id, invoice_date, due_date, notes, items } = req.body;

  // Status-only update
  if (status && !items) {
    const allowed = ['draft', 'sent', 'paid', 'overdue', 'unpaid'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    try {
      await pool.query(
        `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3`,
        [status, req.params.id, req.companyId]
      );
      return res.json({ message: 'Status updated' });
    } catch (error) {
      return res.status(500).json({ message: 'Error updating status', error: error.message });
    }
  }

  // Full invoice edit
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let subtotal = 0;
    (items || []).forEach(item => { subtotal += item.quantity * item.unit_price; });
    const total_amount = subtotal;

    await client.query(
      `UPDATE invoices SET customer_id=$1, invoice_date=$2, due_date=$3, notes=$4,
       subtotal=$5, tax_amount=0, total_amount=$6, updated_at=NOW()
       WHERE id=$7 AND company_id=$8`,
      [customer_id, invoice_date, due_date, notes, subtotal, total_amount, req.params.id, req.companyId]
    );

    // Replace line items
    await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [req.params.id]);
    for (const item of (items || [])) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.params.id, item.item_id || null, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Invoice updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error updating invoice', error: error.message });
  } finally {
    client.release();
  }
});

// Delete invoice
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM invoices WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId]
    );

    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice', error: error.message });
  }
});

// FIFO Inventory Update Function
async function updateInventoryFIFO(client, item_id, quantity_sold, invoice_id) {
  let remaining = quantity_sold;

  // Get available stock movements (FIFO)
  const movements = await client.query(
    `SELECT * FROM stock_movements 
     WHERE item_id = $1 AND movement_type = 'IN' AND remaining_quantity > 0
     ORDER BY movement_date ASC`,
    [item_id]
  );

  for (const movement of movements.rows) {
    if (remaining <= 0) break;

    const qty_to_use = Math.min(movement.remaining_quantity, remaining);

    // Create OUT movement
    await client.query(
      `INSERT INTO stock_movements (item_id, movement_type, quantity, unit_cost, reference_type, reference_id, movement_date, remaining_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0)`,
      [item_id, 'OUT', qty_to_use, movement.unit_cost, 'INVOICE', invoice_id]
    );

    // Update remaining quantity
    await client.query(
      `UPDATE stock_movements SET remaining_quantity = remaining_quantity - $1 WHERE id = $2`,
      [qty_to_use, movement.id]
    );

    remaining -= qty_to_use;
  }

  // Update item quantity
  await client.query(
    `UPDATE items SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW() WHERE id = $2`,
    [quantity_sold, item_id]
  );
}

module.exports = router;