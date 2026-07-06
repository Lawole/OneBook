// ============================================
// config/currency.js
// Resolve the base currency for a company.
// A uniform currency is chosen at signup and used
// everywhere. This helper picks the company's base
// currencies row so all money records share it.
// ============================================

const pool = require('./database');

/**
 * Returns the `currencies.id` of the company's base currency.
 * If for some reason no row exists (legacy data), it lazily
 * creates one from the company's `base_currency` column.
 * Returns null only if the company itself cannot be found.
 */
async function getBaseCurrencyId(companyId) {
  // Prefer explicit is_base row
  const base = await pool.query(
    `SELECT id FROM currencies WHERE company_id = $1 AND is_base = TRUE LIMIT 1`,
    [companyId]
  );
  if (base.rows.length) return base.rows[0].id;

  // Fallback: look up the company's base_currency code
  const comp = await pool.query(
    `SELECT base_currency FROM companies WHERE id = $1`,
    [companyId]
  );
  if (!comp.rows.length) return null;

  const code = comp.rows[0].base_currency || 'USD';

  // Ensure a currencies row exists
  const existing = await pool.query(
    `SELECT id FROM currencies WHERE company_id = $1 AND code = $2 LIMIT 1`,
    [companyId, code]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await pool.query(
    `INSERT INTO currencies (company_id, code, name, symbol, exchange_rate, is_base, created_at)
     VALUES ($1, $2, $2, $2, 1.0000, TRUE, NOW())
     RETURNING id`,
    [companyId, code]
  );
  return inserted.rows[0].id;
}

module.exports = { getBaseCurrencyId };
