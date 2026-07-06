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
    return res.status(400).json({
      message: 'Company name, email and password are required',
      reason: 'One or more required fields was empty',
      remedy: 'Fill in your company name, work email and password to continue.',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      message: 'Password must be at least 6 characters',
      reason: 'The password you entered is too short',
      remedy: 'Choose a password of 6 or more characters, ideally with numbers and symbols.',
    });
  }

  if (!base_currency) {
    return res.status(400).json({
      message: 'A base currency is required',
      reason: 'No currency was selected during signup',
      remedy: 'Pick the currency you will use across your OneBooks account (this cannot be changed later without affecting historical reports).',
    });
  }

  // Accept any ISO-4217 currency code (3 uppercase letters). We validate loosely
  // rather than pinning to a fixed list so newly added currencies work without
  // a code change. The client picker is limited to real currencies.
  const isKnown = CURRENCIES[base_currency] || /^[A-Z]{3}$/.test(base_currency);

  if (!isKnown) {
    return res.status(400).json({
      message: 'Unsupported currency selected',
      reason: `"${base_currency}" is not in the supported currency list`,
      remedy: 'Pick a currency from the dropdown on the signup screen.',
    });
  }

  const currencyCode = base_currency;
  const currencyInfo = CURRENCIES[currencyCode] || { name: currencyCode, symbol: currencyCode };

  try {
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM companies WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: 'An account with this email already exists',
        reason: `${email} is already registered`,
        remedy: 'Sign in instead, or use "Forgot password" to recover access.',
      });
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
        base_currency: company.base_currency,
        avatar_url: company.avatar_url || null
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      message: 'Registration failed',
      reason: error.message,
      remedy: 'Please try again. If the problem persists, contact support.',
    });
  }
});

// Login - with email and password
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required',
      reason: 'One or both fields were empty',
      remedy: 'Enter both your email address and password to sign in.',
    });
  }

  try {
    const result = await pool.query('SELECT * FROM companies WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid email or password',
        reason: 'No account matches these credentials',
        remedy: 'Double-check your email address and password, or use "Forgot password" if you cannot remember it.',
      });
    }

    const company = result.rows[0];

    if (!company.password_hash) {
      return res.status(401).json({
        message: 'Invalid email or password',
        reason: 'This account has no password set',
        remedy: 'Use "Forgot password" to set one, or contact support.',
      });
    }

    const isValid = await bcrypt.compare(password, company.password_hash);
    if (!isValid) {
      return res.status(401).json({
        message: 'Invalid email or password',
        reason: 'The password you entered does not match this account',
        remedy: 'Try again, or use "Forgot password" to reset it.',
      });
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
        base_currency: company.base_currency,
        avatar_url: company.avatar_url || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      reason: error.message,
      remedy: 'Refresh the page and try again. If it persists, contact support.',
    });
  }
});

module.exports = router;
