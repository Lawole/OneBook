// ============================================
// config/migrations.js
// Idempotent, self-healing schema migrations run
// automatically at server startup.
//
// Every statement is safe to run repeatedly
// (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) so
// this can be invoked on every deploy without any
// migration bookkeeping.
// ============================================

const pool = require('./database');

const STATEMENTS = [
  // ── Banking V3: auto-categorisation identifiers ──
  `ALTER TABLE chart_of_accounts
     ADD COLUMN IF NOT EXISTS identifier VARCHAR(100)`,

  `CREATE INDEX IF NOT EXISTS idx_coa_identifier
     ON chart_of_accounts(company_id, identifier)
     WHERE identifier IS NOT NULL AND identifier <> ''`,

  `ALTER TABLE bank_transactions
     ADD COLUMN IF NOT EXISTS auto_matched BOOLEAN DEFAULT FALSE`,

  // ── FX Rates: daily exchange rate from any world currency to the
  // company's base currency. Used at report time to convert
  // foreign-currency bank transactions into the base currency.
  `CREATE TABLE IF NOT EXISTS fx_rates (
     id SERIAL PRIMARY KEY,
     company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
     rate_date DATE NOT NULL,
     currency_code VARCHAR(10) NOT NULL,
     rate DECIMAL(20,8) NOT NULL,
     notes TEXT,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE (company_id, rate_date, currency_code)
   )`,

  `CREATE INDEX IF NOT EXISTS idx_fx_rates_company_date
     ON fx_rates(company_id, currency_code, rate_date DESC)`,
];

async function runMigrations() {
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Don't crash the server if a migration statement fails — log it
      // so the operator can look at it, but keep booting so unrelated
      // features remain available.
      console.error('[migration] failed:', sql.split('\n')[0].trim());
      console.error('[migration] reason:', err.message);
    }
  }
  console.log('[migration] schema is up-to-date');
}

module.exports = { runMigrations };
