// ============================================
// routes/report.js - Report Routes with Excel/CSV Export
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const ExcelJS = require('exceljs');

// ── Journal-derived movement helpers ──────────────────────────────
// Bank categorisation (and any manual journal) writes to journal_lines.
// Reports must add these movements to the static totals derived from
// invoices/expenses so categorised bank txns appear in P&L, BS, CF.

async function getJournalMovements(companyId, startDate, endDate) {
  let filter = '';
  const params = [companyId];
  if (startDate) { filter += ` AND je.date >= $${params.length + 1}`; params.push(startDate); }
  if (endDate)   { filter += ` AND je.date <= $${params.length + 1}`; params.push(endDate); }

  const result = await pool.query(`
    SELECT coa.id, coa.code, coa.name, coa.type, coa.category,
           COALESCE(SUM(CASE WHEN jl.type = 'debit'  THEN jl.amount ELSE 0 END), 0) AS total_debit,
           COALESCE(SUM(CASE WHEN jl.type = 'credit' THEN jl.amount ELSE 0 END), 0) AS total_credit
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_id = je.id
    JOIN chart_of_accounts coa
      ON coa.code = jl.account_code AND coa.company_id = je.company_id
    WHERE je.company_id = $1 AND je.status = 'posted' ${filter}
    GROUP BY coa.id, coa.code, coa.name, coa.type, coa.category
  `, params);

  return result.rows.map(r => ({
    id: r.id, code: r.code, name: r.name, type: r.type, category: r.category,
    debit:  parseFloat(r.total_debit),
    credit: parseFloat(r.total_credit),
  }));
}

// Get Profit & Loss Report
router.get('/profit-loss', authMiddleware, async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    let revenueQuery = `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status = 'paid'`;
    let expenseQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`;
    let params = [req.companyId];

    if (start_date) {
      revenueQuery += ` AND invoice_date >= $2`;
      expenseQuery += ` AND expense_date >= $2`;
      params.push(start_date);
    }

    if (end_date) {
      const endParam = params.length + 1;
      revenueQuery += ` AND invoice_date <= $${endParam}`;
      expenseQuery += ` AND expense_date <= $${endParam}`;
      params.push(end_date);
    }

    const revenueResult = await pool.query(revenueQuery, params);
    const expenseResult = await pool.query(expenseQuery, params);

    // Get expense breakdown by category
    let breakdownQuery = `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`;
    let breakdownParams = [req.companyId];

    if (start_date) {
      breakdownQuery += ` AND expense_date >= $2`;
      breakdownParams.push(start_date);
    }

    if (end_date) {
      const endParam = breakdownParams.length + 1;
      breakdownQuery += ` AND expense_date <= $${endParam}`;
      breakdownParams.push(end_date);
    }

    breakdownQuery += ` GROUP BY category ORDER BY total DESC`;

    const breakdownResult = await pool.query(breakdownQuery, breakdownParams);

    // Fold in journal-derived movements (e.g. categorised bank transactions)
    const movements = await getJournalMovements(req.companyId, start_date, end_date);
    let journalRevenue = 0;
    let journalExpenses = 0;
    const journalExpenseBreakdown = [];
    for (const m of movements) {
      if (m.type === 'Revenue') {
        journalRevenue += (m.credit - m.debit);
      } else if (m.type === 'Expense') {
        const amt = m.debit - m.credit;
        journalExpenses += amt;
        if (amt !== 0) {
          journalExpenseBreakdown.push({ category: m.name, amount: amt, account_code: m.code });
        }
      }
    }

    const totalRevenue  = parseFloat(revenueResult.rows[0].total)  + journalRevenue;
    const totalExpenses = parseFloat(expenseResult.rows[0].total) + journalExpenses;

    res.json({
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: totalRevenue - totalExpenses,
      expense_breakdown: [
        ...breakdownResult.rows.map(row => ({ category: row.category, amount: parseFloat(row.total) })),
        ...journalExpenseBreakdown,
      ],
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating P&L report', error: error.message });
  }
});

// Export Profit & Loss to Excel/CSV
router.get('/profit-loss/export', authMiddleware, async (req, res) => {
  const { format = 'excel', start_date, end_date } = req.query;

  try {
    // Get P&L data
    let revenueQuery = `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status = 'paid'`;
    let expenseQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`;
    let params = [req.companyId];

    if (start_date) {
      revenueQuery += ` AND invoice_date >= $2`;
      expenseQuery += ` AND expense_date >= $2`;
      params.push(start_date);
    }

    if (end_date) {
      const endParam = params.length + 1;
      revenueQuery += ` AND invoice_date <= $${endParam}`;
      expenseQuery += ` AND expense_date <= $${endParam}`;
      params.push(end_date);
    }

    const revenueResult = await pool.query(revenueQuery, params);
    const expenseResult = await pool.query(expenseQuery, params);

    let breakdownQuery = `SELECT category, COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`;
    let breakdownParams = [req.companyId];

    if (start_date) {
      breakdownQuery += ` AND expense_date >= $2`;
      breakdownParams.push(start_date);
    }

    if (end_date) {
      const endParam = breakdownParams.length + 1;
      breakdownQuery += ` AND expense_date <= $${endParam}`;
      breakdownParams.push(end_date);
    }

    breakdownQuery += ` GROUP BY category ORDER BY total DESC`;
    const breakdownResult = await pool.query(breakdownQuery, breakdownParams);

    const totalRevenue = parseFloat(revenueResult.rows[0].total);
    const totalExpenses = parseFloat(expenseResult.rows[0].total);
    const netProfit = totalRevenue - totalExpenses;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Profit & Loss Statement');

      // Add title
      worksheet.mergeCells('A1:B1');
      worksheet.getCell('A1').value = 'PROFIT & LOSS STATEMENT';
      worksheet.getCell('A1').font = { bold: true, size: 16 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      // Add period
      worksheet.mergeCells('A2:B2');
      const period = start_date && end_date ? `${start_date} to ${end_date}` : 'All Time';
      worksheet.getCell('A2').value = `Period: ${period}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.addRow([]);

      // Income section
      worksheet.addRow(['INCOME', '']);
      worksheet.addRow(['Revenue', totalRevenue]);
      worksheet.addRow(['Total Income', totalRevenue]);
      worksheet.getCell(`B${worksheet.rowCount}`).font = { bold: true };

      worksheet.addRow([]);

      // Expenses section
      worksheet.addRow(['EXPENSES', '']);
      
      // Sort to put Cost of Sales first
      const sortedBreakdown = [...breakdownResult.rows].sort((a, b) => {
        if (a.category === 'cost-of-sales') return -1;
        if (b.category === 'cost-of-sales') return 1;
        return 0;
      });

      sortedBreakdown.forEach(row => {
        worksheet.addRow([row.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), parseFloat(row.total)]);
      });
      worksheet.addRow(['Total Expenses', totalExpenses]);
      worksheet.getCell(`B${worksheet.rowCount}`).font = { bold: true };

      worksheet.addRow([]);

      // Net profit
      worksheet.addRow(['NET PROFIT', netProfit]);
      worksheet.getRow(worksheet.rowCount).font = { bold: true, size: 12 };
      worksheet.getCell(`B${worksheet.rowCount}`).font = { 
        bold: true, 
        size: 12, 
        color: { argb: netProfit >= 0 ? 'FF008000' : 'FFFF0000' } 
      };

      // Format columns
      worksheet.getColumn(1).width = 30;
      worksheet.getColumn(2).width = 20;
      worksheet.getColumn(2).numFmt = '"$"#,##0.00';

      // Send file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=profit_loss_statement.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } else {
      // CSV format
      let csv = 'PROFIT & LOSS STATEMENT\n';
      csv += `Period,${start_date && end_date ? `${start_date} to ${end_date}` : 'All Time'}\n\n`;
      csv += 'INCOME\n';
      csv += `Revenue,${totalRevenue}\n`;
      csv += `Total Income,${totalRevenue}\n\n`;
      csv += 'EXPENSES\n';
      
      // Sort to put Cost of Sales first
      const sortedBreakdown = [...breakdownResult.rows].sort((a, b) => {
        if (a.category === 'cost-of-sales') return -1;
        if (b.category === 'cost-of-sales') return 1;
        return 0;
      });

      sortedBreakdown.forEach(row => {
        csv += `${row.category},${parseFloat(row.total)}\n`;
      });
      csv += `Total Expenses,${totalExpenses}\n\n`;
      csv += `NET PROFIT,${netProfit}\n`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=profit_loss_statement.csv');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error exporting P&L report', error: error.message });
  }
});

// Balance Sheet - JSON view
// The CoA.balance field is maintained by every posted journal (invoices,
// expenses, bank categorisations, opening balances, manual journals), so we
// derive the Balance Sheet directly from it. We also surface invoice/expense
// activity that isn't yet journalised so AR/AP stay current.
router.get('/balance-sheet', authMiddleware, async (req, res) => {
  try {
    const [coaR, inventoryR, receivablesR, revenueR, expensesR] = await Promise.all([
      pool.query(
        `SELECT id, code, name, type, category, COALESCE(balance, 0) as balance
         FROM chart_of_accounts WHERE company_id = $1 ORDER BY code ASC`,
        [req.companyId]
      ),
      pool.query(`SELECT COALESCE(SUM(unit_price * quantity_on_hand), 0) as total FROM items WHERE company_id = $1`, [req.companyId]),
      pool.query(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status IN ('sent', 'overdue', 'unpaid')`, [req.companyId]),
      pool.query(`SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status = 'paid'`, [req.companyId]),
      pool.query(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`, [req.companyId]),
    ]);

    const inventory   = parseFloat(inventoryR.rows[0].total);
    const receivables = parseFloat(receivablesR.rows[0].total);
    const paidRevenue = parseFloat(revenueR.rows[0].total);
    const totalExpenses = parseFloat(expensesR.rows[0].total);

    // Break down every CoA account so the Balance Sheet itemises Motor
    // Vehicle, Land, Loans, etc. — each account shows its current balance.
    const assetAccounts = [];
    const liabilityAccounts = [];
    const equityAccounts = [];
    let assetTotal = 0, liabilityTotal = 0, equityTotal = 0, ledgerRevenue = 0, ledgerExpense = 0;

    for (const row of coaR.rows) {
      const bal = parseFloat(row.balance);
      const entry = { id: row.id, code: row.code, name: row.name, category: row.category, balance: bal };
      if (row.type === 'Asset')     { assetAccounts.push(entry);     assetTotal     += bal; }
      else if (row.type === 'Liability') { liabilityAccounts.push(entry); liabilityTotal += bal; }
      else if (row.type === 'Equity')    { equityAccounts.push(entry);    equityTotal    += bal; }
      else if (row.type === 'Revenue')   { ledgerRevenue += bal; }
      else if (row.type === 'Expense')   { ledgerExpense += bal; }
    }

    // Add inventory/receivables that live outside the journal system so the
    // sheet stays current even when invoices haven't been posted as journals.
    const totalAssets      = assetTotal + inventory + receivables;
    const totalLiabilities = liabilityTotal;
    const retainedEarnings = paidRevenue - totalExpenses + ledgerRevenue - ledgerExpense;
    const totalEquity      = equityTotal + retainedEarnings;

    res.json({
      assets: {
        accounts_receivable: receivables,
        inventory,
        accounts: assetAccounts,
        total: totalAssets,
      },
      liabilities: {
        accounts_payable: liabilityTotal,
        accounts: liabilityAccounts,
        total: totalLiabilities,
      },
      equity: {
        retained_earnings: retainedEarnings,
        accounts: equityAccounts,
        total: totalEquity,
      },
      total_liabilities_and_equity: totalLiabilities + totalEquity,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating balance sheet', error: error.message });
  }
});

// Account Ledger - drill-down endpoint
// Returns every journal line that touched an account, with a running balance.
// Reports use this to power the click-to-drill-down on any figure.
router.get('/account-ledger/:code', authMiddleware, async (req, res) => {
  const { code } = req.params;
  const { start_date, end_date } = req.query;
  try {
    const accountR = await pool.query(
      `SELECT id, code, name, type, category, COALESCE(balance, 0) as balance
       FROM chart_of_accounts WHERE company_id = $1 AND code = $2`,
      [req.companyId, code]
    );
    if (!accountR.rows.length) {
      return res.status(404).json({ message: 'Account not found' });
    }
    const account = accountR.rows[0];

    const params = [req.companyId, code];
    let filter = '';
    if (start_date) { filter += ` AND je.date >= $${params.length + 1}`; params.push(start_date); }
    if (end_date)   { filter += ` AND je.date <= $${params.length + 1}`; params.push(end_date); }

    const linesR = await pool.query(`
      SELECT je.id AS journal_id, je.reference, je.date, je.description,
             jl.type, jl.amount
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_id = je.id
      WHERE je.company_id = $1 AND je.status = 'posted'
        AND jl.account_code = $2 ${filter}
      ORDER BY je.date ASC, je.id ASC, jl.id ASC
    `, params);

    const isDebitNormal = ['Asset', 'Expense'].includes(account.type);
    let running = 0;
    const lines = linesR.rows.map(r => {
      const debit  = r.type === 'debit'  ? parseFloat(r.amount) : 0;
      const credit = r.type === 'credit' ? parseFloat(r.amount) : 0;
      running += (isDebitNormal ? (debit - credit) : (credit - debit));
      return {
        journal_id: r.journal_id,
        reference: r.reference,
        date: r.date,
        description: r.description,
        debit, credit,
        running_balance: running,
      };
    });

    const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    res.json({
      account,
      lines,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balance: parseFloat(account.balance),
      },
      period: { start_date: start_date || null, end_date: end_date || null },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating account ledger', error: error.message });
  }
});

// Cash Flow - JSON view
router.get('/cash-flow', authMiddleware, async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    let cashInQ = `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status = 'paid'`;
    let cashOutQ = `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`;
    const params = [req.companyId];
    if (start_date) { cashInQ += ` AND invoice_date >= $2`; cashOutQ += ` AND expense_date >= $2`; params.push(start_date); }
    if (end_date) { const p = params.length + 1; cashInQ += ` AND invoice_date <= $${p}`; cashOutQ += ` AND expense_date <= $${p}`; params.push(end_date); }
    const [cashInR, cashOutR] = await Promise.all([pool.query(cashInQ, params), pool.query(cashOutQ, params)]);
    let cashIn = parseFloat(cashInR.rows[0].total);
    let cashOut = parseFloat(cashOutR.rows[0].total);

    // Add categorised bank movements via journal entries.
    const movements = await getJournalMovements(req.companyId, start_date, end_date);
    for (const m of movements) {
      if (m.type === 'Revenue') cashIn  += (m.credit - m.debit);
      if (m.type === 'Expense') cashOut += (m.debit  - m.credit);
    }

    res.json({
      operating: { cash_from_customers: cashIn, cash_to_suppliers: cashOut, net: cashIn - cashOut },
      investing: { net: 0 },
      financing: { net: 0 },
      net_change: cashIn - cashOut,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating cash flow', error: error.message });
  }
});

// Balance Sheet Export
router.get('/balance-sheet/export', authMiddleware, async (req, res) => {
  const { format = 'excel', as_of_date } = req.query;
  const asOfDate = as_of_date || new Date().toISOString().split('T')[0];

  try {
    // Assets
    const inventoryResult = await pool.query(
      `SELECT COALESCE(SUM(unit_price * quantity_on_hand), 0) as total FROM items WHERE company_id = $1`,
      [req.companyId]
    );

    const receivablesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status IN ('sent', 'overdue')`,
      [req.companyId]
    );

    // Liabilities & Equity
    const payablesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1 AND category = 'accounts-payable'`,
      [req.companyId]
    );

    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status = 'paid'`,
      [req.companyId]
    );

    const expensesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`,
      [req.companyId]
    );

    const inventory = parseFloat(inventoryResult.rows[0].total);
    const receivables = parseFloat(receivablesResult.rows[0].total);
    const payables = parseFloat(payablesResult.rows[0].total || 0);
    const retainedEarnings = parseFloat(revenueResult.rows[0].total) - parseFloat(expensesResult.rows[0].total);

    const totalAssets = inventory + receivables;
    const totalLiabilities = payables;
    const totalEquity = retainedEarnings;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Balance Sheet');

      worksheet.mergeCells('A1:B1');
      worksheet.getCell('A1').value = 'BALANCE SHEET';
      worksheet.getCell('A1').font = { bold: true, size: 16 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:B2');
      worksheet.getCell('A2').value = `As of ${asOfDate}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.addRow([]);

      // Assets
      worksheet.addRow(['ASSETS', '']);
      worksheet.addRow(['Current Assets:', '']);
      worksheet.addRow(['  Accounts Receivable', receivables]);
      worksheet.addRow(['  Inventory', inventory]);
      worksheet.addRow(['Total Current Assets', totalAssets]);
      worksheet.getCell(`B${worksheet.rowCount}`).font = { bold: true };

      worksheet.addRow([]);
      worksheet.addRow(['TOTAL ASSETS', totalAssets]);
      worksheet.getRow(worksheet.rowCount).font = { bold: true };

      worksheet.addRow([]);

      // Liabilities & Equity
      worksheet.addRow(['LIABILITIES & EQUITY', '']);
      worksheet.addRow(['Current Liabilities:', '']);
      worksheet.addRow(['  Accounts Payable', payables]);
      worksheet.addRow(['Total Current Liabilities', totalLiabilities]);
      worksheet.getCell(`B${worksheet.rowCount}`).font = { bold: true };

      worksheet.addRow([]);
      worksheet.addRow(['Equity:', '']);
      worksheet.addRow(['  Retained Earnings', retainedEarnings]);
      worksheet.addRow(['Total Equity', totalEquity]);
      worksheet.getCell(`B${worksheet.rowCount}`).font = { bold: true };

      worksheet.addRow([]);
      worksheet.addRow(['TOTAL LIABILITIES & EQUITY', totalLiabilities + totalEquity]);
      worksheet.getRow(worksheet.rowCount).font = { bold: true };

      worksheet.getColumn(1).width = 35;
      worksheet.getColumn(2).width = 20;
      worksheet.getColumn(2).numFmt = '"$"#,##0.00';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=balance_sheet.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } else {
      let csv = 'BALANCE SHEET\n';
      csv += `As of,${asOfDate}\n\n`;
      csv += 'ASSETS\n';
      csv += 'Current Assets:\n';
      csv += `Accounts Receivable,${receivables}\n`;
      csv += `Inventory,${inventory}\n`;
      csv += `Total Current Assets,${totalAssets}\n\n`;
      csv += `TOTAL ASSETS,${totalAssets}\n\n`;
      csv += 'LIABILITIES & EQUITY\n';
      csv += 'Current Liabilities:\n';
      csv += `Accounts Payable,${payables}\n`;
      csv += `Total Current Liabilities,${totalLiabilities}\n\n`;
      csv += 'Equity:\n';
      csv += `Retained Earnings,${retainedEarnings}\n`;
      csv += `Total Equity,${totalEquity}\n\n`;
      csv += `TOTAL LIABILITIES & EQUITY,${totalLiabilities + totalEquity}\n`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=balance_sheet.csv');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error exporting balance sheet', error: error.message });
  }
});

// Cash Flow Statement Export
router.get('/cash-flow/export', authMiddleware, async (req, res) => {
  const { format = 'excel', start_date, end_date } = req.query;

  try {
    const cashFromCustomers = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = $1 AND status = 'paid'`,
      [req.companyId]
    );

    const cashToSuppliers = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1`,
      [req.companyId]
    );

    const cashIn = parseFloat(cashFromCustomers.rows[0].total);
    const cashOut = parseFloat(cashToSuppliers.rows[0].total);
    const netCashFlow = cashIn - cashOut;

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cash Flow Statement');

      worksheet.mergeCells('A1:B1');
      worksheet.getCell('A1').value = 'CASH FLOW STATEMENT';
      worksheet.getCell('A1').font = { bold: true, size: 16 };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:B2');
      const period = start_date && end_date ? `${start_date} to ${end_date}` : 'All Time';
      worksheet.getCell('A2').value = `Period: ${period}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      worksheet.addRow([]);

      worksheet.addRow(['CASH FLOWS FROM OPERATING ACTIVITIES', '']);
      worksheet.addRow(['Cash received from customers', cashIn]);
      worksheet.addRow(['Cash paid to suppliers', -cashOut]);
      worksheet.addRow(['Net cash from operating activities', netCashFlow]);
      worksheet.getCell(`B${worksheet.rowCount}`).font = { bold: true };

      worksheet.addRow([]);
      worksheet.addRow(['CASH FLOWS FROM INVESTING ACTIVITIES', '']);
      worksheet.addRow(['Net cash from investing activities', 0]);

      worksheet.addRow([]);
      worksheet.addRow(['CASH FLOWS FROM FINANCING ACTIVITIES', '']);
      worksheet.addRow(['Net cash from financing activities', 0]);

      worksheet.addRow([]);
      worksheet.addRow(['NET INCREASE IN CASH', netCashFlow]);
      worksheet.getRow(worksheet.rowCount).font = { bold: true, size: 12 };

      worksheet.getColumn(1).width = 40;
      worksheet.getColumn(2).width = 20;
      worksheet.getColumn(2).numFmt = '"$"#,##0.00';

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=cash_flow_statement.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } else {
      let csv = 'CASH FLOW STATEMENT\n';
      csv += `Period,${start_date && end_date ? `${start_date} to ${end_date}` : 'All Time'}\n\n`;
      csv += 'CASH FLOWS FROM OPERATING ACTIVITIES\n';
      csv += `Cash received from customers,${cashIn}\n`;
      csv += `Cash paid to suppliers,${-cashOut}\n`;
      csv += `Net cash from operating activities,${netCashFlow}\n\n`;
      csv += 'CASH FLOWS FROM INVESTING ACTIVITIES\n';
      csv += `Net cash from investing activities,0\n\n`;
      csv += 'CASH FLOWS FROM FINANCING ACTIVITIES\n';
      csv += `Net cash from financing activities,0\n\n`;
      csv += `NET INCREASE IN CASH,${netCashFlow}\n`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=cash_flow_statement.csv');
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error exporting cash flow statement', error: error.message });
  }
});

// ── Sales by Customer ─────────────────────────────────────────────────────────
router.get('/sales-by-customer', authMiddleware, async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    let params = [req.companyId];
    let dateFilter = '';
    if (start_date) { dateFilter += ` AND i.invoice_date >= $${params.length + 1}`; params.push(start_date); }
    if (end_date)   { dateFilter += ` AND i.invoice_date <= $${params.length + 1}`; params.push(end_date); }

    const result = await pool.query(`
      SELECT
        c.name AS customer_name,
        COUNT(i.id)                                                   AS invoice_count,
        COALESCE(SUM(i.total_amount), 0)                              AS total_sales,
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) AS paid,
        COALESCE(SUM(CASE WHEN i.status != 'paid' THEN i.total_amount ELSE 0 END), 0) AS outstanding
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.company_id = $1 ${dateFilter}
      GROUP BY c.id, c.name
      ORDER BY total_sales DESC
    `, params);

    res.json({
      customers: result.rows.map(r => ({
        customer_name: r.customer_name,
        invoice_count: parseInt(r.invoice_count),
        total_sales:   parseFloat(r.total_sales),
        paid:          parseFloat(r.paid),
        outstanding:   parseFloat(r.outstanding),
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating Sales by Customer', error: error.message });
  }
});

// ── Sales by Item ─────────────────────────────────────────────────────────────
router.get('/sales-by-item', authMiddleware, async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    let params = [req.companyId];
    let dateFilter = '';
    if (start_date) { dateFilter += ` AND i.invoice_date >= $${params.length + 1}`; params.push(start_date); }
    if (end_date)   { dateFilter += ` AND i.invoice_date <= $${params.length + 1}`; params.push(end_date); }

    const result = await pool.query(`
      SELECT
        ii.description                      AS item_name,
        SUM(ii.quantity)                    AS qty_sold,
        COALESCE(SUM(ii.line_total), 0)     AS total_revenue,
        CASE WHEN SUM(ii.quantity) > 0
             THEN COALESCE(SUM(ii.line_total), 0) / SUM(ii.quantity)
             ELSE 0 END                     AS avg_price
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.company_id = $1 ${dateFilter}
      GROUP BY ii.description
      ORDER BY total_revenue DESC
    `, params);

    res.json({
      items: result.rows.map(r => ({
        item_name:     r.item_name,
        qty_sold:      parseInt(r.qty_sold),
        total_revenue: parseFloat(r.total_revenue),
        avg_price:     parseFloat(r.avg_price),
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Error generating Sales by Item', error: error.message });
  }
});

// ── Trial Balance ─────────────────────────────────────────────────────────────
// CoA.balance is the canonical, journal-maintained ending balance. When a
// date range is supplied we filter to journal-line movements within that
// period; otherwise we report the as-of-now balances directly from CoA.
router.get('/trial-balance', authMiddleware, async (req, res) => {
  const { start_date, end_date } = req.query;
  try {
    const coaResult = await pool.query(
      `SELECT id, code, name, type, COALESCE(balance, 0) AS balance FROM chart_of_accounts
       WHERE company_id = $1 ORDER BY code ASC`,
      [req.companyId]
    );

    let accounts;
    if (start_date || end_date) {
      const params = [req.companyId];
      let dateFilter = '';
      if (start_date) { dateFilter += ` AND je.date >= $${params.length + 1}`; params.push(start_date); }
      if (end_date)   { dateFilter += ` AND je.date <= $${params.length + 1}`; params.push(end_date); }

      const journalResult = await pool.query(`
        SELECT jl.account_code,
               SUM(CASE WHEN jl.type = 'debit'  THEN jl.amount ELSE 0 END) AS journal_debit,
               SUM(CASE WHEN jl.type = 'credit' THEN jl.amount ELSE 0 END) AS journal_credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_id = je.id
        WHERE je.company_id = $1 AND je.status = 'posted' ${dateFilter}
        GROUP BY jl.account_code
      `, params);

      const journalMap = {};
      journalResult.rows.forEach(r => {
        journalMap[r.account_code] = {
          debit:  parseFloat(r.journal_debit),
          credit: parseFloat(r.journal_credit),
        };
      });

      accounts = coaResult.rows.map(row => {
        const jd = journalMap[row.code]?.debit  || 0;
        const jc = journalMap[row.code]?.credit || 0;
        const isDebitNormal = ['Asset', 'Expense'].includes(row.type);
        const netBalance = isDebitNormal ? (jd - jc) : (jc - jd);
        return {
          code:   row.code,
          name:   row.name,
          type:   row.type,
          debit:  isDebitNormal  && netBalance > 0 ? netBalance  : 0,
          credit: !isDebitNormal && netBalance > 0 ? netBalance  : 0,
        };
      });
    } else {
      accounts = coaResult.rows.map(row => {
        const bal = parseFloat(row.balance);
        const isDebitNormal = ['Asset', 'Expense'].includes(row.type);
        return {
          code: row.code, name: row.name, type: row.type,
          debit:  isDebitNormal  && bal > 0 ? bal : 0,
          credit: !isDebitNormal && bal > 0 ? bal : 0,
        };
      });
    }

    const totalDebit  = accounts.reduce((s, a) => s + a.debit,  0);
    const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

    res.json({ accounts, totals: { debit: totalDebit, credit: totalCredit } });
  } catch (error) {
    res.status(500).json({ message: 'Error generating Trial Balance', error: error.message });
  }
});

module.exports = router;