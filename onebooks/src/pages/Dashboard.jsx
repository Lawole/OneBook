import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, FileText, AlertCircle, BarChart2 } from 'lucide-react';
import Header from '../components/Header';
import StatCard from '../components/StatCard';
import { dashboardAPI } from '../services/api';
import { formatDate } from '../utils/helpers';
import useCurrency from '../hooks/useCurrency';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const { fmt } = useCurrency();

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getMockData = () => {
    const mockStats = {
      total_receivables: 45250.00,
      current_receivables: 32150.00,
      total_payables: 12800.00,
      overdue_payables: 2300.00,
      total_revenue: 125000.00,
      total_expenses: 57570.00,
      net_profit: 67430.00,
      outstanding_invoices: 23,
      overdue_invoices: 5,
      recent_activity: [
        { date: '2026-03-07', description: 'INV-0045', type: 'Invoice', amount: 5250 },
        { date: '2026-03-06', description: 'Office Supplies', type: 'Expense', amount: -450 },
        { date: '2026-03-05', description: 'INV-0044', type: 'Invoice', amount: 3800 },
        { date: '2026-03-04', description: 'Software Subscription', type: 'Expense', amount: -299 },
        { date: '2026-03-03', description: 'INV-0043', type: 'Invoice', amount: 7650 },
      ]
    };

    const mockChart = [
      { month: 'Apr 2025', revenue: 25000, expenses: 18000 },
      { month: 'May 2025', revenue: 28000, expenses: 19000 },
      { month: 'Jun 2025', revenue: 32000, expenses: 21000 },
      { month: 'Jul 2025', revenue: 30000, expenses: 20000 },
      { month: 'Aug 2025', revenue: 35000, expenses: 22000 },
      { month: 'Sep 2025', revenue: 38000, expenses: 24000 },
      { month: 'Oct 2025', revenue: 40000, expenses: 25000 },
      { month: 'Nov 2025', revenue: 42000, expenses: 26000 },
      { month: 'Dec 2025', revenue: 45000, expenses: 28000 },
      { month: 'Jan 2026', revenue: 47000, expenses: 29000 },
      { month: 'Feb 2026', revenue: 50000, expenses: 30000 },
      { month: 'Mar 2026', revenue: 52000, expenses: 31000 },
    ];

    return { stats: mockStats, chart: mockChart };
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, trendRes] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getMonthlyTrend(),
      ]);
      
      setStats(statsRes.data);
      setChartData(trendRes.data.months_data);
      setDemoMode(false);
    } catch (error) {
      console.log('API not available, using demo data');
      const mockData = getMockData();
      setStats(mockData.stats);
      setChartData(mockData.chart);
      setDemoMode(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="page">
      <Header 
        title="Dashboard" 
        subtitle={demoMode ? "Demo Mode - Sample data shown" : "Welcome back! Here's what's happening with your business."}
      />

      <div className="page-content">
        {demoMode && (
          <div className="alert alert-info" style={{ marginBottom: '25px' }}>
            💡 <strong>Demo Mode:</strong> You're viewing sample data. Connect your database to see real data.
          </div>
        )}

        <div className="stats-grid">
          <StatCard
            title="Total Revenue"
            value={fmt(stats?.total_revenue || 0)}
            change={`Expenses: ${fmt(stats?.total_expenses || 0)}`}
            changeType="positive"
            icon={BarChart2}
            color="linear-gradient(135deg, #8b5cf6, #7c3aed)"
          />

          <StatCard
            title="Total Receivables"
            value={fmt(stats?.total_receivables || 0)}
            change={`Current: ${fmt(stats?.current_receivables || 0)}`}
            changeType="positive"
            icon={DollarSign}
            color="linear-gradient(135deg, #10b981, #059669)"
          />

          <StatCard
            title="Total Payables"
            value={fmt(stats?.total_payables || 0)}
            change={`Overdue: ${fmt(stats?.overdue_payables || 0)}`}
            changeType="negative"
            icon={AlertCircle}
            color="linear-gradient(135deg, #ef4444, #dc2626)"
          />

          <StatCard
            title="Net Profit"
            value={fmt(stats?.net_profit || 0)}
            change="This fiscal year"
            changeType={stats?.net_profit >= 0 ? 'positive' : 'negative'}
            icon={TrendingUp}
            color="linear-gradient(135deg, #3b82f6, #2563eb)"
          />

          <StatCard
            title="Outstanding Invoices"
            value={stats?.outstanding_invoices || 0}
            change={`Overdue: ${stats?.overdue_invoices || 0}`}
            changeType="negative"
            icon={FileText}
            color="linear-gradient(135deg, #f59e0b, #d97706)"
          />
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Cash Flow (Last 12 Months)</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => fmt(value)} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Revenue"
                />
                <Line 
                  type="monotone" 
                  dataKey="expenses" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  name="Expenses"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Recent Activity</h3>
          </div>
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats?.recent_activity?.length > 0 ? (
                  stats.recent_activity.map((activity, index) => (
                    <tr key={index}>
                      <td>{formatDate(activity.date)}</td>
                      <td>{activity.description}</td>
                      <td>{activity.type}</td>
                      <td className={`text-right ${activity.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                        {activity.amount >= 0 ? '+' : ''}{fmt(Math.abs(activity.amount))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center text-muted">
                      No recent activity
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
