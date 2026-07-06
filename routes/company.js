// ============================================
// routes/company.js - Company Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Get company info
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM companies WHERE id = $1',
      [req.companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const company = result.rows[0];
    res.json({
      id: company.id,
      name: company.name,
      email: company.email,
      phone: company.phone,
      address: company.address,
      avatar_url: company.avatar_url || null,
      tax_rate: parseFloat(company.tax_rate) || 0,
      base_currency: company.base_currency,
      invoice_template: company.invoice_template || 'classic'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company', error: error.message });
  }
});

// Update company info
router.put('/', authMiddleware, async (req, res) => {
  const { name, email, phone, address, tax_rate, base_currency, invoice_template } = req.body;

  // The uniform base currency is chosen at signup and locked afterwards.
  // Changing it would corrupt historical reports that reference currencies.id,
  // so we reject any attempt that would actually change it.
  if (base_currency !== undefined) {
    const current = await pool.query('SELECT base_currency FROM companies WHERE id = $1', [req.companyId]);
    if (current.rows.length && current.rows[0].base_currency !== base_currency) {
      return res.status(400).json({
        message: 'Base currency cannot be changed after registration',
        reason: 'The base currency is chosen at signup and used by every historical invoice, expense, and journal entry.',
        remedy: 'If you truly need to change it, contact support so we can migrate your data safely.',
      });
    }
  }

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined)             { fields.push(`name = $${idx++}`);             values.push(name); }
    if (email !== undefined)            { fields.push(`email = $${idx++}`);            values.push(email); }
    if (phone !== undefined)            { fields.push(`phone = $${idx++}`);            values.push(phone); }
    if (address !== undefined)          { fields.push(`address = $${idx++}`);          values.push(address); }
    if (tax_rate !== undefined)         { fields.push(`tax_rate = $${idx++}`);         values.push(tax_rate); }
    if (invoice_template !== undefined) { fields.push(`invoice_template = $${idx++}`); values.push(invoice_template); }

    if (fields.length === 0) return res.json({ message: 'Nothing to update' });

    fields.push(`updated_at = NOW()`);
    values.push(req.companyId);

    await pool.query(
      `UPDATE companies SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );

    res.json({ message: 'Company updated successfully' });
  } catch (error) {
    res.status(500).json({
      message: 'Could not update company',
      reason: error.message,
      remedy: 'Check the values and try again.',
    });
  }
});

module.exports = router;