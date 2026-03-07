// ============================================
// routes/vendor.js - Vendor Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Get all vendors
router.get('/', authMiddleware, async (req, res) => {
  const { search, page = 1, per_page = 10 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    let query = `
      SELECT v.*, cur.code as currency_code
      FROM vendors v
      LEFT JOIN currencies cur ON v.currency_id = cur.id
      WHERE v.company_id = $1
    `;
    let params = [req.companyId];

    if (search) {
      query += ` AND (v.name ILIKE $2 OR v.email ILIKE $2 OR v.company_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY v.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(per_page, offset);

    const result = await pool.query(query, params);

    const countQuery = search 
      ? `SELECT COUNT(*) FROM vendors WHERE company_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR company_name ILIKE $2)`
      : `SELECT COUNT(*) FROM vendors WHERE company_id = $1`;
    const countParams = search ? [req.companyId, `%${search}%`] : [req.companyId];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      vendors: result.rows,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(countResult.rows[0].count / per_page),
      current_page: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendors', error: error.message });
  }
});

// Create vendor
router.post('/', authMiddleware, async (req, res) => {
  const { name, email, company_name, phone, address, currency_id } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO vendors (company_id, name, email, company_name, phone, address, currency_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [req.companyId, name, email, company_name, phone, address, currency_id]
    );

    res.status(201).json({
      message: 'Vendor created successfully',
      vendor: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating vendor', error: error.message });
  }
});

// Update vendor
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, email, company_name, phone, address, currency_id } = req.body;

  try {
    await pool.query(
      `UPDATE vendors 
       SET name = $1, email = $2, company_name = $3, phone = $4, address = $5, currency_id = $6, updated_at = NOW()
       WHERE id = $7 AND company_id = $8`,
      [name, email, company_name, phone, address, currency_id, req.params.id, req.companyId]
    );

    res.json({ message: 'Vendor updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating vendor', error: error.message });
  }
});

// Delete vendor
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM vendors WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId]
    );

    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting vendor', error: error.message });
  }
});

module.exports = router;