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
      base_currency: company.base_currency
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company', error: error.message });
  }
});

// Update company info
router.put('/', authMiddleware, async (req, res) => {
  const { name, email, phone, address, tax_rate, base_currency } = req.body;

  try {
    await pool.query(
      `UPDATE companies 
       SET name = $1, email = $2, phone = $3, address = $4, 
           tax_rate = $5, base_currency = $6, updated_at = NOW()
       WHERE id = $7`,
      [name, email, phone, address, tax_rate, base_currency, req.companyId]
    );

    res.json({ message: 'Company updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating company', error: error.message });
  }
});

module.exports = router;