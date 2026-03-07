// ============================================
// routes/item.js - Item/Inventory Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Get all items
router.get('/', authMiddleware, async (req, res) => {
  const { search, page = 1, per_page = 50 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    let query = `
      SELECT i.*, cur.code as currency_code
      FROM items i
      LEFT JOIN currencies cur ON i.currency_id = cur.id
      WHERE i.company_id = $1
    `;
    let params = [req.companyId];

    if (search) {
      query += ` AND (i.name ILIKE $2 OR i.sku ILIKE $2 OR i.category ILIKE $2)`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(per_page, offset);

    const result = await pool.query(query, params);

    const countQuery = search 
      ? `SELECT COUNT(*) FROM items WHERE company_id = $1 AND (name ILIKE $2 OR sku ILIKE $2 OR category ILIKE $2)`
      : `SELECT COUNT(*) FROM items WHERE company_id = $1`;
    const countParams = search ? [req.companyId, `%${search}%`] : [req.companyId];
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      items: result.rows.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sku: item.sku,
        category: item.category,
        unit_price: parseFloat(item.unit_price),
        quantity_on_hand: item.quantity_on_hand,
        reorder_level: item.reorder_level,
        currency_id: item.currency_id,
        currency_code: item.currency_code,
        created_at: item.created_at,
        updated_at: item.updated_at
      })),
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(countResult.rows[0].count / per_page),
      current_page: parseInt(page)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items', error: error.message });
  }
});

// Create item
router.post('/', authMiddleware, async (req, res) => {
  const { name, description, sku, category, unit_price, quantity_on_hand, reorder_level, currency_id } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO items (company_id, name, description, sku, category, unit_price, quantity_on_hand, reorder_level, currency_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *`,
      [req.companyId, name, description, sku, category, unit_price, quantity_on_hand || 0, reorder_level || 0, currency_id]
    );

    const item = result.rows[0];

    // If initial quantity > 0, create stock movement
    if (quantity_on_hand > 0) {
      await client.query(
        `INSERT INTO stock_movements (item_id, movement_type, quantity, unit_cost, reference_type, movement_date, remaining_quantity)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [item.id, 'IN', quantity_on_hand, unit_price, 'INITIAL', quantity_on_hand]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Item created successfully',
      item: item
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error creating item', error: error.message });
  } finally {
    client.release();
  }
});

// Update item
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, description, sku, category, unit_price, reorder_level, currency_id } = req.body;

  try {
    await pool.query(
      `UPDATE items 
       SET name = $1, description = $2, sku = $3, category = $4, unit_price = $5, reorder_level = $6, currency_id = $7, updated_at = NOW()
       WHERE id = $8 AND company_id = $9`,
      [name, description, sku, category, unit_price, reorder_level, currency_id, req.params.id, req.companyId]
    );

    res.json({ message: 'Item updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating item', error: error.message });
  }
});

// Delete item
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM items WHERE id = $1 AND company_id = $2',
      [req.params.id, req.companyId]
    );

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting item', error: error.message });
  }
});

module.exports = router;