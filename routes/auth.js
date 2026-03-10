// ============================================
// routes/auth.js - Authentication Routes
// ============================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

// Supported currencies for registration
const CURRENCIES = {
  USD: { name: 'US Dollar',           symbol: '$'   },
  NGN: { name: 'Nigerian Naira',      symbol: '₦'   },
  EUR: { name: 'Euro',                symbol: '€'   },
  GBP: { name: 'British Pound',       symbol: '£'   },
  CAD: { name: 'Canadian Dollar',     symbol: 'CA$' },
  AUD: { name: 'Australian Dollar',   symbol: 'A$'  },
  JPY: { name: 'Japanese Yen',        symbol: '¥'   },
  CHF: { name: 'Swiss Franc',         symbol: 'CHF' },
  INR: { name: 'Indian Rupee',        symbol: '₹'   },
  CNY: { name: 'Chinese Yuan',        symbol: '¥'   },
  GHS: { name: 'Ghanaian Cedi',       symbol: '₵'   },
  ZAR: { name: 'South African Rand',  symbol: 'R'   },
  KES: { name: 'Kenyan Shilling',     symbol: 'KSh' },
  AED: { name: 'UAE Dirham',          symbol: 'AED' },
  SAR: { name: 'Saudi Riyal',         symbol: 'SR'  },
};

// Register - Create a new account
router.post('/register', async (req, res) => {
  const { company_name, email, password, base_currency } = req.body;

  if (!company_name || !email || !password) {
    return res.status(400).json({ message: 'Company name, email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  const currencyCode = (base_currency && CURRENCIES[base_currency]) ? base_currency : 'USD';
  const currencyInfo = CURRENCIES[currencyCode];

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM companies WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO companies (name, email, password_hash, base_currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [company_name, email, password_hash, currencyCode]
    );
    const company = result.rows[0];

    // Create base currency entry for the company
    await pool.query(
      `INSERT INTO currencies (company_id, code, name, symbol, exchange_rate, is_base, created_at)
       VALUES ($1, $2, $3, $4, 1.0000, true, NOW())`,
      [company.id, currencyCode, currencyInfo.name, currencyInfo.symbol]
    );

    const token = jwt.sign(
      { company_id: company.id },
      process.env.JWT_SECRET || 'onebooks-secret-key-2025',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
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
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login - with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM companies WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const company = result.rows[0];

    if (!company.password_hash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, company.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { company_id: company.id },
      process.env.JWT_SECRET || 'onebooks-secret-key-2025',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
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
