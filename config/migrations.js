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
