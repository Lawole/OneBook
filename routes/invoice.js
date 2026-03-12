// ============================================
// routes/invoice.js - Invoice Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

// ── Currency symbol map ───────────────────────────────────────
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', NGN: '₦', GHS: '₵',
  JPY: '¥', CNY: '¥', INR: '₹', CAD: 'CA$', AUD: 'A$',
  CHF: 'CHF', ZAR: 'R', KES: 'KSh', AED: 'AED', SAR: 'SR',
};

function getCurrencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || (code ? code : '$');
}

// ── Get all invoices (with overdue auto-detection) ────────────
router.get('/', authMiddleware, async (req, res) => {
  const { search, status, page = 1, per_page = 10 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    // Auto-mark overdue: unpaid/sent invoices past due_date
    await pool.query(
      `UPDATE invoices SET status = 'overdue', updated_at = NOW()
       WHERE company_id = $1
         AND status IN ('sent', 'unpaid', 'draft')
         AND due_date < CURRENT_DATE`,
      [req.companyId]
    );

    let query = `
      SELECT i.*, c.name as customer_name, cur.code as currency_code, cur.symbol as currency_symbol,
             comp.base_currency as company_currency
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN currencies cur ON i.currency_id = cur.id
      LEFT JOIN companies comp ON i.company_id = comp.id
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

// ── Create invoice ────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const { customer_id, invoice_date, due_date, currency_id, notes, items, tax_rate } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const maxResult = await client.query(
      `SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER)), 0) as max_num
       FROM invoices WHERE company_id = $1 AND invoice_number ~ '^INV-[0-9]+$'`,
      [req.companyId]
    );
    const invoice_number = `INV-${String(maxResult.rows[0].max_num + 1).padStart(4, '0')}`;

    let subtotal = 0;
    items.forEach(item => { subtotal += item.quantity * item.unit_price; });
    const tax_amount = subtotal * ((tax_rate || 0) / 100);
    const total_amount = subtotal + tax_amount;

    const invoiceResult = await client.query(
      `INSERT INTO invoices (company_id, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, currency_id, notes, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
      [req.companyId, customer_id, invoice_number, invoice_date, due_date, subtotal, tax_amount, total_amount, currency_id, notes, 'draft']
    );

    const invoice = invoiceResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (invoice_id, item_id, description, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, item.item_id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
      if (item.item_id) {
        await updateInventoryFIFO(client, item.item_id, item.quantity, invoice.id);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Invoice created successfully', invoice });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error creating invoice', error: error.message });
  } finally {
    client.release();
  }
});

// ── Send invoice via email ────────────────────────────────────
router.post('/:id/send', authMiddleware, async (req, res) => {
  try {
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name as customer_name, c.company_name as customer_company,
              c.address as customer_address, c.email as customer_email,
              cur.code as currency_code, cur.symbol as currency_symbol,
              comp.name as company_name, comp.address as company_address,
              comp.phone as company_phone, comp.email as company_email,
              comp.base_currency as company_currency,
              COALESCE(comp.invoice_template, 'classic') as invoice_template
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

    if (!invoice.customer_email) {
      return res.status(400).json({ message: 'Customer has no email address on file' });
    }

    const itemsResult = await pool.query(
      `SELECT ii.*, i.name as item_name
       FROM invoice_items ii
       LEFT JOIN items i ON ii.item_id = i.id
       WHERE ii.invoice_id = $1`,
      [invoice.id]
    );

    // Generate PDF buffer
    const pdfBuffer = await generatePDFBuffer(invoice, itemsResult.rows);

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const symbol = invoice.currency_symbol || getCurrencySymbol(invoice.company_currency) || '$';

    await transporter.sendMail({
      from: `"${invoice.company_name}" <${process.env.SMTP_USER}>`,
      to: invoice.customer_email,
      subject: `Invoice ${invoice.invoice_number} from ${invoice.company_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e293b;">Invoice ${invoice.invoice_number}</h2>
          <p>Dear ${invoice.customer_name},</p>
          <p>Please find attached your invoice for <strong>${symbol}${parseFloat(invoice.total_amount).toFixed(2)}</strong>, due on <strong>${new Date(invoice.due_date).toLocaleDateString()}</strong>.</p>
          ${invoice.notes ? `<p><em>${invoice.notes}</em></p>` : ''}
          <p>Thank you for your business.</p>
          <p style="color: #64748b;">— ${invoice.company_name}</p>
        </div>
      `,
      attachments: [
        {
          filename: `invoice_${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // Update status to 'sent'
    await pool.query(
      `UPDATE invoices SET status = 'sent', updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.companyId]
    );

    res.json({ message: 'Invoice sent successfully' });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ message: 'Error sending invoice', error: error.message });
  }
});

// ── Generate PDF (download) ───────────────────────────────────
router.get('/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const invoiceResult = await pool.query(
      `SELECT i.*, c.name as customer_name, c.company_name as customer_company,
              c.address as customer_address, c.email as customer_email,
              cur.code as currency_code, cur.symbol as currency_symbol,
              comp.name as company_name, comp.address as company_address,
              comp.phone as company_phone, comp.email as company_email,
              comp.base_currency as company_currency,
              COALESCE(comp.invoice_template, 'classic') as invoice_template
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

    const itemsResult = await pool.query(
      `SELECT ii.*, i.name as item_name
       FROM invoice_items ii
       LEFT JOIN items i ON ii.item_id = i.id
       WHERE ii.invoice_id = $1`,
      [invoice.id]
    );

    const pdfBuffer = await generatePDFBuffer(invoice, itemsResult.rows);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoice_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ message: 'Error generating PDF', error: error.message });
  }
});

// ── Update invoice ────────────────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  const { status, customer_id, invoice_date, due_date, notes, items } = req.body;

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

// ── Delete invoice ────────────────────────────────────────────
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

// ── PDF Generation (returns Buffer) ──────────────────────────
function generatePDFBuffer(invoice, items) {
  return new Promise((resolve, reject) => {
    const template = invoice.invoice_template || 'classic';
    const symbol = invoice.currency_symbol || getCurrencySymbol(invoice.company_currency) || '$';
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    switch (template) {
      case 'modern':    renderModern(doc, invoice, items, symbol); break;
      case 'minimal':   renderMinimal(doc, invoice, items, symbol); break;
      case 'bold':      renderBold(doc, invoice, items, symbol); break;
      case 'elegant':   renderElegant(doc, invoice, items, symbol); break;
      default:          renderClassic(doc, invoice, items, symbol); break;
    }

    doc.end();
  });
}

// ── Template: Classic ─────────────────────────────────────────
function renderClassic(doc, invoice, items, symbol) {
  const W = 595 - 100; // usable width with 50px margins

  // Header
  doc.fontSize(22).fillColor('#1e293b').text(invoice.company_name, 50, 50);
  doc.fontSize(9).fillColor('#64748b')
    .text(invoice.company_address || '', 50, 78)
    .text(invoice.company_phone || '', 50, 91)
    .text(invoice.company_email || '', 50, 104);

  doc.fontSize(28).fillColor('#3b82f6').text('INVOICE', 370, 50, { width: 175, align: 'right' });
  doc.fontSize(11).fillColor('#64748b').text(`#${invoice.invoice_number}`, 370, 86, { width: 175, align: 'right' });

  // Divider
  doc.moveTo(50, 125).lineTo(545, 125).lineWidth(1).strokeColor('#e2e8f0').stroke();

  // Bill To / Dates
  doc.fontSize(9).fillColor('#94a3b8').text('BILL TO', 50, 140);
  doc.fontSize(11).fillColor('#1e293b').text(invoice.customer_name, 50, 155);
  if (invoice.customer_company) doc.fontSize(9).fillColor('#64748b').text(invoice.customer_company, 50, 170);
  if (invoice.customer_address) doc.fontSize(9).fillColor('#64748b').text(invoice.customer_address, 50, 183);
  if (invoice.customer_email) doc.fontSize(9).fillColor('#64748b').text(invoice.customer_email, 50, 196);

  doc.fontSize(9).fillColor('#94a3b8').text('INVOICE DATE', 370, 140);
  doc.fontSize(11).fillColor('#1e293b').text(new Date(invoice.invoice_date).toLocaleDateString(), 370, 155);
  doc.fontSize(9).fillColor('#94a3b8').text('DUE DATE', 370, 175);
  doc.fontSize(11).fillColor('#1e293b').text(new Date(invoice.due_date).toLocaleDateString(), 370, 190);

  // Table
  const tY = 240;
  doc.rect(50, tY, W, 22).fill('#f8fafc');
  doc.fontSize(9).fillColor('#64748b')
    .text('DESCRIPTION', 58, tY + 7)
    .text('QTY', 310, tY + 7, { width: 50, align: 'right' })
    .text('UNIT PRICE', 370, tY + 7, { width: 80, align: 'right' })
    .text('TOTAL', 460, tY + 7, { width: 85, align: 'right' });

  let y = tY + 32;
  items.forEach((item, i) => {
    if (i % 2 === 1) doc.rect(50, y - 5, W, 22).fill('#f9fafb').stroke('#f9fafb');
    doc.fontSize(10).fillColor('#1e293b').text(item.description, 58, y, { width: 245 });
    doc.text(String(item.quantity), 310, y, { width: 50, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.unit_price).toFixed(2)}`, 370, y, { width: 80, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.line_total).toFixed(2)}`, 460, y, { width: 85, align: 'right' });
    y += 25;
  });

  // Totals
  y += 10;
  doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  y += 12;
  doc.fontSize(10).fillColor('#64748b').text('Subtotal', 360, y).fillColor('#1e293b').text(`${symbol}${parseFloat(invoice.subtotal).toFixed(2)}`, 460, y, { width: 85, align: 'right' });
  if (parseFloat(invoice.tax_amount) > 0) {
    y += 18;
    doc.fillColor('#64748b').text('Tax', 360, y).fillColor('#1e293b').text(`${symbol}${parseFloat(invoice.tax_amount).toFixed(2)}`, 460, y, { width: 85, align: 'right' });
  }
  y += 18;
  doc.rect(350, y - 4, 195, 26).fill('#1e293b');
  doc.fontSize(12).fillColor('#ffffff').text('TOTAL', 360, y + 3).text(`${symbol}${parseFloat(invoice.total_amount).toFixed(2)}`, 460, y + 3, { width: 85, align: 'right' });

  // Notes
  if (invoice.notes) {
    y += 50;
    doc.fontSize(9).fillColor('#94a3b8').text('NOTES', 50, y);
    doc.fontSize(10).fillColor('#64748b').text(invoice.notes, 50, y + 14, { width: W });
  }
}

// ── Template: Modern ──────────────────────────────────────────
function renderModern(doc, invoice, items, symbol) {
  const W = 595 - 100;

  // Top accent bar
  doc.rect(0, 0, 595, 8).fill('#6366f1');

  // Header band
  doc.rect(0, 8, 595, 80).fill('#0f172a');
  doc.fontSize(24).fillColor('#ffffff').text(invoice.company_name, 50, 24);
  doc.fontSize(9).fillColor('#94a3b8')
    .text([invoice.company_address, invoice.company_phone, invoice.company_email].filter(Boolean).join('  ·  '), 50, 52);
  doc.fontSize(14).fillColor('#818cf8').text(`INVOICE #${invoice.invoice_number}`, 370, 30, { width: 175, align: 'right' });
  doc.fontSize(9).fillColor('#cbd5e1')
    .text(`${new Date(invoice.invoice_date).toLocaleDateString()}`, 370, 52, { width: 175, align: 'right' });

  // Bill To box
  doc.rect(50, 108, 200, 80).fillAndStroke('#f8fafc', '#e2e8f0');
  doc.fontSize(8).fillColor('#6366f1').text('BILLED TO', 62, 118);
  doc.fontSize(11).fillColor('#0f172a').text(invoice.customer_name, 62, 132);
  doc.fontSize(9).fillColor('#64748b').text(
    [invoice.customer_company, invoice.customer_address, invoice.customer_email].filter(Boolean).join('\n'),
    62, 148, { width: 175 }
  );

  // Due box
  doc.rect(370, 108, 175, 80).fillAndStroke('#6366f1', '#6366f1');
  doc.fontSize(8).fillColor('#c7d2fe').text('DUE DATE', 382, 118);
  doc.fontSize(14).fillColor('#ffffff').text(new Date(invoice.due_date).toLocaleDateString(), 382, 134);
  doc.fontSize(8).fillColor('#c7d2fe').text('AMOUNT DUE', 382, 158);
  doc.fontSize(13).fillColor('#ffffff').text(`${symbol}${parseFloat(invoice.total_amount).toFixed(2)}`, 382, 172);

  // Table
  const tY = 215;
  doc.rect(50, tY, W, 22).fill('#6366f1');
  doc.fontSize(8).fillColor('#ffffff')
    .text('DESCRIPTION', 60, tY + 7)
    .text('QTY', 310, tY + 7, { width: 50, align: 'right' })
    .text('PRICE', 368, tY + 7, { width: 72, align: 'right' })
    .text('TOTAL', 450, tY + 7, { width: 95, align: 'right' });

  let y = tY + 30;
  items.forEach((item, i) => {
    if (i % 2 === 0) doc.rect(50, y - 5, W, 22).fill('#f8fafc').stroke('#f8fafc');
    doc.fontSize(10).fillColor('#1e293b').text(item.description, 60, y, { width: 245 });
    doc.text(String(item.quantity), 310, y, { width: 50, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.unit_price).toFixed(2)}`, 368, y, { width: 72, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.line_total).toFixed(2)}`, 450, y, { width: 95, align: 'right' });
    y += 24;
  });

  y += 15;
  doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#e2e8f0').stroke();
  y += 12;
  doc.fontSize(10).fillColor('#64748b').text('Subtotal', 360, y)
    .fillColor('#1e293b').text(`${symbol}${parseFloat(invoice.subtotal).toFixed(2)}`, 450, y, { width: 95, align: 'right' });
  if (parseFloat(invoice.tax_amount) > 0) {
    y += 18;
    doc.fillColor('#64748b').text('Tax', 360, y)
      .fillColor('#1e293b').text(`${symbol}${parseFloat(invoice.tax_amount).toFixed(2)}`, 450, y, { width: 95, align: 'right' });
  }
  y += 18;
  doc.rect(350, y - 4, 195, 26).fill('#0f172a');
  doc.fontSize(12).fillColor('#ffffff').text('TOTAL', 360, y + 3)
    .text(`${symbol}${parseFloat(invoice.total_amount).toFixed(2)}`, 450, y + 3, { width: 95, align: 'right' });

  if (invoice.notes) {
    y += 50;
    doc.fontSize(9).fillColor('#6366f1').text('NOTES', 50, y);
    doc.fontSize(10).fillColor('#64748b').text(invoice.notes, 50, y + 14, { width: W });
  }
}

// ── Template: Minimal ─────────────────────────────────────────
function renderMinimal(doc, invoice, items, symbol) {
  const W = 595 - 100;

  doc.fontSize(10).fillColor('#9ca3af').text('INVOICE', 50, 50);
  doc.fontSize(24).fillColor('#111827').text(`#${invoice.invoice_number}`, 50, 65);

  doc.fontSize(18).fillColor('#111827').text(invoice.company_name, 370, 50, { width: 175, align: 'right' });
  doc.fontSize(9).fillColor('#6b7280')
    .text([invoice.company_address, invoice.company_email].filter(Boolean).join('\n'), 370, 75, { width: 175, align: 'right' });

  doc.moveTo(50, 120).lineTo(545, 120).lineWidth(2).strokeColor('#111827').stroke();

  doc.fontSize(9).fillColor('#9ca3af').text('BILL TO', 50, 135);
  doc.fontSize(11).fillColor('#111827').text(invoice.customer_name, 50, 152);
  doc.fontSize(9).fillColor('#6b7280').text(
    [invoice.customer_company, invoice.customer_email].filter(Boolean).join('\n'),
    50, 167
  );

  doc.fontSize(9).fillColor('#9ca3af').text('DATE', 370, 135);
  doc.fontSize(10).fillColor('#111827').text(new Date(invoice.invoice_date).toLocaleDateString(), 370, 150);
  doc.fontSize(9).fillColor('#9ca3af').text('DUE', 370, 168);
  doc.fontSize(10).fillColor('#111827').text(new Date(invoice.due_date).toLocaleDateString(), 370, 183);

  const tY = 225;
  doc.moveTo(50, tY).lineTo(545, tY).lineWidth(0.5).strokeColor('#d1d5db').stroke();
  doc.fontSize(8).fillColor('#9ca3af')
    .text('ITEM', 50, tY + 8)
    .text('QTY', 310, tY + 8, { width: 50, align: 'right' })
    .text('RATE', 368, tY + 8, { width: 72, align: 'right' })
    .text('AMOUNT', 448, tY + 8, { width: 97, align: 'right' });
  doc.moveTo(50, tY + 24).lineTo(545, tY + 24).lineWidth(0.5).strokeColor('#d1d5db').stroke();

  let y = tY + 34;
  items.forEach(item => {
    doc.fontSize(10).fillColor('#111827').text(item.description, 50, y, { width: 255 });
    doc.text(String(item.quantity), 310, y, { width: 50, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.unit_price).toFixed(2)}`, 368, y, { width: 72, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.line_total).toFixed(2)}`, 448, y, { width: 97, align: 'right' });
    y += 24;
    doc.moveTo(50, y - 3).lineTo(545, y - 3).lineWidth(0.3).strokeColor('#f3f4f6').stroke();
  });

  y += 8;
  doc.fontSize(10).fillColor('#6b7280').text('Subtotal', 360, y)
    .fillColor('#111827').text(`${symbol}${parseFloat(invoice.subtotal).toFixed(2)}`, 448, y, { width: 97, align: 'right' });
  if (parseFloat(invoice.tax_amount) > 0) {
    y += 18;
    doc.fillColor('#6b7280').text('Tax', 360, y)
      .fillColor('#111827').text(`${symbol}${parseFloat(invoice.tax_amount).toFixed(2)}`, 448, y, { width: 97, align: 'right' });
  }
  y += 14;
  doc.moveTo(350, y).lineTo(545, y).lineWidth(2).strokeColor('#111827').stroke();
  y += 8;
  doc.fontSize(13).fillColor('#111827').text('Total', 360, y)
    .text(`${symbol}${parseFloat(invoice.total_amount).toFixed(2)}`, 448, y, { width: 97, align: 'right' });

  if (invoice.notes) {
    y += 50;
    doc.fontSize(9).fillColor('#9ca3af').text('NOTES', 50, y);
    doc.fontSize(10).fillColor('#6b7280').text(invoice.notes, 50, y + 14, { width: W });
  }
}

// ── Template: Bold ────────────────────────────────────────────
function renderBold(doc, invoice, items, symbol) {
  const W = 595 - 100;

  // Left accent
  doc.rect(0, 0, 12, 842).fill('#f59e0b');

  doc.fontSize(26).fillColor('#1c1917').text('INVOICE', 30, 50);
  doc.fontSize(12).fillColor('#78716c').text(`#${invoice.invoice_number}`, 30, 82);

  doc.fontSize(16).fillColor('#1c1917').text(invoice.company_name, 200, 50, { width: 345, align: 'right' });
  doc.fontSize(9).fillColor('#78716c')
    .text([invoice.company_address, invoice.company_phone, invoice.company_email].filter(Boolean).join('\n'),
      200, 72, { width: 345, align: 'right' });

  // Info bar
  doc.rect(30, 115, W + 20, 2).fill('#f59e0b');
  doc.fontSize(9).fillColor('#78716c').text('BILLED TO', 30, 125);
  doc.fontSize(12).fillColor('#1c1917').text(invoice.customer_name, 30, 140);
  doc.fontSize(9).fillColor('#78716c')
    .text([invoice.customer_company, invoice.customer_address, invoice.customer_email].filter(Boolean).join('\n'), 30, 156);

  doc.fontSize(9).fillColor('#78716c').text('DATE', 370, 125)
    .fillColor('#1c1917').fontSize(11).text(new Date(invoice.invoice_date).toLocaleDateString(), 370, 140);
  doc.fontSize(9).fillColor('#78716c').text('DUE DATE', 370, 162)
    .fillColor('#1c1917').fontSize(11).text(new Date(invoice.due_date).toLocaleDateString(), 370, 177);

  doc.rect(30, 215, W + 20, 2).fill('#f59e0b');

  const tY = 230;
  doc.rect(30, tY, W + 20, 22).fill('#1c1917');
  doc.fontSize(8).fillColor('#fef3c7')
    .text('DESCRIPTION', 38, tY + 7)
    .text('QTY', 308, tY + 7, { width: 50, align: 'right' })
    .text('PRICE', 366, tY + 7, { width: 80, align: 'right' })
    .text('TOTAL', 454, tY + 7, { width: 96, align: 'right' });

  let y = tY + 30;
  items.forEach((item, i) => {
    if (i % 2 === 1) doc.rect(30, y - 5, W + 20, 22).fill('#fffbeb').stroke('#fffbeb');
    doc.fontSize(10).fillColor('#1c1917').text(item.description, 38, y, { width: 265 });
    doc.text(String(item.quantity), 308, y, { width: 50, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.unit_price).toFixed(2)}`, 366, y, { width: 80, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.line_total).toFixed(2)}`, 454, y, { width: 96, align: 'right' });
    y += 25;
  });

  y += 12;
  doc.fontSize(10).fillColor('#78716c').text('Subtotal', 360, y)
    .fillColor('#1c1917').text(`${symbol}${parseFloat(invoice.subtotal).toFixed(2)}`, 454, y, { width: 96, align: 'right' });
  if (parseFloat(invoice.tax_amount) > 0) {
    y += 18;
    doc.fillColor('#78716c').text('Tax', 360, y)
      .fillColor('#1c1917').text(`${symbol}${parseFloat(invoice.tax_amount).toFixed(2)}`, 454, y, { width: 96, align: 'right' });
  }
  y += 22;
  doc.rect(350, y - 4, 210, 28).fill('#f59e0b');
  doc.fontSize(13).fillColor('#1c1917').text('TOTAL', 360, y + 4)
    .text(`${symbol}${parseFloat(invoice.total_amount).toFixed(2)}`, 454, y + 4, { width: 96, align: 'right' });

  if (invoice.notes) {
    y += 55;
    doc.fontSize(9).fillColor('#f59e0b').text('NOTES', 30, y);
    doc.fontSize(10).fillColor('#78716c').text(invoice.notes, 30, y + 14, { width: W + 20 });
  }
}

// ── Template: Elegant ─────────────────────────────────────────
function renderElegant(doc, invoice, items, symbol) {
  const W = 595 - 100;

  // Top gold bar
  doc.rect(0, 0, 595, 6).fill('#b45309');
  doc.rect(0, 6, 595, 4).fill('#fde68a');

  doc.fontSize(22).fillColor('#1c1917').text(invoice.company_name, 50, 30);
  doc.fontSize(9).fillColor('#92400e')
    .text([invoice.company_address, invoice.company_phone, invoice.company_email].filter(Boolean).join('  |  '), 50, 56);

  doc.fontSize(30).fillColor('#b45309').text('INVOICE', 370, 26, { width: 175, align: 'right' });
  doc.fontSize(11).fillColor('#44403c').text(`No. ${invoice.invoice_number}`, 370, 62, { width: 175, align: 'right' });

  // Separator
  doc.rect(50, 82, W, 1).fill('#b45309');
  doc.rect(50, 83, W, 0.5).fill('#fde68a');

  doc.fontSize(9).fillColor('#92400e').text('BILL TO', 50, 100);
  doc.fontSize(12).fillColor('#1c1917').text(invoice.customer_name, 50, 115);
  doc.fontSize(9).fillColor('#78716c')
    .text([invoice.customer_company, invoice.customer_address, invoice.customer_email].filter(Boolean).join('\n'), 50, 132);

  doc.fontSize(9).fillColor('#92400e').text('INVOICE DATE', 350, 100);
  doc.fontSize(10).fillColor('#1c1917').text(new Date(invoice.invoice_date).toLocaleDateString(), 350, 115);
  doc.fontSize(9).fillColor('#92400e').text('DUE DATE', 350, 138);
  doc.fontSize(10).fillColor('#1c1917').text(new Date(invoice.due_date).toLocaleDateString(), 350, 153);

  const tY = 200;
  doc.rect(50, tY, W, 1).fill('#b45309');
  doc.fontSize(8).fillColor('#92400e')
    .text('DESCRIPTION', 50, tY + 8)
    .text('QTY', 308, tY + 8, { width: 50, align: 'right' })
    .text('UNIT PRICE', 366, tY + 8, { width: 80, align: 'right' })
    .text('AMOUNT', 454, tY + 8, { width: 91, align: 'right' });
  doc.rect(50, tY + 22, W, 0.5).fill('#fde68a');

  let y = tY + 32;
  items.forEach(item => {
    doc.fontSize(10).fillColor('#1c1917').text(item.description, 50, y, { width: 253 });
    doc.text(String(item.quantity), 308, y, { width: 50, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.unit_price).toFixed(2)}`, 366, y, { width: 80, align: 'right' });
    doc.text(`${symbol}${parseFloat(item.line_total).toFixed(2)}`, 454, y, { width: 91, align: 'right' });
    y += 22;
    doc.rect(50, y - 2, W, 0.3).fill('#f5f5f4').stroke('#f5f5f4');
  });

  y += 10;
  doc.rect(50, y, W, 0.5).fill('#fde68a');
  y += 12;
  doc.fontSize(10).fillColor('#78716c').text('Subtotal', 360, y)
    .fillColor('#1c1917').text(`${symbol}${parseFloat(invoice.subtotal).toFixed(2)}`, 454, y, { width: 91, align: 'right' });
  if (parseFloat(invoice.tax_amount) > 0) {
    y += 18;
    doc.fillColor('#78716c').text('Tax', 360, y)
      .fillColor('#1c1917').text(`${symbol}${parseFloat(invoice.tax_amount).toFixed(2)}`, 454, y, { width: 91, align: 'right' });
  }
  y += 20;
  doc.rect(350, y - 4, 195, 26).fillAndStroke('#b45309', '#b45309');
  doc.fontSize(12).fillColor('#fef3c7').text('TOTAL', 360, y + 3)
    .text(`${symbol}${parseFloat(invoice.total_amount).toFixed(2)}`, 454, y + 3, { width: 91, align: 'right' });

  if (invoice.notes) {
    y += 55;
    doc.fontSize(9).fillColor('#b45309').text('NOTES', 50, y);
    doc.fontSize(10).fillColor('#78716c').text(invoice.notes, 50, y + 14, { width: W });
  }

  // Bottom gold bar
  doc.rect(0, 820, 595, 6).fill('#b45309');
  doc.rect(0, 816, 595, 4).fill('#fde68a');
}

// ── FIFO Inventory Update ─────────────────────────────────────
async function updateInventoryFIFO(client, item_id, quantity_sold, invoice_id) {
  let remaining = quantity_sold;
  const movements = await client.query(
    `SELECT * FROM stock_movements
     WHERE item_id = $1 AND movement_type = 'IN' AND remaining_quantity > 0
     ORDER BY movement_date ASC`,
    [item_id]
  );
  for (const movement of movements.rows) {
    if (remaining <= 0) break;
    const qty_to_use = Math.min(movement.remaining_quantity, remaining);
    await client.query(
      `INSERT INTO stock_movements (item_id, movement_type, quantity, unit_cost, reference_type, reference_id, movement_date, remaining_quantity)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0)`,
      [item_id, 'OUT', qty_to_use, movement.unit_cost, 'INVOICE', invoice_id]
    );
    await client.query(
      `UPDATE stock_movements SET remaining_quantity = remaining_quantity - $1 WHERE id = $2`,
      [qty_to_use, movement.id]
    );
    remaining -= qty_to_use;
  }
  await client.query(
    `UPDATE items SET quantity_on_hand = quantity_on_hand - $1, updated_at = NOW() WHERE id = $2`,
    [quantity_sold, item_id]
  );
}

module.exports = router;
