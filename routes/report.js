// ============================================
// routes/report.js - Report Routes with Excel/CSV Export
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const ExcelJS = require('exceljs');

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

    const totalRevenue = parseFloat(revenueResult.rows[0].total);
    const totalExpenses = parseFloat(expenseResult.rows[0].total);

    res.json({
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: totalRevenue - totalExpenses,
      expense_breakdown: breakdownResult.rows.map(row => ({
        category: row.category,
        amount: parseFloat(row.total)
      }))
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
      `SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE company_id = $1 WHERE category = 'accounts-payable'`,
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

module.exports = router;