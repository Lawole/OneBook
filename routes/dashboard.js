// ============================================
// routes/dashboard.js - Dashboard Routes
// ============================================

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

// Get dashboard statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Total receivables (unpaid invoices)
    const receivablesResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total, 
              COALESCE(SUM(CASE WHEN status = 'sent' THEN total_amount ELSE 0 END), 0) as current
       FROM invoices 
       WHERE company_id = $1 AND status IN ('sent', 'overdue')`,
      [req.companyId]
    );

    // Total payables (estimated from expenses)
    const payablesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses 
       WHERE company_id = $1`,
      [req.companyId]
    );

    // Net profit (revenue - expenses)
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM invoices 
       WHERE company_id = $1 AND status = 'paid'`,
      [req.companyId]
    );

    const expensesResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses 
       WHERE company_id = $1`,
      [req.companyId]
    );

    const revenue = parseFloat(revenueResult.rows[0].total);
    const expenses = parseFloat(expensesResult.rows[0].total);
    const netProfit = revenue - expenses;

    // Outstanding invoices count
    const outstandingResult = await pool.query(
      `SELECT COUNT(*) as count,
              SUM(CASE WHEN due_date < CURRENT_DATE THEN 1 ELSE 0 END) as overdue
       FROM invoices 
       WHERE company_id = $1 AND status IN ('sent', 'overdue')`,
      [req.companyId]
    );

    // Recent activity (last 10 transactions)
    const recentInvoices = await pool.query(
      `SELECT 'Invoice' as type, invoice_number as description, total_amount as amount, 
              created_at, invoice_date as date
       FROM invoices 
       WHERE company_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [req.companyId]
    );

    const recentExpenses = await pool.query(
      `SELECT 'Expense' as type, description, amount, created_at, expense_date as date
       FROM expenses 
       WHERE company_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [req.companyId]
    );

    const recentActivity = [...recentInvoices.rows, ...recentExpenses.rows]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(activity => ({
        date: activity.date,
        description: activity.description,
        type: activity.type,
        amount: activity.type === 'Invoice' ? parseFloat(activity.amount) : -parseFloat(activity.amount)
      }));

    res.json({
      total_receivables: parseFloat(receivablesResult.rows[0].total),
      current_receivables: parseFloat(receivablesResult.rows[0].current),
      total_payables: parseFloat(payablesResult.rows[0].total),
      overdue_payables: 0,
      total_revenue: revenue,
      total_expenses: expenses,
      net_profit: netProfit,
      outstanding_invoices: parseInt(outstandingResult.rows[0].count),
      overdue_invoices: parseInt(outstandingResult.rows[0].overdue),
      recent_activity: recentActivity
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
  }
});

// Get monthly trend data
router.get('/monthly-trend', authMiddleware, async (req, res) => {
  try {
    const monthsData = [];
    const currentDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);

      const revenueResult = await pool.query(
        `SELECT COALESCE(SUM(total_amount), 0) as total
         FROM invoices 
         WHERE company_id = $1 AND invoice_date >= $2 AND invoice_date <= $3`,
        [req.companyId, monthStart, monthEnd]
      );

      const expensesResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total
         FROM expenses 
         WHERE company_id = $1 AND expense_date >= $2 AND expense_date <= $3`,
        [req.companyId, monthStart, monthEnd]
      );

      const revenue = parseFloat(revenueResult.rows[0].total);
      const expenses = parseFloat(expensesResult.rows[0].total);

      monthsData.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        revenue: revenue,
        expenses: expenses,
        profit: revenue - expenses
      });
    }

    res.json({ months_data: monthsData });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly trend', error: error.message });
  }
});

module.exports = router;
