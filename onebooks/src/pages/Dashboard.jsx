import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, FileText, AlertCircle, BarChart2,
  ArrowUpRight, ArrowDownRight, Plus, Users, ShoppingCart, Eye,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { dashboardAPI } from '../services/api';
import { formatDate } from '../utils/helpers';
import useCurrency from '../hooks/useCurrency';
import { useAuth } from '../context/AuthContext';

/* ── Animated counter hook ──────────────────────────────────── */
const useCountUp = (target, duration = 1200) => {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!target && target !== 0) return;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(ease * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
      else setValue(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
};

/* ── Greeting based on time ─────────────────────────────────── */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ── Custom tooltip for charts ───────────────────────────────── */
const CustomTooltip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
      <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 6px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '3px 0', fontSize: 13, fontWeight: 600 }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

/* ── Metric card ─────────────────────────────────────────────── */
const MetricCard = ({ title, rawValue, displayValue, change, changeType, icon: Icon, gradient, delay = 0 }) => {
  const isUp = changeType === 'positive';
  return (
    <div className="dash-metric-card" style={{ animationDelay: `${delay}ms` }}>
      <div className="dash-metric-icon" style={{ background: gradient }}>
        <Icon size={20} color="white" />
      </div>
      <p className="dash-metric-title">{title}</p>
      <h3 className="dash-metric-value">{displayValue}</h3>
      {change && (
        <div className={`dash-metric-change ${isUp ? 'up' : 'down'}`}>
          {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
};

/* ── Quick action button ─────────────────────────────────────── */
const QuickAction = ({ icon: Icon, label, to, color, delay }) => (
  <Link to={to} className="dash-quick-action" style={{ animationDelay: `${delay}ms` }}>
    <div className="dash-quick-icon" style={{ background: color + '18', color }}>
      <Icon size={20} />
    </div>
    <span>{label}</span>
    <ChevronRight size={16} style={{ marginLeft: 'auto', color: '#cbd5e1' }} />
  </Link>
);

/* ── Main Dashboard ──────────────────────────────────────────── */
const Dashboard = () => {
  const { user } = useAuth();
  const { fmt }  = useCurrency();
  const [stats, setStats]       = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const getMockData = () => ({
    stats: {
      total_receivables: 45250, current_receivables: 32150,
      total_payables: 12800,  overdue_payables: 2300,
      total_revenue: 125000,  total_expenses: 57570,
      net_profit: 67430,      outstanding_invoices: 23, overdue_invoices: 5,
      recent_activity: [
        { date: '2026-03-07', description: 'INV-0045', type: 'Invoice',  amount:  5250 },
        { date: '2026-03-06', description: 'Office Supplies', type: 'Expense', amount: -450 },
        { date: '2026-03-05', description: 'INV-0044', type: 'Invoice',  amount:  3800 },
        { date: '2026-03-04', description: 'Software Subscription', type: 'Expense', amount: -299 },
        { date: '2026-03-03', description: 'INV-0043', type: 'Invoice',  amount:  7650 },
      ],
    },
    chart: [
      { month: 'Oct', revenue: 40000, expenses: 25000 },
      { month: 'Nov', revenue: 42000, expenses: 26000 },
      { month: 'Dec', revenue: 45000, expenses: 28000 },
      { month: 'Jan', revenue: 47000, expenses: 29000 },
      { month: 'Feb', revenue: 50000, expenses: 30000 },
      { month: 'Mar', revenue: 52000, expenses: 31000 },
    ],
  });

  const fetchData = async () => {
    try {
      const [sRes, tRes] = await Promise.all([dashboardAPI.getStats(), dashboardAPI.getMonthlyTrend()]);
      setStats(sRes.data);
      setChartData(tRes.data.months_data);
    } catch {
      const mock = getMockData();
      setStats(mock.stats); setChartData(mock.chart); setDemoMode(true);
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-loading-spinner" />
        <p>Loading dashboard…</p>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div className="page dash-page">
      <Header
        title="Dashboard"
        subtitle={demoMode ? 'Demo Mode — sample data shown' : `${getGreeting()}, ${user?.name?.split(' ')[0] || 'there'} 👋`}
      />

      <div className="page-content">
        {demoMode && (
          <div className="dash-demo-banner">
            💡 <strong>Demo Mode:</strong> Connect your database to see real data.
          </div>
        )}

        {/* ── Welcome hero ── */}
        <div className="dash-hero">
          <div className="dash-hero-left">
            <h2 className="dash-hero-title">Here's your business at a glance</h2>
            <p className="dash-hero-sub">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="dash-hero-pills">
              <span className="dash-pill green">{s.outstanding_invoices || 0} outstanding invoices</span>
              {(s.overdue_invoices || 0) > 0 && (
                <span className="dash-pill red">{s.overdue_invoices} overdue</span>
              )}
            </div>
          </div>
          <div className="dash-hero-blob" />
        </div>

        {/* ── Metric cards ── */}
        <div className="dash-metrics">
          <MetricCard title="Total Revenue"      displayValue={fmt(s.total_revenue || 0)}     change={`Expenses: ${fmt(s.total_expenses || 0)}`} changeType="positive" icon={BarChart2}    gradient="linear-gradient(135deg,#8b5cf6,#6366f1)" delay={0} />
          <MetricCard title="Net Profit"         displayValue={fmt(s.net_profit || 0)}         change="This fiscal year"                           changeType={s.net_profit >= 0 ? 'positive' : 'negative'} icon={TrendingUp} gradient="linear-gradient(135deg,#10b981,#059669)" delay={80} />
          <MetricCard title="Total Receivables"  displayValue={fmt(s.total_receivables || 0)}  change={`Current: ${fmt(s.current_receivables || 0)}`} changeType="positive" icon={DollarSign}  gradient="linear-gradient(135deg,#3b82f6,#2563eb)" delay={160} />
          <MetricCard title="Total Payables"     displayValue={fmt(s.total_payables || 0)}     change={`Overdue: ${fmt(s.overdue_payables || 0)}`} changeType="negative" icon={AlertCircle} gradient="linear-gradient(135deg,#ef4444,#dc2626)" delay={240} />
          <MetricCard title="Open Invoices"      displayValue={String(s.outstanding_invoices || 0)} change={`${s.overdue_invoices || 0} overdue`}  changeType="negative" icon={FileText}    gradient="linear-gradient(135deg,#f59e0b,#d97706)" delay={320} />
        </div>

        {/* ── Chart + Quick actions ── */}
        <div className="dash-mid-row">
          {/* Revenue vs Expenses chart */}
          <div className="card dash-chart-card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3>Revenue vs Expenses</h3>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6366f1' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />Revenue</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f43f5e' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} />Expenses</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: '20px 8px' }}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip fmt={fmt} />} />
                  <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#6366f1" strokeWidth={2.5} fill="url(#gRev)" dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gExp)" dot={false} activeDot={{ r: 5, fill: '#f43f5e' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick actions */}
          <div className="dash-actions-col">
            <div className="card" style={{ height: '100%' }}>
              <div className="card-header"><h3>Quick Actions</h3></div>
              <div className="card-body" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <QuickAction icon={Plus}         label="New Invoice"    to="/invoices"    color="#6366f1" delay={0} />
                <QuickAction icon={Users}        label="Add Customer"   to="/customers"   color="#10b981" delay={60} />
                <QuickAction icon={ShoppingCart} label="Record Expense" to="/expenses"    color="#f59e0b" delay={120} />
                <QuickAction icon={BarChart2}    label="Profit & Loss"  to="/reports/profit-loss" color="#3b82f6" delay={180} />
                <QuickAction icon={Eye}          label="Balance Sheet"  to="/reports/balance-sheet" color="#8b5cf6" delay={240} />
                <QuickAction icon={FileText}     label="Trial Balance"  to="/reports/trial-balance" color="#ef4444" delay={300} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Monthly bar overview ── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>Monthly Overview</h3></div>
          <div className="card-body" style={{ padding: '20px 8px' }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip fmt={fmt} />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                <Bar dataKey="revenue"  name="Revenue"  fill="#6366f1" radius={[6,6,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Recent activity ── */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3>Recent Activity</h3>
            <Link to="/invoices" style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {(s.recent_activity?.length || 0) > 0 ? s.recent_activity.map((a, i) => (
              <div key={i} className="dash-activity-row">
                <div className={`dash-activity-dot ${a.amount >= 0 ? 'green' : 'red'}`} />
                <div className="dash-activity-info">
                  <span className="dash-activity-desc">{a.description}</span>
                  <span className="dash-activity-type">{a.type}</span>
                </div>
                <span className="dash-activity-date">{formatDate(a.date)}</span>
                <span className={`dash-activity-amount ${a.amount >= 0 ? 'green' : 'red'}`}>
                  {a.amount >= 0 ? '+' : ''}{fmt(Math.abs(a.amount))}
                </span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
