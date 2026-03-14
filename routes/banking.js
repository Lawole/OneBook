// ============================================
// routes/banking.js - Banking & Reconciliation
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── CSV Parser ──────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows = lines.slice(1).map(l => parseCSVLine(l));

  // Detect columns
  const col = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
  const dateCol   = col(['date', 'transdate', 'valuedate', 'postingdate']);
  const descCol   = col(['description', 'narration', 'particulars', 'details', 'memo', 'narrative', 'transactiondesc', 'desc']);
  const debitCol  = col(['debit', 'withdrawal', 'dr', 'out', 'payment', 'debitamount']);
  const creditCol = col(['credit', 'deposit', 'cr', 'in', 'receipt', 'creditamount']);
  const amtCol    = col(['amount', 'transactionamount', 'value']);
  const refCol    = col(['ref', 'cheque', 'check', 'chequeno', 'refno', 'reference']);

  if (dateCol === -1) return [];

  return rows.map(row => {
    const dateRaw = row[dateCol] || '';
    const desc    = row[descCol !== -1 ? descCol : 1] || 'No description';
    const ref     = refCol !== -1 ? (row[refCol] || '') : '';

    let amount = 0;
    let type = 'credit';

    if (debitCol !== -1 || creditCol !== -1) {
      const debitVal  = parseFloat((row[debitCol] || '').replace(/[^0-9.-]/g, '')) || 0;
      const creditVal = parseFloat((row[creditCol] || '').replace(/[^0-9.-]/g, '')) || 0;
      if (debitVal > 0) { amount = debitVal; type = 'debit'; }
      else if (creditVal > 0) { amount = creditVal; type = 'credit'; }
    } else if (amtCol !== -1) {
      const raw = parseFloat((row[amtCol] || '').replace(/[^0-9.-]/g, '')) || 0;
      amount = Math.abs(raw);
      type = raw < 0 ? 'debit' : 'credit';
    }

    // Parse date flexibly
    let parsedDate = null;
    const dStr = dateRaw.replace(/[^0-9/\-. ]/g, '').trim();
    if (dStr) {
      const d = new Date(dStr);
      if (!isNaN(d)) parsedDate = d.toISOString().split('T')[0];
    }

    return { date: parsedDate, description: desc.substring(0, 490), amount, type, reference: ref };
  }).filter(r => r.date && r.amount > 0);
}

// ── Bank Accounts ────────────────────────────

// GET /banking/accounts
router.get('/accounts', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ba.*,
         (SELECT COUNT(*) FROM bank_transactions bt WHERE bt.bank_account_id = ba.id) as total_transactions,
         (SELECT COUNT(*) FROM bank_transactions bt WHERE bt.bank_account_id = ba.id AND bt.status = 'unmatched') as unmatched_count
       FROM bank_accounts ba WHERE ba.company_id = $1 ORDER BY ba.created_at DESC`,
      [req.companyId]
    );
    res.json({ accounts: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching accounts', error: err.message });
  }
});

// POST /banking/accounts
router.post('/accounts', authMiddleware, async (req, res) => {
  const { name, bank_name, account_number, account_type, current_balance, currency_code } = req.body;
  if (!name) return res.status(400).json({ message: 'Account name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO bank_accounts (company_id, name, bank_name, account_number, account_type, current_balance, currency_code, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [req.companyId, name, bank_name || null, account_number || null, account_type || 'checking', parseFloat(current_balance) || 0, currency_code || 'USD']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error creating account', error: err.message });
  }
});

// PUT /banking/accounts/:id
router.put('/accounts/:id', authMiddleware, async (req, res) => {
  const { name, bank_name, account_number, account_type, current_balance, currency_code } = req.body;
  try {
    const result = await pool.query(
      `UPDATE bank_accounts SET name=$1, bank_name=$2, account_number=$3, account_type=$4,
       current_balance=$5, currency_code=$6, updated_at=NOW()
       WHERE id=$7 AND company_id=$8 RETURNING *`,
      [name, bank_name || null, account_number || null, account_type || 'checking', parseFloat(current_balance) || 0, currency_code || 'USD', req.params.id, req.companyId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Account not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error updating account', error: err.message });
  }
});

// DELETE /banking/accounts/:id
router.delete('/accounts/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM bank_accounts WHERE id=$1 AND company_id=$2', [req.params.id, req.companyId]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting account', error: err.message });
  }
});

// ── Import Statement ─────────────────────────

// POST /banking/accounts/:id/import
router.post('/accounts/:id/import', authMiddleware, upload.single('statement'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  try {
    // Verify account belongs to company
    const acctResult = await pool.query(
      'SELECT * FROM bank_accounts WHERE id=$1 AND company_id=$2',
      [req.params.id, req.companyId]
    );
    if (!acctResult.rows.length) return res.status(404).json({ message: 'Account not found' });

    const text = req.file.buffer.toString('utf-8');
    const transactions = parseCSV(text);

    if (!transactions.length) {
      return res.status(400).json({ message: 'No valid transactions found. Check your CSV format (needs Date, Description, and Deposit/Withdrawal or Amount columns).' });
    }

    let imported = 0;
    let skipped = 0;

    for (const txn of transactions) {
      // Skip duplicates (same account, date, amount, description)
      const dup = await pool.query(
        'SELECT id FROM bank_transactions WHERE bank_account_id=$1 AND date=$2 AND amount=$3 AND description=$4',
        [req.params.id, txn.date, txn.amount, txn.description]
      );
      if (dup.rows.length > 0) { skipped++; continue; }

      await pool.query(
        `INSERT INTO bank_transactions (bank_account_id, company_id, date, description, amount, type, status, reference, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'unmatched',$7,NOW())`,
        [req.params.id, req.companyId, txn.date, txn.description, txn.amount, txn.type, txn.reference || null]
      );
      imported++;
    }

    res.json({ message: `Imported ${imported} transactions (${skipped} duplicates skipped)`, imported, skipped });
  } catch (err) {
    res.status(500).json({ message: 'Error importing statement', error: err.message });
  }
});

// ── Transactions ──────────────────────────────

// GET /banking/transactions?account_id=&status=&page=
router.get('/transactions', authMiddleware, async (req, res) => {
  const { account_id, status, page = 1, per_page = 50 } = req.query;
  const offset = (page - 1) * per_page;

  try {
    let where = 'WHERE bt.company_id = $1';
    const params = [req.companyId];
    let idx = 2;

    if (account_id) { where += ` AND bt.bank_account_id = $${idx++}`; params.push(account_id); }
    if (status && status !== 'all') { where += ` AND bt.status = $${idx++}`; params.push(status); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM bank_transactions bt ${where}`, params);

    const result = await pool.query(
      `SELECT bt.*, ba.name as account_name, ba.currency_code,
              coa.name as coa_account_name, coa.code as coa_account_code,
              rf.name as receipt_file_name, rf.url as receipt_file_url,
              rf.reference as receipt_reference, rf.mime_type as receipt_mime_type
       FROM bank_transactions bt
       LEFT JOIN bank_accounts ba ON bt.bank_account_id = ba.id
       LEFT JOIN chart_of_accounts coa ON bt.coa_account_id = coa.id
       LEFT JOIN files rf ON bt.receipt_file_id = rf.id
       ${where}
       ORDER BY bt.date DESC, bt.id DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, per_page, offset]
    );

    // Summary stats (includes categorized)
    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status='unmatched') as unmatched,
         COUNT(*) FILTER (WHERE status='matched') as matched,
         COUNT(*) FILTER (WHERE status='excluded') as excluded,
         COUNT(*) FILTER (WHERE status='categorized') as categorized,
         COALESCE(SUM(amount) FILTER (WHERE type='credit'), 0) as total_credits,
         COALESCE(SUM(amount) FILTER (WHERE type='debit'), 0) as total_debits
       FROM bank_transactions bt ${where}`,
      params
    );

    res.json({
      transactions: result.rows,
      total: parseInt(countResult.rows[0].count),
      stats: statsResult.rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching transactions', error: err.message });
  }
});

// PUT /banking/transactions/:id  (match, exclude, categorize, update notes, link receipt)
router.put('/transactions/:id', authMiddleware, async (req, res) => {
  const { status, matched_type, matched_id, category, notes, coa_account_id, receipt_file_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE bank_transactions
       SET status=$1, matched_type=$2, matched_id=$3, category=$4, notes=$5,
           coa_account_id=$6, receipt_file_id=COALESCE($7, receipt_file_id)
       WHERE id=$8 AND company_id=$9 RETURNING *`,
      [status, matched_type || null, matched_id || null, category || null, notes || null,
       coa_account_id || null, receipt_file_id || null, req.params.id, req.companyId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error updating transaction', error: err.message });
  }
});

// DELETE /banking/transactions/:id
router.delete('/transactions/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM bank_transactions WHERE id=$1 AND company_id=$2', [req.params.id, req.companyId]);
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting transaction', error: err.message });
  }
});

// ── Transaction Splits (Itemise) ──────────────

// GET /banking/transactions/:id/splits
router.get('/transactions/:id/splits', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, c.name as account_name, c.code as account_code
       FROM bank_transaction_splits s
       LEFT JOIN chart_of_accounts c ON s.coa_account_id = c.id
       WHERE s.bank_transaction_id = $1 AND s.company_id = $2
       ORDER BY s.id ASC`,
      [req.params.id, req.companyId]
    );
    res.json({ splits: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching splits', error: err.message });
  }
});

// POST /banking/transactions/:id/splits  (replaces all existing splits)
router.post('/transactions/:id/splits', authMiddleware, async (req, res) => {
  const { splits } = req.body;
  if (!Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ message: 'splits array is required' });
  }

  // Verify transaction belongs to this company
  const txnCheck = await pool.query(
    'SELECT * FROM bank_transactions WHERE id=$1 AND company_id=$2',
    [req.params.id, req.companyId]
  );
  if (!txnCheck.rows.length) return res.status(404).json({ message: 'Transaction not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Replace all existing splits
    await client.query('DELETE FROM bank_transaction_splits WHERE bank_transaction_id=$1', [req.params.id]);

    for (const split of splits) {
      await client.query(
        `INSERT INTO bank_transaction_splits (bank_transaction_id, company_id, coa_account_id, amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, req.companyId, split.coa_account_id || null, parseFloat(split.amount), split.description || '']
      );
    }

    // Mark transaction as categorized
    await client.query(
      `UPDATE bank_transactions SET status='categorized', coa_account_id=NULL WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.companyId]
    );

    await client.query('COMMIT');
    res.json({ message: 'Splits saved', count: splits.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Error saving splits', error: err.message });
  } finally {
    client.release();
  }
});

// ── Match Suggestions ─────────────────────────

// GET /banking/match-suggestions/:id  (find invoices/expenses close to a transaction by amount AND description)
router.get('/match-suggestions/:id', authMiddleware, async (req, res) => {
  try {
    const txnResult = await pool.query(
      'SELECT * FROM bank_transactions WHERE id=$1 AND company_id=$2',
      [req.params.id, req.companyId]
    );
    if (!txnResult.rows.length) return res.status(404).json({ message: 'Transaction not found' });
    const txn = txnResult.rows[0];

    // Extract a meaningful keyword from the description for soft matching
    const words = txn.description.split(/\s+/).filter(w => w.length > 3);
    const descPattern = words.length > 0 ? `%${words[0]}%` : null;

    let suggestions = [];

    if (txn.type === 'credit') {
      // Match to invoices (money coming in) — by amount proximity OR description keyword
      const invoices = await pool.query(
        `SELECT i.id, i.invoice_number as reference, c.name as party, i.total_amount as amount,
                i.invoice_date as date, i.status, 'invoice' as match_type
         FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
         WHERE i.company_id=$1 AND (
           ABS(i.total_amount - $2) / GREATEST($2, 1) < 0.15
           ${descPattern ? 'OR c.name ILIKE $3 OR i.invoice_number ILIKE $3' : ''}
         )
         ORDER BY ABS(i.total_amount - $2) ASC LIMIT 5`,
        descPattern ? [req.companyId, txn.amount, descPattern] : [req.companyId, txn.amount]
      );
      suggestions = invoices.rows;
    } else {
      // Match to expenses (money going out) — by amount proximity OR description keyword
      const expenses = await pool.query(
        `SELECT e.id, e.expense_number as reference, v.name as party, e.amount, e.expense_date as date,
                e.category as status, 'expense' as match_type
         FROM expenses e LEFT JOIN vendors v ON e.vendor_id = v.id
         WHERE e.company_id=$1 AND (
           ABS(e.amount - $2) / GREATEST($2, 1) < 0.15
           ${descPattern ? 'OR v.name ILIKE $3 OR e.expense_number ILIKE $3' : ''}
         )
         ORDER BY ABS(e.amount - $2) ASC LIMIT 5`,
        descPattern ? [req.companyId, txn.amount, descPattern] : [req.companyId, txn.amount]
      );
      suggestions = expenses.rows;
    }

    res.json({ transaction: txn, suggestions });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching suggestions', error: err.message });
  }
});

module.exports = router;
