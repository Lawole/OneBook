// ============================================
// routes/banking.js - Banking & Reconciliation
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Column-detection keywords ─────────────────────────────
const COLUMN_KEYWORDS = {
  date:   ['date', 'transdate', 'valuedate', 'postingdate', 'postdate', 'txndate'],
  desc:   ['description', 'narration', 'particulars', 'details', 'memo',
           'narrative', 'transactiondesc', 'desc', 'remarks', 'transactionremarks'],
  debit:  ['debit', 'withdrawal', 'dr', 'moneyout', 'paidout', 'payment',
           'debitamount', 'withdrawalamount'],
  credit: ['credit', 'deposit', 'cr', 'moneyin', 'paidin', 'receipt',
           'creditamount', 'depositamount'],
  amount: ['amount', 'transactionamount', 'value', 'txnamount'],
  ref:    ['ref', 'cheque', 'check', 'chequeno', 'refno', 'reference',
           'transactionref', 'transactionreference'],
};

const normHeader = (h) =>
  String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Match a normalised header against a list of keywords.
// Short keywords (< 4 chars, e.g. "cr", "dr", "in") match only exactly —
// otherwise "cr" would false-match "description" and "in" would match
// "invoicenumber". Long keywords match as substrings.
function matchesAny(header, keywords) {
  for (const k of keywords) {
    if (k.length < 4) {
      if (header === k) return true;
    } else if (header.includes(k)) {
      return true;
    }
  }
  return false;
}

function detectColumns(headers) {
  const findCol = (keys) => headers.findIndex((h) => matchesAny(h, keys));

  return {
    date:   findCol(COLUMN_KEYWORDS.date),
    desc:   findCol(COLUMN_KEYWORDS.desc),
    debit:  findCol(COLUMN_KEYWORDS.debit),
    credit: findCol(COLUMN_KEYWORDS.credit),
    amount: findCol(COLUMN_KEYWORDS.amount),
    ref:    findCol(COLUMN_KEYWORDS.ref),
  };
}

// ── Robust CSV Parser (handles multi-line quoted fields) ──
// Returns array of arrays (one per row). Never drops rows.
function parseCSVRaw(text) {
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("")
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') {
      row.push(field);
      // Skip fully blank lines
      if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }
  // Flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0].trim() === '')) rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.trim()));
}

// ── Excel Parser (returns 2-D array of first non-empty worksheet) ──
async function parseExcelRaw(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets.find((s) => s.rowCount > 0) || wb.worksheets[0];
  if (!ws) return [];

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1); // Row.values is 1-indexed
    // Convert cells to plain strings — dates stay as Date, numbers as Number
    rows.push(values.map((v) => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return v.toISOString().split('T')[0];
      if (typeof v === 'object' && v.text) return String(v.text);
      if (typeof v === 'object' && v.result !== undefined) return String(v.result);
      return String(v).trim();
    }));
  });
  return rows;
}

// ── Flexible date parsing (multiple formats) ─────────────
function parseFlexibleDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Excel date already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().split('T')[0];
  }

  // Numeric Excel serial (e.g. 44927)
  const asNum = Number(s);
  if (!isNaN(asNum) && asNum > 25000 && asNum < 60000 && Number.isInteger(asNum)) {
    // Excel epoch = 1899-12-30
    const d = new Date(Date.UTC(1899, 11, 30) + asNum * 86400000);
    return isNaN(d) ? null : d.toISOString().split('T')[0];
  }

  // Split into parts by /, -, ., or space
  const parts = s.split(/[\/\-.\s]+/).filter(Boolean);
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

  if (parts.length >= 3) {
    const p0 = parts[0], p1 = parts[1], p2 = parts[2];

    // DD-MMM-YYYY or DD-MMM-YY (e.g. 15-Jan-2024)
    const monKey = p1.substring(0, 3).toLowerCase();
    if (months[monKey]) {
      const day = parseInt(p0, 10);
      let year = parseInt(p2, 10);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      if (day >= 1 && day <= 31 && year >= 1900) {
        const d = new Date(Date.UTC(year, months[monKey] - 1, day));
        return isNaN(d) ? null : d.toISOString().split('T')[0];
      }
    }

    // YYYY-MM-DD or YYYY/MM/DD
    if (p0.length === 4) {
      const y = parseInt(p0,10), m = parseInt(p1,10), day = parseInt(p2,10);
      if (y>=1900 && m>=1 && m<=12 && day>=1 && day<=31) {
        const d = new Date(Date.UTC(y, m - 1, day));
        return isNaN(d) ? null : d.toISOString().split('T')[0];
      }
    }

    // DD/MM/YYYY vs MM/DD/YYYY — assume DD/MM/YYYY (rest-of-world default).
    // If the first part is > 12 it's clearly a day.
    let a = parseInt(p0, 10), b = parseInt(p1, 10);
    let year = parseInt(p2, 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;

    if (a > 12 && b <= 12) {
      // DD/MM/YYYY
      const d = new Date(Date.UTC(year, b - 1, a));
      return isNaN(d) ? null : d.toISOString().split('T')[0];
    }
    if (b > 12 && a <= 12) {
      // MM/DD/YYYY
      const d = new Date(Date.UTC(year, a - 1, b));
      return isNaN(d) ? null : d.toISOString().split('T')[0];
    }
    // Ambiguous: default to DD/MM/YYYY
    if (a >= 1 && a <= 31 && b >= 1 && b <= 12 && year >= 1900) {
      const d = new Date(Date.UTC(year, b - 1, a));
      return isNaN(d) ? null : d.toISOString().split('T')[0];
    }
  }

  // Fallback to JS parser
  const fallback = new Date(s);
  return isNaN(fallback) ? null : fallback.toISOString().split('T')[0];
}

function parseAmount(raw) {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  // Handle (1,234.50) as negative
  const negParen = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return negParen ? -Math.abs(n) : n;
}

// ── Build transactions[] from a raw 2-D grid ─────────────
// Returns { transactions, columns, errors, rawRowCount }
function buildTransactions(rawRows) {
  const errors = [];
  const transactions = [];

  // Look for the header row — first row that contains a "date" column
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const normed = rawRows[i].map(normHeader);
    if (normed.some((h) => COLUMN_KEYWORDS.date.some((k) => h.includes(k)))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      transactions: [],
      columns: null,
      errors: [{
        row: 0,
        reason: 'No header row detected',
        remedy: 'Ensure the first row contains a "Date" column (Date, Trans Date, Value Date, etc.). Remove any preamble rows before the header.',
      }],
      rawRowCount: rawRows.length,
    };
  }

  const headers = rawRows[headerRowIdx].map(normHeader);
  const cols = detectColumns(headers);

  if (cols.date === -1) {
    return {
      transactions: [],
      columns: cols,
      errors: [{
        row: headerRowIdx + 1,
        reason: 'Missing Date column',
        remedy: 'Rename the date column to one of: Date, Transaction Date, Value Date, Posting Date.',
      }],
      rawRowCount: rawRows.length,
    };
  }
  if (cols.desc === -1) {
    errors.push({
      row: headerRowIdx + 1,
      reason: 'Missing Description column',
      remedy: 'Add a column named Description, Narration, Particulars, Details, Memo, or Narrative.',
    });
  }
  if (cols.debit === -1 && cols.credit === -1 && cols.amount === -1) {
    return {
      transactions: [],
      columns: cols,
      errors: [{
        row: headerRowIdx + 1,
        reason: 'No amount column found',
        remedy: 'Include either a single Amount column or separate Debit/Credit (Withdrawal/Deposit) columns.',
      }],
      rawRowCount: rawRows.length,
    };
  }

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    // Skip completely empty rows
    if (!row || row.every((c) => !c || String(c).trim() === '')) continue;

    const rowNo = i + 1; // human-friendly row number

    const dateRaw = row[cols.date] || '';
    const desc    = (cols.desc !== -1 ? row[cols.desc] : row[1]) || '';
    const ref     = cols.ref !== -1 ? (row[cols.ref] || '') : '';

    const date = parseFlexibleDate(dateRaw);
    if (!date) {
      errors.push({
        row: rowNo,
        reason: `Cannot parse date "${dateRaw}"`,
        remedy: 'Use formats such as DD/MM/YYYY, YYYY-MM-DD or DD-MMM-YYYY (e.g. 15-Jan-2024).',
      });
      continue;
    }

    let amount = 0;
    let type = 'credit';

    if (cols.debit !== -1 || cols.credit !== -1) {
      const debitVal  = cols.debit  !== -1 ? parseAmount(row[cols.debit])  : 0;
      const creditVal = cols.credit !== -1 ? parseAmount(row[cols.credit]) : 0;
      if (Math.abs(debitVal) > 0)      { amount = Math.abs(debitVal);  type = 'debit'; }
      else if (Math.abs(creditVal) > 0) { amount = Math.abs(creditVal); type = 'credit'; }
    } else if (cols.amount !== -1) {
      const raw = parseAmount(row[cols.amount]);
      amount = Math.abs(raw);
      type = raw < 0 ? 'debit' : 'credit';
    }

    if (amount <= 0) {
      errors.push({
        row: rowNo,
        reason: 'Transaction has no non-zero amount',
        remedy: 'Ensure the amount / debit / credit column has a numeric value greater than zero.',
      });
      continue;
    }

    transactions.push({
      date,
      description: String(desc).substring(0, 490) || 'No description',
      amount,
      type,
      reference: String(ref).substring(0, 100),
    });
  }

  return { transactions, columns: cols, errors, rawRowCount: rawRows.length };
}

// ── Ledger posting helpers ───────────────────
// When a bank transaction is categorised (single CoA or split), we post a
// matching journal entry so the movement appears in chart_of_accounts balances
// and in P&L / Balance Sheet / Cash Flow / Trial Balance reports.
//
//   Money out (txn.type='debit'):  Dr categorised account,  Cr Cash
//   Money in  (txn.type='credit'): Dr Cash,                 Cr categorised account
//
// Reference convention: 'BNK-<txnId>'. We re-post on every update so the
// ledger always matches the current categorisation.

async function findCashAccount(client, companyId) {
  // Prefer the conventional 1000/Cash account; fall back to first Asset account.
  const direct = await client.query(
    `SELECT id, code, name, type FROM chart_of_accounts
     WHERE company_id = $1 AND code = '1000' LIMIT 1`,
    [companyId]
  );
  if (direct.rows.length) return direct.rows[0];
  const fallback = await client.query(
    `SELECT id, code, name, type FROM chart_of_accounts
     WHERE company_id = $1 AND type = 'Asset' ORDER BY code ASC LIMIT 1`,
    [companyId]
  );
  return fallback.rows[0] || null;
}

async function deleteBankJournal(client, companyId, txnId) {
  const reference = `BNK-${txnId}`;
  const existing = await client.query(
    `SELECT je.id AS journal_id, jl.account_code, jl.type AS line_type, jl.amount
     FROM journal_entries je
     LEFT JOIN journal_lines jl ON jl.journal_id = je.id
     WHERE je.company_id = $1 AND je.reference = $2`,
    [companyId, reference]
  );
  if (!existing.rows.length || !existing.rows[0].journal_id) return;
  const journalId = existing.rows[0].journal_id;

  // Reverse the CoA balance impact of every line before deleting.
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

async function postBankJournal(client, companyId, txnId, lines) {
  // lines: [{ coa_account_id, amount, description }]
  const validLines = (lines || []).filter(l => l.coa_account_id && parseFloat(l.amount) > 0);
  if (!validLines.length) return;

  const txnRes = await client.query(
    `SELECT * FROM bank_transactions WHERE id = $1 AND company_id = $2`,
    [txnId, companyId]
  );
  if (!txnRes.rows.length) return;
  const txn = txnRes.rows[0];

  await deleteBankJournal(client, companyId, txnId);

  const cashAcc = await findCashAccount(client, companyId);
  if (!cashAcc) return;

  const totalAmount = validLines.reduce((s, l) => s + parseFloat(l.amount), 0);
  const categorizedSide = txn.type === 'debit' ? 'debit' : 'credit';
  const cashSide        = txn.type === 'debit' ? 'credit' : 'debit';
  const reference = `BNK-${txnId}`;
  const description = `Bank: ${(txn.description || '').substring(0, 200)}`;

  const jeRes = await client.query(
    `INSERT INTO journal_entries (company_id, reference, date, description, status)
     VALUES ($1, $2, $3, $4, 'posted') RETURNING id`,
    [companyId, reference, txn.date, description]
  );
  const journalId = jeRes.rows[0].id;

  for (const ln of validLines) {
    const accRes = await client.query(
      `SELECT id, code, name, type FROM chart_of_accounts
       WHERE id = $1 AND company_id = $2`,
      [ln.coa_account_id, companyId]
    );
    if (!accRes.rows.length) continue;
    const acc = accRes.rows[0];
    const amount = parseFloat(ln.amount);
    await client.query(
      `INSERT INTO journal_lines (journal_id, account_code, account_name, type, amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [journalId, acc.code, acc.name, categorizedSide, amount]
    );
    const isDebitNormal = ['Asset', 'Expense'].includes(acc.type);
    const isDebit = categorizedSide === 'debit';
    const delta = (isDebit === isDebitNormal) ? amount : -amount;
    await client.query(
      `UPDATE chart_of_accounts SET balance = balance + $1, updated_at = NOW()
       WHERE id = $2`,
      [delta, acc.id]
    );
  }

  await client.query(
    `INSERT INTO journal_lines (journal_id, account_code, account_name, type, amount)
     VALUES ($1, $2, $3, $4, $5)`,
    [journalId, cashAcc.code, cashAcc.name, cashSide, totalAmount]
  );
  const isCashDebitNormal = ['Asset', 'Expense'].includes(cashAcc.type);
  const isCashDebit = cashSide === 'debit';
  const cashDelta = (isCashDebit === isCashDebitNormal) ? totalAmount : -totalAmount;
  await client.query(
    `UPDATE chart_of_accounts SET balance = balance + $1, updated_at = NOW() WHERE id = $2`,
    [cashDelta, cashAcc.id]
  );
}

// ── Extract candidate invoice numbers from a description ──
function extractInvoiceNumbers(text) {
  if (!text) return [];
  const s = String(text).toUpperCase();
  // Common patterns: INV-000123, INV000123, INV/2024/001, #1234, INVOICE 1234
  const found = new Set();
  const patterns = [
    /INV[\s\-\/#]*[A-Z0-9\-\/]{3,20}/g,
    /INVOICE[\s\-\/#]*[A-Z0-9\-\/]{3,20}/g,
    /#[A-Z0-9\-\/]{3,20}/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(s)) !== null) {
      found.add(m[0].replace(/[\s#]/g, '').replace(/^INVOICE/, 'INV'));
    }
  }
  // Also raw numeric sequences of 4+ digits
  const numRe = /\b\d{4,}\b/g;
  let m;
  while ((m = numRe.exec(s)) !== null) found.add(m[0]);
  return Array.from(found);
}

// ── Auto-categorise a single transaction ─────────────────
// Returns { status, matched_type, matched_id, coa_account_id, auto_matched }
//         or null if no auto-decision could be made.
async function autoCategoriseTransaction(txn, companyId) {
  const desc = String(txn.description || '').toLowerCase();
  const descUpper = String(txn.description || '').toUpperCase();

  // ── 1. Match to invoice by invoice number in description
  const candidates = extractInvoiceNumbers(txn.description);
  if (candidates.length > 0 && txn.type === 'credit') {
    // Try each candidate against invoice_number (LIKE match to accommodate padding)
    for (const cand of candidates) {
      const q = await pool.query(
        `SELECT id, invoice_number, total_amount FROM invoices
         WHERE company_id = $1
           AND (UPPER(invoice_number) = $2
                OR UPPER(invoice_number) LIKE $3
                OR UPPER(REPLACE(invoice_number, '-', '')) = $2)
         LIMIT 1`,
        [companyId, cand, `%${cand}%`]
      );
      if (q.rows.length) {
        return {
          status: 'matched',
          matched_type: 'invoice',
          matched_id: q.rows[0].id,
          coa_account_id: null,
          auto_matched: true,
        };
      }
    }
  }

  // ── 2. Match to expense number in description (money out)
  if (candidates.length > 0 && txn.type === 'debit') {
    for (const cand of candidates) {
      const q = await pool.query(
        `SELECT id, expense_number FROM expenses
         WHERE company_id = $1
           AND UPPER(expense_number) LIKE $2
         LIMIT 1`,
        [companyId, `%${cand}%`]
      );
      if (q.rows.length) {
        return {
          status: 'matched',
          matched_type: 'expense',
          matched_id: q.rows[0].id,
          coa_account_id: null,
          auto_matched: true,
        };
      }
    }
  }

  // ── 3. Match to a Chart-of-Accounts identifier
  // Guard against the column not existing yet (older schema) so a
  // half-migrated database still allows imports to succeed — the row will
  // simply come back unmatched instead of aborting the whole import.
  let coa = { rows: [] };
  try {
    coa = await pool.query(
      `SELECT id, identifier FROM chart_of_accounts
       WHERE company_id = $1
         AND identifier IS NOT NULL
         AND identifier <> ''`,
      [companyId]
    );
  } catch (err) {
    if (err.code !== '42703') throw err; // 42703 = undefined_column
  }
  for (const row of coa.rows) {
    const ident = String(row.identifier).toLowerCase().trim();
    if (!ident) continue;
    if (desc.includes(ident) || descUpper.includes(String(row.identifier).toUpperCase())) {
      return {
        status: 'categorized',
        matched_type: null,
        matched_id: null,
        coa_account_id: row.id,
        auto_matched: true,
      };
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════
// Bank Accounts
// ═══════════════════════════════════════════════════════

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
    res.status(500).json({
      message: 'Could not load bank accounts',
      reason: err.message,
      remedy: 'Refresh the page. If it persists, check your network connection or contact support.',
    });
  }
});

// POST /banking/accounts
router.post('/accounts', authMiddleware, async (req, res) => {
  const { name, bank_name, account_number, account_type, current_balance, currency_code } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({
      message: 'Account name is required',
      reason: 'The "name" field was empty',
      remedy: 'Enter a display name for this account (e.g. "Main Checking").',
    });
  }
  try {
    // Default currency to the company's base currency if not provided
    let currency = currency_code;
    if (!currency) {
      const c = await pool.query('SELECT base_currency FROM companies WHERE id = $1', [req.companyId]);
      currency = c.rows[0]?.base_currency || 'USD';
    }

    const result = await pool.query(
      `INSERT INTO bank_accounts (company_id, name, bank_name, account_number, account_type, current_balance, currency_code, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [req.companyId, name.trim(), bank_name || null, account_number || null,
       account_type || 'checking', parseFloat(current_balance) || 0, currency]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      message: 'Could not create bank account',
      reason: err.message,
      remedy: 'Check the account name is unique and try again.',
    });
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
      [name, bank_name || null, account_number || null, account_type || 'checking',
       parseFloat(current_balance) || 0, currency_code || 'USD', req.params.id, req.companyId]
    );
    if (!result.rows.length) {
      return res.status(404).json({
        message: 'Account not found',
        reason: `No bank account with id ${req.params.id} belongs to this company`,
        remedy: 'Refresh the page to reload your accounts list.',
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      message: 'Could not update account',
      reason: err.message,
      remedy: 'Verify the values are valid and try again.',
    });
  }
});

// DELETE /banking/accounts/:id
router.delete('/accounts/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM bank_accounts WHERE id=$1 AND company_id=$2', [req.params.id, req.companyId]);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({
      message: 'Could not delete account',
      reason: err.message,
      remedy: 'The account may have linked transactions. Remove them first, then retry.',
    });
  }
});

// ═══════════════════════════════════════════════════════
// Import Statement (CSV + Excel)
// ═══════════════════════════════════════════════════════

// POST /banking/accounts/:id/import
router.post('/accounts/:id/import', authMiddleware, upload.single('statement'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      message: 'No file was uploaded',
      reason: 'The request did not contain a statement file',
      remedy: 'Click "Choose file" and select a .csv, .xlsx or .xls export from your bank.',
    });
  }

  try {
    // Verify account belongs to company
    const acctResult = await pool.query(
      'SELECT * FROM bank_accounts WHERE id=$1 AND company_id=$2',
      [req.params.id, req.companyId]
    );
    if (!acctResult.rows.length) {
      return res.status(404).json({
        message: 'Bank account not found',
        reason: `Account id ${req.params.id} does not belong to your company`,
        remedy: 'Return to the Banking page and pick an existing account before importing.',
      });
    }

    // ── Decide parser based on extension / mimetype
    const filename = (req.file.originalname || '').toLowerCase();
    const ext = path.extname(filename);
    const isExcel = ['.xlsx', '.xls', '.xlsm'].includes(ext)
                 || /excel|spreadsheet/i.test(req.file.mimetype || '');

    let rawRows;
    try {
      if (isExcel) {
        rawRows = await parseExcelRaw(req.file.buffer);
      } else {
        // CSV / TXT
        const text = req.file.buffer.toString('utf-8');
        rawRows = parseCSVRaw(text);
      }
    } catch (parseErr) {
      return res.status(400).json({
        message: 'Could not read the file',
        reason: parseErr.message,
        remedy: isExcel
          ? 'Save the file as .xlsx (not the older .xls binary format) and try again.'
          : 'Ensure the file is a valid CSV encoded as UTF-8. Try re-exporting from your bank.',
      });
    }

    if (!rawRows.length) {
      return res.status(400).json({
        message: 'The file appears to be empty',
        reason: 'No rows were found in the uploaded file',
        remedy: 'Confirm you exported the statement covering the correct date range and try again.',
      });
    }

    const { transactions, columns, errors, rawRowCount } = buildTransactions(rawRows);

    if (!transactions.length) {
      const first = errors[0] || {
        reason: 'No transactions detected',
        remedy: 'Check the file has Date, Description and Amount (or Debit/Credit) columns.',
      };
      return res.status(400).json({
        message: 'No valid transactions found in the file',
        reason: first.reason,
        remedy: first.remedy,
        details: {
          rows_examined: rawRowCount,
          errors: errors.slice(0, 10),
          detected_columns: columns,
        },
      });
    }

    let imported = 0;
    let skipped = 0;
    let autoCategorised = 0;
    let autoMatched = 0;
    const rowErrors = [];

    // Detect whether the auto_matched column exists (older schema tolerance)
    let hasAutoMatched = true;
    try {
      const check = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'bank_transactions' AND column_name = 'auto_matched' LIMIT 1`
      );
      hasAutoMatched = check.rows.length > 0;
    } catch { /* assume present */ }

    for (const txn of transactions) {
      try {
        // Duplicate detection: same account + date + amount + description
        const dup = await pool.query(
          'SELECT id FROM bank_transactions WHERE bank_account_id=$1 AND date=$2 AND amount=$3 AND description=$4',
          [req.params.id, txn.date, txn.amount, txn.description]
        );
        if (dup.rows.length > 0) { skipped++; continue; }

        // Try to auto-categorise / auto-match
        const auto = await autoCategoriseTransaction(txn, req.companyId);

        const inserted = hasAutoMatched
          ? await pool.query(
              `INSERT INTO bank_transactions
                 (bank_account_id, company_id, date, description, amount, type,
                  status, reference, coa_account_id, matched_type, matched_id, auto_matched, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
               RETURNING id, amount, description, type`,
              [
                req.params.id, req.companyId, txn.date, txn.description,
                txn.amount, txn.type,
                auto ? auto.status : 'unmatched',
                txn.reference || null,
                auto ? auto.coa_account_id : null,
                auto ? auto.matched_type : null,
                auto ? auto.matched_id : null,
                auto ? true : false,
              ]
            )
          : await pool.query(
              `INSERT INTO bank_transactions
                 (bank_account_id, company_id, date, description, amount, type,
                  status, reference, coa_account_id, matched_type, matched_id, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
               RETURNING id, amount, description, type`,
              [
                req.params.id, req.companyId, txn.date, txn.description,
                txn.amount, txn.type,
                auto ? auto.status : 'unmatched',
                txn.reference || null,
                auto ? auto.coa_account_id : null,
                auto ? auto.matched_type : null,
                auto ? auto.matched_id : null,
              ]
            );

        // If auto-categorised to a CoA account, post the ledger entry so
        // reports and account balances stay in sync (same behaviour as manual
        // categorisation via PUT /transactions/:id).
        if (auto?.status === 'categorized' && auto?.coa_account_id) {
          const ledgerClient = await pool.connect();
          try {
            await ledgerClient.query('BEGIN');
            await postBankJournal(ledgerClient, req.companyId, inserted.rows[0].id, [{
              coa_account_id: auto.coa_account_id,
              amount:         inserted.rows[0].amount,
              description:    inserted.rows[0].description,
            }]);
            await ledgerClient.query('COMMIT');
          } catch (ledgerErr) {
            await ledgerClient.query('ROLLBACK');
            // Ledger failure shouldn't fail the whole import — the row will
            // simply remain uncategorised in the ledger and can be re-posted
            // by editing/re-categorising it later.
            console.error('Bank ledger post failed for txn', inserted.rows[0].id, ledgerErr.message);
          } finally {
            ledgerClient.release();
          }
        }

        imported++;
        if (auto?.status === 'matched') autoMatched++;
        if (auto?.status === 'categorized') autoCategorised++;
      } catch (rowErr) {
        rowErrors.push({
          date: txn.date,
          description: txn.description,
          reason: rowErr.message,
        });
      }
    }

    const parts = [`Imported ${imported} transaction${imported === 1 ? '' : 's'}`];
    if (skipped > 0)         parts.push(`${skipped} duplicate${skipped === 1 ? '' : 's'} skipped`);
    if (autoMatched > 0)     parts.push(`${autoMatched} auto-matched to invoices/expenses`);
    if (autoCategorised > 0) parts.push(`${autoCategorised} auto-categorised`);
    const rowsWithIssues = errors.length + rowErrors.length;
    if (rowsWithIssues > 0)  parts.push(`${rowsWithIssues} row${rowsWithIssues === 1 ? '' : 's'} could not be imported`);

    res.json({
      message: parts.join(' · '),
      imported,
      skipped,
      auto_matched: autoMatched,
      auto_categorised: autoCategorised,
      row_errors: [...errors, ...rowErrors].slice(0, 20),
      rows_examined: rawRowCount,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Import failed',
      reason: err.message,
      remedy: 'Try again with a fresh export from your bank. If the problem persists, share the error message with support.',
    });
  }
});

// ═══════════════════════════════════════════════════════
// Transactions
// ═══════════════════════════════════════════════════════

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
    res.status(500).json({
      message: 'Could not load transactions',
      reason: err.message,
      remedy: 'Refresh the page. If it persists, the account may have been deleted.',
    });
  }
});

// PUT /banking/transactions/:id  (match, exclude, categorize, update notes, link receipt)
router.put('/transactions/:id', authMiddleware, async (req, res) => {
  const { status, matched_type, matched_id, category, notes, coa_account_id, receipt_file_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Try with auto_matched (new schema) first, and fall back to the old
    // schema if the column doesn't exist yet.
    let result;
    try {
      result = await client.query(
        `UPDATE bank_transactions
         SET status=$1, matched_type=$2, matched_id=$3, category=$4, notes=$5,
             coa_account_id=$6, receipt_file_id=COALESCE($7, receipt_file_id),
             auto_matched=FALSE
         WHERE id=$8 AND company_id=$9 RETURNING *`,
        [status, matched_type || null, matched_id || null, category || null, notes || null,
         coa_account_id || null, receipt_file_id || null, req.params.id, req.companyId]
      );
    } catch (err) {
      if (err.code !== '42703') throw err;
      result = await client.query(
        `UPDATE bank_transactions
         SET status=$1, matched_type=$2, matched_id=$3, category=$4, notes=$5,
             coa_account_id=$6, receipt_file_id=COALESCE($7, receipt_file_id)
         WHERE id=$8 AND company_id=$9 RETURNING *`,
        [status, matched_type || null, matched_id || null, category || null, notes || null,
         coa_account_id || null, receipt_file_id || null, req.params.id, req.companyId]
      );
    }
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        message: 'Transaction not found',
        reason: `No transaction with id ${req.params.id} belongs to this company`,
        remedy: 'Refresh the transactions list and retry.',
      });
    }
    const txn = result.rows[0];

    // Sync the ledger: post a journal when categorised, remove it otherwise.
    if (status === 'categorized' && coa_account_id) {
      await postBankJournal(client, req.companyId, txn.id, [
        { coa_account_id, amount: txn.amount, description: txn.description },
      ]);
    } else {
      await deleteBankJournal(client, req.companyId, txn.id);
    }

    await client.query('COMMIT');
    res.json(txn);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({
      message: 'Could not update transaction',
      reason: err.message,
      remedy: 'Refresh the page and try again.',
    });
  } finally {
    client.release();
  }
});

// DELETE /banking/transactions/:id
router.delete('/transactions/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await deleteBankJournal(client, req.companyId, req.params.id);
    await client.query('DELETE FROM bank_transactions WHERE id=$1 AND company_id=$2', [req.params.id, req.companyId]);
    await client.query('COMMIT');
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({
      message: 'Could not delete transaction',
      reason: err.message,
      remedy: 'The transaction may already have been removed. Refresh the page.',
    });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════
// Transaction Splits (Itemise)
// ═══════════════════════════════════════════════════════

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
    res.status(500).json({
      message: 'Could not load splits',
      reason: err.message,
      remedy: 'Refresh the page and try again.',
    });
  }
});

// POST /banking/transactions/:id/splits  (replaces all existing splits)
router.post('/transactions/:id/splits', authMiddleware, async (req, res) => {
  const { splits } = req.body;
  if (!Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({
      message: 'At least one split line is required',
      reason: 'The splits array was empty or missing',
      remedy: 'Add at least one line with an account and amount before saving.',
    });
  }

  // Verify transaction belongs to this company
  const txnCheck = await pool.query(
    'SELECT * FROM bank_transactions WHERE id=$1 AND company_id=$2',
    [req.params.id, req.companyId]
  );
  if (!txnCheck.rows.length) {
    return res.status(404).json({
      message: 'Transaction not found',
      reason: `Transaction id ${req.params.id} does not exist for this company`,
      remedy: 'Refresh the page and try again.',
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM bank_transaction_splits WHERE bank_transaction_id=$1', [req.params.id]);

    for (const split of splits) {
      await client.query(
        `INSERT INTO bank_transaction_splits (bank_transaction_id, company_id, coa_account_id, amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, req.companyId, split.coa_account_id || null, parseFloat(split.amount), split.description || '']
      );
    }

    await client.query(
      `UPDATE bank_transactions SET status='categorized', coa_account_id=NULL WHERE id=$1 AND company_id=$2`,
      [req.params.id, req.companyId]
    );

    // Post a journal entry covering every split so the ledger reflects the categorisation.
    await postBankJournal(client, req.companyId, req.params.id, splits.map(s => ({
      coa_account_id: s.coa_account_id,
      amount: s.amount,
      description: s.description,
    })));

    await client.query('COMMIT');
    res.json({ message: 'Splits saved', count: splits.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({
      message: 'Could not save splits',
      reason: err.message,
      remedy: 'Check each line has a valid account and numeric amount, then retry.',
    });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════
// Match Suggestions
// ═══════════════════════════════════════════════════════

// GET /banking/match-suggestions/:id
router.get('/match-suggestions/:id', authMiddleware, async (req, res) => {
  try {
    const txnResult = await pool.query(
      'SELECT * FROM bank_transactions WHERE id=$1 AND company_id=$2',
      [req.params.id, req.companyId]
    );
    if (!txnResult.rows.length) {
      return res.status(404).json({
        message: 'Transaction not found',
        reason: `Transaction id ${req.params.id} not found`,
        remedy: 'Refresh the page.',
      });
    }
    const txn = txnResult.rows[0];

    const words = txn.description.split(/\s+/).filter((w) => w.length > 3);
    const descPattern = words.length > 0 ? `%${words[0]}%` : null;

    let suggestions = [];

    if (txn.type === 'credit') {
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
    res.status(500).json({
      message: 'Could not load suggestions',
      reason: err.message,
      remedy: 'Try again in a moment.',
    });
  }
});

// ═══════════════════════════════════════════════════════
// Re-run auto-categorisation across existing transactions
// ═══════════════════════════════════════════════════════

// POST /banking/accounts/:id/auto-categorise
router.post('/accounts/:id/auto-categorise', authMiddleware, async (req, res) => {
  try {
    const acct = await pool.query(
      'SELECT id FROM bank_accounts WHERE id=$1 AND company_id=$2',
      [req.params.id, req.companyId]
    );
    if (!acct.rows.length) {
      return res.status(404).json({
        message: 'Bank account not found',
        reason: `No account with id ${req.params.id}`,
        remedy: 'Refresh the page and pick a valid account.',
      });
    }

    const unmatched = await pool.query(
      `SELECT id, description, amount, type FROM bank_transactions
       WHERE bank_account_id=$1 AND company_id=$2 AND status='unmatched'`,
      [req.params.id, req.companyId]
    );

    let updated = 0;
    for (const txn of unmatched.rows) {
      const auto = await autoCategoriseTransaction(txn, req.companyId);
      if (!auto) continue;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        try {
          await client.query(
            `UPDATE bank_transactions
             SET status=$1, matched_type=$2, matched_id=$3,
                 coa_account_id=$4, auto_matched=TRUE
             WHERE id=$5 AND company_id=$6`,
            [auto.status, auto.matched_type, auto.matched_id, auto.coa_account_id,
             txn.id, req.companyId]
          );
        } catch (colErr) {
          if (colErr.code !== '42703') throw colErr;
          await client.query(
            `UPDATE bank_transactions
             SET status=$1, matched_type=$2, matched_id=$3, coa_account_id=$4
             WHERE id=$5 AND company_id=$6`,
            [auto.status, auto.matched_type, auto.matched_id, auto.coa_account_id,
             txn.id, req.companyId]
          );
        }
        // Keep the ledger in sync when auto-categorising to a CoA account
        if (auto.status === 'categorized' && auto.coa_account_id) {
          await postBankJournal(client, req.companyId, txn.id, [{
            coa_account_id: auto.coa_account_id,
            amount:         txn.amount,
            description:    txn.description,
          }]);
        }
        await client.query('COMMIT');
        updated++;
      } catch (rowErr) {
        await client.query('ROLLBACK');
        console.error('Auto-categorise failed for txn', txn.id, rowErr.message);
      } finally {
        client.release();
      }
    }

    res.json({
      message: `Auto-categorised ${updated} transaction${updated === 1 ? '' : 's'}`,
      updated,
      examined: unmatched.rows.length,
    });
  } catch (err) {
    res.status(500).json({
      message: 'Auto-categorisation failed',
      reason: err.message,
      remedy: 'Ensure your Chart of Accounts has identifiers set for the accounts you want auto-matched.',
    });
  }
});

module.exports = router;
