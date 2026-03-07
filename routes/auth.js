// ============================================
// routes/auth.js - Authentication Routes
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// Login
router.post('/login', async (req, res) => {
  const { company_name, email } = req.body;

  try {
    // Find or create company
    let companyResult = await pool.query(
      'SELECT * FROM companies WHERE name = $1',
      [company_name]
    );

    let company;
    if (companyResult.rows.length === 0) {
      // Create new company
      const insertResult = await pool.query(
        `INSERT INTO companies (name, base_currency, created_at, updated_at) 
         VALUES ($1, $2, NOW(), NOW()) RETURNING *`,
        [company_name, 'USD']
      );
      company = insertResult.rows[0];

      // Create default currency
      await pool.query(
        `INSERT INTO currencies (company_id, code, name, symbol, exchange_rate, is_base, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [company.id, 'USD', 'US Dollar', '$', 1.0000, true]
      );
    } else {
      company = companyResult.rows[0];
    }

    // Generate JWT token
    const token = jwt.sign(
      { company_id: company.id },
      process.env.JWT_SECRET || 'onebooks-secret-key-2025',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      company: {
        id: company.id,
        name: company.name,
        email: company.email,
        phone: company.phone,
        address: company.address,
        tax_rate: parseFloat(company.tax_rate) || 0,
        base_currency: company.base_currency
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

module.exports = router;