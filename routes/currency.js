// ============================================
// routes/currency.js - Currency Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Get all currencies
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM currencies WHERE company_id = $1 ORDER BY is_base DESC, code ASC',
      [req.companyId]
    );

    res.json({
      currencies: result.rows.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        symbol: c.symbol,
        exchange_rate: parseFloat(c.exchange_rate),
        is_base: c.is_base
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching currencies', error: error.message });
  }
});

// Add new currency
router.post('/', authMiddleware, async (req, res) => {
  const { code, name, symbol, exchange_rate } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO currencies (company_id, code, name, symbol, exchange_rate, is_base, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [req.companyId, code, name, symbol, exchange_rate || 1.0, false]
    );

    res.status(201).json({
      message: 'Currency added successfully',
      currency: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error adding currency', error: error.message });
  }
});

module.exports = router;