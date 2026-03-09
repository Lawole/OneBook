// ============================================
// routes/expense.js - Expense Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const CATEGORIES = [
  { value: 'office-supplies', label: 'Office Supplies' },
  { value: 'travel', label: 'Travel' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'software', label: 'Software & Subscriptions' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

// GET /expenses/categories/list
router.get('/categories/list', authMiddleware, (req, res) => {
  res.json({ categories: CATEGORIES });
});

// GET /expenses
router.get('/', authMiddleware, async (req, res) => {
  const { search = '', category = '', page = 1, per_page = 20 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    let whereClause = 'WHERE e.company_id = $1';
    const params = [req.companyId];
    let idx = 2;

    if (search) {
      whereClause += ` AND (e.description ILIKE $${idx} OR e.expense_number ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }
    if (category) {
      whereClause += ` AND e.category = $${idx}`;
      params.push(category);
      idx++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM expenses e ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT e.*, v.name as vendor_name
       FROM expenses e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       ${whereClause}
       ORDER BY e.expense_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, per_page, offset]
    );

    res.json({
      expenses: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      per_page: parseInt(per_page),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching expenses', error: error.message });
  }
});

// POST /expenses
router.post('/', authMiddleware, async (req, res) => {
  const { description, category, amount, expense_date, vendor_id, notes, tax_amount } = req.body;

  if (!description || !category || !amount || !expense_date) {
    return res.status(400).json({ message: 'Description, category, amount and date are required' });
  }

  try {
    // Auto-generate expense number
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM expenses WHERE company_id = $1',
      [req.companyId]
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const expense_number = `EXP-${String(count).padStart(4, '0')}`;

    const result = await pool.query(
      `INSERT INTO expenses (company_id, vendor_id, expense_date, expense_number, description, category, amount, tax_amount, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [req.companyId, vendor_id || null, expense_date, expense_number, description, category, amount, tax_amount || 0, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error creating expense', error: error.message });
  }
});

// PUT /expenses/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const { description, category, amount, expense_date, vendor_id, notes, tax_amount } = req.body;
  if (!description || !category || !amount || !expense_date) {
    return res.status(400).json({ message: 'Description, category, amount and date are required' });
  }
  try {
    const result = await pool.query(
      `UPDATE expenses SET description=$1, category=$2, amount=$3, expense_date=$4,
       vendor_id=$5, notes=$6, tax_amount=$7, updated_at=NOW()
       WHERE id=$8 AND company_id=$9 RETURNING *`,
      [description, category, amount, expense_date, vendor_id || null, notes || null, tax_amount || 0, req.params.id, req.companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Expense not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error updating expense', error: error.message });
  }
});

// DELETE /expenses/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM expenses WHERE id = $1 AND company_id = $2 RETURNING id',
      [req.params.id, req.companyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting expense', error: error.message });
  }
});

module.exports = router;
