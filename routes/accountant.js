// ============================================================
// routes/accountant.js  –  Chart of Accounts, Journals,
//                          Budgets, FX Adjustments, Bulk Update
// ============================================================

const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const auth    = require('../middleware/auth');

// ─── Default Chart of Accounts seed data ───────────────────
const DEFAULT_COA = [
  { code:'1000', name:'Cash',                     type:'Asset',     category:'Current Asset',       balance:0 },
  { code:'1010', name:'Petty Cash',               type:'Asset',     category:'Current Asset',       balance:0 },
  { code:'1100', name:'Accounts Receivable',      type:'Asset',     category:'Current Asset',       balance:0 },
  { code:'1200', name:'Inventory',                type:'Asset',     category:'Current Asset',       balance:0 },
  { code:'1300', name:'Prepaid Expenses',         type:'Asset',     category:'Current Asset',       balance:0 },
  { code:'1500', name:'Equipment',                type:'Asset',     category:'Fixed Asset',         balance:0 },
  { code:'1510', name:'Accumulated Depreciation', type:'Asset',     category:'Fixed Asset',         balance:0 },
  { code:'2000', name:'Accounts Payable',         type:'Liability', category:'Current Liability',   balance:0 },
  { code:'2100', name:'Accrued Expenses',         type:'Liability', category:'Current Liability',   balance:0 },
  { code:'2200', name:'Sales Tax Payable',        type:'Liability', category:'Current Liability',   balance:0 },
  { code:'2300', name:'Deferred Revenue',         type:'Liability', category:'Current Liability',   balance:0 },
  { code:'2500', name:'Long-term Loan',           type:'Liability', category:'Long-term Liability', balance:0 },
  { code:'3000', name:"Owner's Capital",          type:'Equity',    category:'Equity',              balance:0 },
  { code:'3050', name:'Opening Balance Equity',   type:'Equity',    category:'Equity',              balance:0 },
  { code:'3100', name:'Retained Earnings',        type:'Equity',    category:'Equity',              balance:0 },
  { code:'3200', name:'Drawings',                 type:'Equity',    category:'Equity',              balance:0 },
  { code:'4000', name:'Sales Revenue',            type:'Revenue',   category:'Operating Revenue',   balance:0 },
  { code:'4100', name:'Service Revenue',          type:'Revenue',   category:'Operating Revenue',   balance:0 },
  { code:'4900', name:'Other Income',             type:'Revenue',   category:'Other Revenue',       balance:0 },
  { code:'5000', name:'Cost of Goods Sold',       type:'Expense',   category:'Cost of Sales',       balance:0 },
  { code:'5100', name:'Salaries & Wages',         type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5200', name:'Office Supplies',          type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5300', name:'Software & Subscriptions', type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5400', name:'Marketing & Advertising',  type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5500', name:'Rent',                     type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5600', name:'Utilities',                type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5700', name:'Depreciation Expense',     type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5800', name:'Bank Charges',             type:'Expense',   category:'Operating Expense',   balance:0 },
  { code:'5900', name:'Travel & Entertainment',   type:'Expense',   category:'Operating Expense',   balance:0 },
];

async function seedDefaultCOA(companyId, client) {
  for (const acc of DEFAULT_COA) {
    await client.query(
      `INSERT INTO chart_of_accounts (company_id, code, name, type, category, balance, is_system)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)
       ON CONFLICT (company_id, code) DO NOTHING`,
      [companyId, acc.code, acc.name, acc.type, acc.category, acc.balance]
    );
  }
}

// ── Auto-generate the next account code for a given type ──────────
// Asset → 1xxx, Liability → 2xxx, Equity → 3xxx, Revenue → 4xxx, Expense → 5xxx
const CODE_PREFIX = { Asset: '1', Liability: '2', Equity: '3', Revenue: '4', Expense: '5' };

async function nextAccountCode(client, companyId, type) {
  const prefix = CODE_PREFIX[type] || '9';
  const result = await client.query(
    `SELECT code FROM chart_of_accounts
     WHERE company_id = $1 AND code LIKE $2
     ORDER BY code DESC LIMIT 1`,
    [companyId, prefix + '%']
  );
  let next;
  if (!result.rows.length) {
    next = parseInt(prefix + '000', 10) + 10;
  } else {
    next = parseInt(result.rows[0].code, 10) + 10;
  }
  // collision guard
  while (true) {
    const exists = await client.query(
      `SELECT 1 FROM chart_of_accounts WHERE company_id = $1 AND code = $2`,
      [companyId, String(next)]
    );
    if (!exists.rows.length) return String(next);
    next += 10;
  }
}

// ── Opening-balance double entry ──────────────────────────────────
// When a CoA account is created/updated with an opening balance, post a
// balanced journal entry against the Opening Balance Equity account so
// the figure flows into Balance Sheet / Trial Balance via the ledger.
//
// Reference: 'OPN-<accountId>'. Re-posted whenever the opening balance
// changes; removed when the account is deleted.

async function ensureOpeningBalanceEquity(client, companyId) {
  const existing = await client.query(
    `SELECT id, code, name, type FROM chart_of_accounts
     WHERE company_id = $1 AND code = '3050' LIMIT 1`,
    [companyId]
  );
  if (existing.rows.length) return existing.rows[0];
  const inserted = await client.query(
    `INSERT INTO chart_of_accounts (company_id, code, name, type, category, balance, is_system)
     VALUES ($1, '3050', 'Opening Balance Equity', 'Equity', 'Equity', 0, TRUE)
     ON CONFLICT (company_id, code) DO UPDATE SET updated_at = NOW()
     RETURNING id, code, name, type`,
    [companyId]
  );
  return inserted.rows[0];
}

async function deleteOpeningJournal(client, companyId, accountId) {
  const reference = `OPN-${accountId}`;
  const existing = await client.query(
    `SELECT je.id AS journal_id, jl.account_code, jl.type AS line_type, jl.amount
     FROM journal_entries je
     LEFT JOIN journal_lines jl ON jl.journal_id = je.id
     WHERE je.company_id = $1 AND je.reference = $2`,
    [companyId, reference]
  );
  if (!existing.rows.length || !existing.rows[0].journal_id) return;
  const journalId = existing.rows[0].journal_id;

  for (const ln of existing.rows) {
    if (!ln.account_code) continue;
    const accRes = await client.query(
      `SELECT type FROM chart_of_accounts WHERE company_id = $1 AND code = $2`,
      [companyId, ln.account_code]
    );
    if (!accRes.rows.length) continue;
    const isDebitNormal = ['Asset', 'Expense'].includes(accRes.rows[0].type);
    const wasDebit = ln.line_type === 'debit';
    const delta = (wasDebit === isDebitNormal) ? parseFloat(ln.amount) : -parseFloat(ln.amount);
    await client.query(
      `UPDATE chart_of_accounts SET balance = balance - $1, updated_at = NOW()
       WHERE company_id = $2 AND code = $3`,
      [delta, companyId, ln.account_code]
    );
  }
  await client.query(`DELETE FROM journal_entries WHERE id = $1`, [journalId]);
}

async function postOpeningJournal(client, companyId, account, openingBalance, asOfDate) {
  const amount = parseFloat(openingBalance);
  if (!amount || isNaN(amount)) return;

  await deleteOpeningJournal(client, companyId, account.id);
  const obe = await ensureOpeningBalanceEquity(client, companyId);
  if (!obe || obe.id === account.id) return;  // can't offset OBE against itself

  // Debit-normal accounts (Asset, Expense) get debited for positive opening
  // balances; credit-normal (Liability, Equity, Revenue) get credited.
  const isDebitNormal = ['Asset', 'Expense'].includes(account.type);
  const accSide = (amount >= 0)
    ? (isDebitNormal ? 'debit' : 'credit')
    : (isDebitNormal ? 'credit' : 'debit');
  const obeSide = accSide === 'debit' ? 'credit' : 'debit';
  const absAmt = Math.abs(amount);
  const reference = `OPN-${account.id}`;
  const date = asOfDate || new Date().toISOString().split('T')[0];

  const je = await client.query(
    `INSERT INTO journal_entries (company_id, reference, date, description, status)
     VALUES ($1, $2, $3, $4, 'posted') RETURNING id`,
    [companyId, reference, date, `Opening balance — ${account.name}`]
  );
  const journalId = je.rows[0].id;

  await client.query(
    `INSERT INTO journal_lines (journal_id, account_code, account_name, type, amount)
     VALUES ($1, $2, $3, $4, $5)`,
    [journalId, account.code, account.name, accSide, absAmt]
  );
  await client.query(
    `INSERT INTO journal_lines (journal_id, account_code, account_name, type, amount)
     VALUES ($1, $2, $3, $4, $5)`,
    [journalId, obe.code, obe.name, obeSide, absAmt]
  );

  // Apply CoA balance deltas (mirrors journal-post handler).
  const accIsDebit = accSide === 'debit';
  const accDelta = (accIsDebit === isDebitNormal) ? absAmt : -absAmt;
  await client.query(
    `UPDATE chart_of_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
    [accDelta, account.id]
  );

  const obeIsDebitNormal = ['Asset', 'Expense'].includes(obe.type);
  const obeIsDebit = obeSide === 'debit';
  const obeDelta = (obeIsDebit === obeIsDebitNormal) ? absAmt : -absAmt;
  await client.query(
    `UPDATE chart_of_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
    [obeDelta, obe.id]
  );
}

// ═══════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ═══════════════════════════════════════════════════════════════

// GET /api/accountant/accounts
router.get('/accounts', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    // Auto-seed default chart of accounts if company has none yet
    const check = await client.query(
      'SELECT id FROM chart_of_accounts WHERE company_id = $1 LIMIT 1',
      [req.companyId]
    );
    if (check.rows.length === 0) {
      await seedDefaultCOA(req.companyId, client);
    }

    const result = await client.query(
      `SELECT * FROM chart_of_accounts WHERE company_id = $1 ORDER BY code ASC`,
      [req.companyId]
    );
    res.json({ accounts: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching accounts', error: err.message });
  } finally { client.release(); }
});

// POST /api/accountant/accounts
router.post('/accounts', auth, async (req, res) => {
  let { code, name, type, category, balance = 0, opening_balance_date } = req.body;
  const opening = parseFloat(balance) || 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-generate the code when blank, based on type.
    if (!code || !String(code).trim()) {
      code = await nextAccountCode(client, req.companyId, type);
    }

    // The opening balance is materialised as a posted journal entry against
    // Opening Balance Equity, so we insert with balance=0 and let the
    // journal-posting helper update both sides.
    const result = await client.query(
      `INSERT INTO chart_of_accounts (company_id, code, name, type, category, balance)
       VALUES ($1,$2,$3,$4,$5,0) RETURNING *`,
      [req.companyId, code, name, type, category]
    );
    const account = result.rows[0];

    if (opening !== 0) {
      await postOpeningJournal(client, req.companyId, account, opening, opening_balance_date);
    }

    await client.query('COMMIT');
    // Re-fetch to return the post-journal balance.
    const fresh = await pool.query(`SELECT * FROM chart_of_accounts WHERE id = $1`, [account.id]);
    res.status(201).json({ account: fresh.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ message: 'Account code already exists' });
    res.status(500).json({ message: 'Error creating account', error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/accountant/accounts/:id
router.put('/accounts/:id', auth, async (req, res) => {
  const { code, name, type, category, balance, opening_balance_date } = req.body;
  const newOpening = parseFloat(balance) || 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read existing opening-journal amount so we know the delta to re-post.
    const before = await client.query(
      `SELECT * FROM chart_of_accounts WHERE id = $1 AND company_id = $2`,
      [req.params.id, req.companyId]
    );
    if (!before.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Account not found' });
    }

    const result = await client.query(
      `UPDATE chart_of_accounts SET code=$1, name=$2, type=$3, category=$4, updated_at=NOW()
       WHERE id=$5 AND company_id=$6 RETURNING *`,
      [code, name, type, category, req.params.id, req.companyId]
    );
    const account = result.rows[0];

    // Re-post the opening-balance journal at the new amount. The helper
    // reverses the previous journal before posting the new one, so the
    // CoA balance always reflects the intended opening figure.
    await postOpeningJournal(client, req.companyId, account, newOpening, opening_balance_date);

    await client.query('COMMIT');
    const fresh = await pool.query(`SELECT * FROM chart_of_accounts WHERE id = $1`, [account.id]);
    res.json({ account: fresh.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error updating account', error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/accountant/accounts/:id
router.delete('/accounts/:id', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await deleteOpeningJournal(client, req.companyId, req.params.id);
    await client.query(
      `DELETE FROM chart_of_accounts WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.companyId]
    );
    await client.query('COMMIT');
    res.json({ message: 'Account deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error deleting account', error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/accountant/accounts/next-code?type=Asset
// Returns the next auto-generated code for the requested type.
router.get('/accounts/next-code', auth, async (req, res) => {
  const type = req.query.type || 'Asset';
  const client = await pool.connect();
  try {
    const code = await nextAccountCode(client, req.companyId, type);
    res.json({ code });
  } catch (err) {
    res.status(500).json({ message: 'Error generating code', error: err.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// MANUAL JOURNALS
// ═══════════════════════════════════════════════════════════════

// GET /api/accountant/journals
router.get('/journals', auth, async (req, res) => {
  try {
    const entries = await pool.query(
      `SELECT * FROM journal_entries WHERE company_id=$1 ORDER BY date DESC, created_at DESC`,
      [req.companyId]
    );
    // Attach lines to each entry
    const journals = await Promise.all(entries.rows.map(async (je) => {
      const lines = await pool.query(
        `SELECT * FROM journal_lines WHERE journal_id=$1 ORDER BY id ASC`,
        [je.id]
      );
      return {
        ...je,
        lines: lines.rows.map(l => ({
          id:           l.id,
          account_code: l.account_code,
          account_name: l.account_name,
          type:         l.type,
          amount:       parseFloat(l.amount),
        })),
      };
    }));
    res.json({ journals });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching journals', error: err.message });
  }
});

// POST /api/accountant/journals
router.post('/journals', auth, async (req, res) => {
  const { reference, date, description, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const je = await client.query(
      `INSERT INTO journal_entries (company_id, reference, date, description, status)
       VALUES ($1,$2,$3,$4,'draft') RETURNING *`,
      [req.companyId, reference, date, description]
    );
    const journalId = je.rows[0].id;
    for (const line of lines) {
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_code, account_name, type, amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [journalId, line.account_code, line.account_name, line.type, line.amount]
      );
    }
    await client.query('COMMIT');
    // Return full journal with lines
    const linesResult = await pool.query('SELECT * FROM journal_lines WHERE journal_id=$1', [journalId]);
    res.status(201).json({ journal: { ...je.rows[0], lines: linesResult.rows } });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ message: 'Reference already exists for this company' });
    res.status(500).json({ message: 'Error creating journal', error: err.message });
  } finally { client.release(); }
});

// PUT /api/accountant/journals/:id
router.put('/journals/:id', auth, async (req, res) => {
  const { reference, date, description, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    // Only allow editing draft journals
    const check = await client.query(
      `SELECT status FROM journal_entries WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.companyId]
    );
    if (!check.rows.length) return res.status(404).json({ message: 'Journal not found' });
    if (check.rows[0].status === 'posted') return res.status(400).json({ message: 'Cannot edit a posted journal' });

    await client.query('BEGIN');
    await client.query(
      `UPDATE journal_entries SET reference=$1, date=$2, description=$3, updated_at=NOW()
       WHERE id=$4 AND company_id=$5`,
      [reference, date, description, req.params.id, req.companyId]
    );
    // Replace lines
    await client.query('DELETE FROM journal_lines WHERE journal_id=$1', [req.params.id]);
    for (const line of lines) {
      await client.query(
        `INSERT INTO journal_lines (journal_id, account_code, account_name, type, amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, line.account_code, line.account_name, line.type, line.amount]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Journal updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error updating journal', error: err.message });
  } finally { client.release(); }
});

// POST /api/accountant/journals/:id/post
router.post('/journals/:id/post', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    const je = await client.query(
      `SELECT je.*, json_agg(jl.*) AS lines FROM journal_entries je
       LEFT JOIN journal_lines jl ON jl.journal_id = je.id
       WHERE je.id=$1 AND je.company_id=$2 GROUP BY je.id`,
      [req.params.id, req.companyId]
    );
    if (!je.rows.length) return res.status(404).json({ message: 'Journal not found' });
    if (je.rows[0].status === 'posted') return res.status(400).json({ message: 'Already posted' });

    await client.query('BEGIN');
    await client.query(
      `UPDATE journal_entries SET status='posted', updated_at=NOW() WHERE id=$1`,
      [req.params.id]
    );
    // Update chart_of_accounts balances
    for (const line of (je.rows[0].lines || [])) {
      if (!line || !line.account_code) continue;
      const isDebitNormal = ['Asset','Expense'];
      // Fetch account type to decide direction
      const acc = await client.query(
        `SELECT type FROM chart_of_accounts WHERE company_id=$1 AND code=$2`,
        [req.companyId, line.account_code]
      );
      if (!acc.rows.length) continue;
      const isDebit = line.type === 'debit';
      const normalDebit = isDebitNormal.includes(acc.rows[0].type);
      const delta = (isDebit === normalDebit) ? parseFloat(line.amount) : -parseFloat(line.amount);
      await client.query(
        `UPDATE chart_of_accounts SET balance = balance + $1, updated_at=NOW()
         WHERE company_id=$2 AND code=$3`,
        [delta, req.companyId, line.account_code]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Journal posted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error posting journal', error: err.message });
  } finally { client.release(); }
});

// DELETE /api/accountant/journals/:id
router.delete('/journals/:id', auth, async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT status FROM journal_entries WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.companyId]
    );
    if (!check.rows.length) return res.status(404).json({ message: 'Journal not found' });
    if (check.rows[0].status === 'posted') return res.status(400).json({ message: 'Cannot delete a posted journal' });
    await pool.query(`DELETE FROM journal_entries WHERE id=$1 AND company_id=$2`, [req.params.id, req.companyId]);
    res.json({ message: 'Journal deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting journal', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BUDGETS
// ═══════════════════════════════════════════════════════════════

// GET /api/accountant/budgets
router.get('/budgets', auth, async (req, res) => {
  try {
    const budgets = await pool.query(
      `SELECT * FROM budgets WHERE company_id=$1 ORDER BY fiscal_year DESC, created_at DESC`,
      [req.companyId]
    );
    const result = await Promise.all(budgets.rows.map(async (b) => {
      const lines = await pool.query(
        `SELECT * FROM budget_lines WHERE budget_id=$1 ORDER BY id ASC`,
        [b.id]
      );
      return {
        ...b,
        lines: lines.rows.map(l => ({
          id:            l.id,
          account_code:  l.account_code,
          account_name:  l.account_name,
          category:      l.category,
          monthly:       [l.jan,l.feb,l.mar,l.apr,l.may,l.jun,l.jul,l.aug,l.sep,l.oct,l.nov,l.dec].map(v => parseFloat(v||0)),
          annual_total:  parseFloat(l.annual_total || 0),
          actual_to_date:parseFloat(l.actual_to_date || 0),
        })),
      };
    }));
    res.json({ budgets: result });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching budgets', error: err.message });
  }
});

// POST /api/accountant/budgets
router.post('/budgets', auth, async (req, res) => {
  const { fiscal_year, name, lines = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const b = await client.query(
      `INSERT INTO budgets (company_id, fiscal_year, name, status) VALUES ($1,$2,$3,'active') RETURNING *`,
      [req.companyId, fiscal_year, name]
    );
    const budgetId = b.rows[0].id;
    const COLS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    for (const line of lines) {
      const monthly = line.monthly || Array(12).fill(0).map(() => Math.round((parseFloat(line.annual_total)||0)/12));
      await client.query(
        `INSERT INTO budget_lines
           (budget_id,account_code,account_name,category,jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec,actual_to_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [budgetId, line.account_code, line.account_name, line.category,
          ...monthly.map(v => parseFloat(v)||0), parseFloat(line.actual_to_date)||0]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ budget: { ...b.rows[0], lines } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error creating budget', error: err.message });
  } finally { client.release(); }
});

// PUT /api/accountant/budgets/:id
router.put('/budgets/:id', auth, async (req, res) => {
  const { fiscal_year, name, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE budgets SET fiscal_year=$1, name=$2, status=$3, updated_at=NOW()
       WHERE id=$4 AND company_id=$5 RETURNING *`,
      [fiscal_year, name, status, req.params.id, req.companyId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Budget not found' });
    res.json({ budget: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error updating budget', error: err.message });
  }
});

// DELETE /api/accountant/budgets/:id
router.delete('/budgets/:id', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM budgets WHERE id=$1 AND company_id=$2`, [req.params.id, req.companyId]);
    res.json({ message: 'Budget deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting budget', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FX ADJUSTMENTS
// ═══════════════════════════════════════════════════════════════

// GET /api/accountant/fx-adjustments
router.get('/fx-adjustments', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM fx_adjustments WHERE company_id=$1 ORDER BY date DESC, created_at DESC`,
      [req.companyId]
    );
    res.json({
      adjustments: result.rows.map(r => ({
        ...r,
        exchange_rate:     parseFloat(r.exchange_rate),
        adjustment_amount: parseFloat(r.adjustment_amount),
        affected_accounts: r.affected_accounts ? r.affected_accounts.split(',').map(s => s.trim()) : [],
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching FX adjustments', error: err.message });
  }
});

// POST /api/accountant/fx-adjustments
router.post('/fx-adjustments', auth, async (req, res) => {
  const { date, from_currency, to_currency, exchange_rate, affected_accounts = [], adjustment_amount, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO fx_adjustments
         (company_id, date, from_currency, to_currency, exchange_rate, affected_accounts, adjustment_amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.companyId, date, from_currency, to_currency, exchange_rate,
        Array.isArray(affected_accounts) ? affected_accounts.join(',') : affected_accounts,
        adjustment_amount, notes]
    );
    res.status(201).json({ adjustment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error creating FX adjustment', error: err.message });
  }
});

// PUT /api/accountant/fx-adjustments/:id
router.put('/fx-adjustments/:id', auth, async (req, res) => {
  const { date, from_currency, to_currency, exchange_rate, affected_accounts = [], adjustment_amount, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE fx_adjustments
       SET date=$1, from_currency=$2, to_currency=$3, exchange_rate=$4,
           affected_accounts=$5, adjustment_amount=$6, notes=$7
       WHERE id=$8 AND company_id=$9 RETURNING *`,
      [date, from_currency, to_currency, exchange_rate,
        Array.isArray(affected_accounts) ? affected_accounts.join(',') : affected_accounts,
        adjustment_amount, notes, req.params.id, req.companyId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Adjustment not found' });
    res.json({ adjustment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error updating FX adjustment', error: err.message });
  }
});

// DELETE /api/accountant/fx-adjustments/:id
router.delete('/fx-adjustments/:id', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM fx_adjustments WHERE id=$1 AND company_id=$2`, [req.params.id, req.companyId]);
    res.json({ message: 'Adjustment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting FX adjustment', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BULK UPDATE
// ═══════════════════════════════════════════════════════════════

// GET /api/bulk/:type   (invoices | expenses)
router.get('/:type(invoices|expenses)', auth, async (req, res) => {
  const { type } = req.params;
  try {
    let result;
    if (type === 'invoices') {
      result = await pool.query(
        `SELECT i.id, i.invoice_number, i.invoice_date, i.total_amount, i.status,
                c.name AS customer_name
         FROM invoices i
         LEFT JOIN customers c ON i.customer_id = c.id
         WHERE i.company_id = $1 ORDER BY i.invoice_date DESC`,
        [req.companyId]
      );
    } else {
      result = await pool.query(
        `SELECT e.id, e.expense_number, e.expense_date, e.description, e.amount, e.category,
                v.name AS vendor_name
         FROM expenses e
         LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.company_id = $1 ORDER BY e.expense_date DESC`,
        [req.companyId]
      );
    }
    res.json({ records: result.rows });
  } catch (err) {
    res.status(500).json({ message: `Error fetching ${type}`, error: err.message });
  }
});

// POST /api/bulk/apply
router.post('/bulk-apply', auth, async (req, res) => {
  const { type, ids, action, value } = req.body;
  if (!ids || !ids.length) return res.status(400).json({ message: 'No records selected' });

  const placeholders = ids.map((_, i) => `$${i + 3}`).join(',');

  try {
    let query;
    if (type === 'invoices' && action === 'status') {
      query = `UPDATE invoices SET status=$1, updated_at=NOW()
               WHERE company_id=$2 AND id IN (${placeholders})`;
    } else if (type === 'expenses' && action === 'category') {
      query = `UPDATE expenses SET category=$1, updated_at=NOW()
               WHERE company_id=$2 AND id IN (${placeholders})`;
    } else {
      return res.status(400).json({ message: 'Unsupported bulk action' });
    }
    const result = await pool.query(query, [value, req.companyId, ...ids]);
    res.json({ updated: result.rowCount });
  } catch (err) {
    res.status(500).json({ message: 'Error applying bulk update', error: err.message });
  }
});

module.exports = router;
