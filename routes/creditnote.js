// ============================================
// routes/creditNote.js - Credit Note Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// Get all credit notes
router.get('/', authMiddleware, async (req, res) => {
  const { page = 1, per_page = 10 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    const result = await pool.query(
      `SELECT cn.*, c.name as customer_name, i.invoice_number, cur.code as currency_code
       FROM credit_notes cn
       LEFT JOIN customers c ON cn.customer_id = c.id
       LEFT JOIN invoices i ON cn.invoice_id = i.id
       LEFT JOIN currencies cur ON cn.currency_id = cur.id
       WHERE cn.company_id = $1
       ORDER BY cn.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.companyId, per_page, offset]
    );

    // Get credit note items
    for (let cn of result.rows) {
      const itemsResult = await pool.query(
        `SELECT * FROM credit_note_items WHERE credit_note_id = $1`,
        [cn.id]
      );
      cn.items = itemsResult.rows;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM credit_notes WHERE company_id = $1`,
      [req.companyId]
    );

    res.json({
      credit_notes: result.rows.map(cn => ({
        id: cn.id,
        credit_note_number: cn.credit_note_number,
        customer_id: cn.customer_id,
        customer_name: cn.customer_name,
        invoice_id: cn.invoice_id,
        invoice_number: cn.invoice_number,
        credit_date: cn.credit_date,
        subtotal: parseFloat(cn.subtotal),
        tax_amount: parseFloat(cn.tax_amount),
        total_amount: parseFloat(cn.total_amount),
        currency_id: cn.currency_id,
        currency_code: cn.currency_code,
        reason: cn.reason,
        status: cn.status,
        items: cn.items.map(item => ({
          id: item.id,
          item_id: item.item_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
          line_total: parseFloat(item.line_total)
        })),
        created_at: cn.created_at,
        updated_at: cn.updated_at
      })),
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(countResult.rows[0].count / per_page),
      current_page: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching credit notes', error: error.message });
  }
});

// Create credit note
router.post('/', authMiddleware, async (req, res) => {
  const { customer_id, invoice_id, credit_date, currency_id, reason, items, tax_rate } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate credit note number - use MAX to avoid duplicates from deleted records or race conditions
    const maxResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(credit_note_number, '-', 2) AS INTEGER)), 0) as max_num
       FROM credit_notes WHERE company_id = $1 AND credit_note_number ~ '^CN-[0-9]+$'`,
      [req.companyId]
    );
    const credit_note_number = `CN-${String(maxResult.rows[0].max_num + 1).padStart(4, '0')}`;

    // Calculate totals
    let subtotal = 0;
    items.forEach(item => {
      subtotal += item.quantity * item.unit_price;
    });

    const tax_amount = subtotal * ((tax_rate || 0) / 100);
    const total_amount = subtotal + tax_amount;

    // Create credit note
    const cnResult = await client.query(
      `INSERT INTO credit_notes (company_id, customer_id, invoice_id, credit_note_number, credit_date, subtotal, tax_amount, total_amount, currency_id, reason, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
      [req.companyId, customer_id, invoice_id, credit_note_number, credit_date, subtotal, tax_amount, total_amount, currency_id, reason, 'draft']
    );

    const creditNote = cnResult.rows[0];

    // Create credit note items
    for (const item of items) {
      await client.query(
        `INSERT INTO credit_note_items (credit_note_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [creditNote.id, item.item_id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Credit note created successfully',
      credit_note: creditNote
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error creating credit note', error: error.message });
  } finally {
    client.release();
  }
});

// Generate credit note PDF
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const cnResult = await pool.query(
      `SELECT cn.*, c.name as customer_name, c.company_name as customer_company, 
              c.address as customer_address, cur.symbol as currency_symbol,
              comp.name as company_name, comp.address as company_address,
              comp.phone as company_phone, comp.email as company_email,
              i.invoice_number
       FROM credit_notes cn
       LEFT JOIN customers c ON cn.customer_id = c.id
       LEFT JOIN currencies cur ON cn.currency_id = cur.id
       LEFT JOIN companies comp ON cn.company_id = comp.id
       LEFT JOIN invoices i ON cn.invoice_id = i.id
       WHERE cn.id = $1 AND cn.company_id = $2`,
      [req.params.id, req.companyId]
    );

    if (cnResult.rows.length === 0) {
      return res.status(404).json({ message: 'Credit note not found' });
    }

    const cn = cnResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT * FROM credit_note_items WHERE credit_note_id = $1`,
      [cn.id]
    );

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=credit_note_${cn.credit_note_number}.pdf`);
    
    doc.pipe(res);

    // Company header
    doc.fontSize(20).text(cn.company_name, 50, 50);
    doc.fontSize(10).text(cn.company_address || '', 50, 75);
    doc.text(cn.company_phone || '', 50, 90);
    doc.text(cn.company_email || '', 50, 105);

    // Credit Note title
    doc.fontSize(25).fillColor('red').text('CREDIT NOTE', 350, 50);
    doc.fillColor('black').fontSize(12).text(`#${cn.credit_note_number}`, 400, 80);

    // Customer info
    doc.fontSize(12).text('Credit To:', 50, 150);
    doc.fontSize(10).text(cn.customer_name, 50, 170);
    if (cn.customer_company) doc.text(cn.customer_company, 50, 185);
    if (cn.customer_address) doc.text(cn.customer_address, 50, 200);

    // Credit note details
    doc.fontSize(10).text(`Date: ${new Date(cn.credit_date).toLocaleDateString()}`, 400, 150);
    if (cn.invoice_number) doc.text(`Ref Invoice: ${cn.invoice_number}`, 400, 165);

    // Table
    const tableTop = 280;
    doc.fontSize(10);
    doc.text('Description', 50, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Price', 370, tableTop);
    doc.text('Total', 470, tableTop);

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    let y = tableTop + 25;
    const symbol = cn.currency_symbol || '$';

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
    doc.text(`${symbol}${parseFloat(cn.subtotal).toFixed(2)}`, 470, y);

    if (cn.tax_amount > 0) {
      y += 20;
      doc.text('Tax:', 370, y);
      doc.text(`${symbol}${parseFloat(cn.tax_amount).toFixed(2)}`, 470, y);
    }

    y += 20;
    doc.fontSize(12).text('Total Credit:', 370, y);
    doc.text(`${symbol}${parseFloat(cn.total_amount).toFixed(2)}`, 470, y);

    if (cn.reason) {
      doc.fontSize(10).text('Reason:', 50, y + 50);
      doc.text(cn.reason, 50, y + 65, { width: 500 });
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Error generating PDF', error: error.message });
  }
});

// Delete credit note
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM credit_notes WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId]
    );

    res.json({ message: 'Credit note deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting credit note', error: error.message });
  }
});

module.exports = router;