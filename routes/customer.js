// ============================================
// routes/customer.js - Customer Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Get all customers
router.get('/', authMiddleware, async (req, res) => {
  const { search, page = 1, per_page = 10 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    let query = `
      SELECT c.*, cur.code as currency_code,
             COALESCE(SUM(i.total_amount), 0) as total_invoiced
      FROM customers c
      LEFT JOIN currencies cur ON c.currency_id = cur.id
      LEFT JOIN invoices i ON c.id = i.customer_id
      WHERE c.company_id = $1
    `;
    let params = [req.companyId];

    if (search) {
      query += ` AND (c.name ILIKE $2 OR c.email ILIKE $2 OR c.company_name ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY c.id, cur.code ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(per_page, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = search 
      ? `SELECT COUNT(*) FROM customers WHERE company_id = $1 AND (name ILIKE $2 OR email ILIKE $2 OR company_name ILIKE $2)`
      : `SELECT COUNT(*) FROM customers WHERE company_id = $1`;
    const countParams = search ? [req.companyId, `%${search}%`] : [req.companyId];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      customers: result.rows.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        company_name: c.company_name,
        phone: c.phone,
        address: c.address,
        currency_id: c.currency_id,
        currency_code: c.currency_code,
        total_invoiced: parseFloat(c.total_invoiced),
        created_at: c.created_at,
        updated_at: c.updated_at
      })),
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(countResult.rows[0].count / per_page),
      current_page: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
});

// Create customer
router.post('/', authMiddleware, async (req, res) => {
  const { name, email, company_name, phone, address, currency_id } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO customers (company_id, name, email, company_name, phone, address, currency_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [req.companyId, name, email, company_name, phone, address, currency_id]
    );

    res.status(201).json({
      message: 'Customer created successfully',
      customer: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
});

// Get single customer
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM customers WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
});

// Update customer
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, email, company_name, phone, address, currency_id } = req.body;

  try {
    await pool.query(
      `UPDATE customers 
       SET name = $1, email = $2, company_name = $3, phone = $4, address = $5, currency_id = $6, updated_at = NOW()
       WHERE id = $7 AND company_id = $8`,
      [name, email, company_name, phone, address, currency_id, req.params.id, req.companyId]
    );

    res.json({ message: 'Customer updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
});

// Delete customer
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM customers WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId]
    );

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
});

module.exports = router;