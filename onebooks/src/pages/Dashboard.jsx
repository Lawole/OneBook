import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  DollarSign, TrendingUp, FileText, AlertCircle, BarChart2,
  ArrowUpRight, ArrowDownRight, Plus, Users, ShoppingCart,
  Eye, ChevronRight, Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { dashboardAPI } from '../services/api';
import { formatDate } from '../utils/helpers';
import useCurrency from '../hooks/useCurrency';
import { useAuth } from '../context/AuthContext';

/* ── Count-up hook ─────────────────────────────────────────────── */
const useCountUp = (target, duration = 1400) => {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!target && target !== 0) return;
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(e * target));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
};

/* ── Greeting ──────────────────────────────────────────────────── */
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ── Dark tooltip ──────────────────────────────────────────────── */
const DarkTooltip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '10px 16px', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p style={{ color: '#64748b', fontSize: 11, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{p.name}:</span>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Animated metric card ──────────────────────────────────────── */
const MetricCard = ({ title, value, animVal, change, up, icon: Icon, gradient, accent, delay }) => (
  <div className="dmc" style={{ '--accent': accent, animationDelay: `${delay}ms` }}>
    <div className="dmc-top">
      <div className="dmc-icon" style={{ background: gradient }}>
        <Icon size={18} color="white" />
      </div>
      <div className={`dmc-badge ${up ? 'up' : 'down'}`}>
        {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      </div>
    </div>
    <div className="dmc-value">{animVal ?? value}</div>
    <div className="dmc-title">{title}</div>
    {change && <div className={`dmc-change ${up ? 'up' : 'down'}`}>{change}</div>}
    <div className="dmc-bar" />
  </div>
);

/* ── Quick action ──────────────────────────────────────────────── */
const QA = ({ icon: Icon, label, sub, to, color, delay }) => (
  <Link to={to} className="dqa" style={{ animationDelay: `${delay}ms` }}>
    <div className="dqa-icon" style={{ background: color + '15', color }}>
      <Icon size={18} />
    </div>
    <div className="dqa-text">
      <span className="dqa-label">{label}</span>
      {sub && <span className="dqa-sub">{sub}</span>}
    </div>
    <ChevronRight size={15} color="#cbd5e1" style={{ marginLeft: 'auto', flexShrink: 0 }} />
  </Link>
);

/* ── Dashboard ─────────────────────────────────────────────────── */
const Dashboard = () => {
  const { user }       = useAuth();
  const { fmt }        = useCurrency();
  const [stats, setStats]         = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [demo, setDemo]           = useState(false);
  const [visible, setVisible]     = useState(false);

  const mock = {
    stats: {
      total_revenue: 125000, total_expenses: 57570, net_profit: 67430,
      total_receivables: 45250, current_receivables: 32150,
      total_payables: 12800, overdue_payables: 2300,
      outstanding_invoices: 23, overdue_invoices: 5,
      recent_activity: [
        { date: '2026-03-07', description: 'INV-0045', type: 'Invoice',  amount:  5250 },
        { date: '2026-03-06', description: 'Office Supplies', type: 'Expense', amount: -450 },
        { date: '2026-03-05', description: 'INV-0044', type: 'Invoice',  amount:  3800 },
        { date: '2026-03-04', description: 'Software Sub',   type: 'Expense', amount: -299 },
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
  };

  useEffect(() => {
    (async () => {
      try {
        const [sR, tR] = await Promise.all([dashboardAPI.getStats(), dashboardAPI.getMonthlyTrend()]);
        setStats(sR.data); setChartData(tR.data.months_data);
      } catch {
        setStats(mock.stats); setChartData(mock.chart); setDemo(true);
      } finally {
        setLoading(false);
        setTimeout(() => setVisible(true), 60);
      }
    })();
  }, []); // eslint-disable-line

  /* count-up targets */
  const s          = stats || {};
  const cRevenue   = useCountUp(visible ? (s.total_revenue   || 0) : 0);
  const cProfit    = useCountUp(visible ? (s.net_profit      || 0) : 0);
  const cReceiv    = useCountUp(visible ? (s.total_receivables || 0) : 0);
  const cPayables  = useCountUp(visible ? (s.total_payables  || 0) : 0);
  const cInvoices  = useCountUp(visible ? (s.outstanding_invoices || 0) : 0, 900);

  if (loading) return (
    <div className="dash-loading">
      <div className="dash-spinner" />
      <p>Loading dashboard…</p>
    </div>
  );

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className={`page dash-page ${visible ? 'dash-visible' : ''}`}>
      <Header
        title="Dashboard"
        subtitle={demo ? 'Demo Mode — sample data shown' : `${greeting()}, ${firstName} 👋`}
      />

      <div className="page-content">
        {demo && (
          <div className="dash-demo-banner">
            ⚡ <strong>Demo Mode:</strong> Connect your database to see real data.
          </div>
        )}

        {/* ── HERO ── */}
        <div className="dash-hero">
          <div className="dash-hero-bg1" /><div className="dash-hero-bg2" />
          <div className="dash-hero-inner">
            <div className="dash-hero-left">
              {user?.avatar_url
                ? <img className="dash-hero-avatar" src={user.avatar_url} alt="company" />
                : <div className="dash-hero-avatar dash-hero-avatar-init">{(user?.name || 'C').charAt(0).toUpperCase()}</div>
              }
              <div>
                <h2 className="dash-hero-title">{greeting()}, {firstName}</h2>
                <p className="dash-hero-date">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="dash-hero-tags">
                  <span className="dash-tag teal"><Zap size={11} /> {s.outstanding_invoices || 0} open invoices</span>
                  {(s.overdue_invoices || 0) > 0 && <span className="dash-tag red">⚠ {s.overdue_invoices} overdue</span>}
                  <span className="dash-tag purple">Net profit: {fmt(s.net_profit || 0)}</span>
                </div>
              </div>
            </div>
            <div className="dash-hero-kpis">
              <div className="dash-hero-kpi">
                <span className="dash-hero-kpi-val">{fmt(s.total_revenue || 0)}</span>
                <span className="dash-hero-kpi-label">Total Revenue</span>
              </div>
              <div className="dash-hero-kpi-div" />
              <div className="dash-hero-kpi">
                <span className="dash-hero-kpi-val">{fmt(s.total_expenses || 0)}</span>
                <span className="dash-hero-kpi-label">Total Expenses</span>
              </div>
              <div className="dash-hero-kpi-div" />
              <div className="dash-hero-kpi">
                <span className="dash-hero-kpi-val" style={{ color: s.net_profit >= 0 ? '#34d399' : '#f87171' }}>{fmt(s.net_profit || 0)}</span>
                <span className="dash-hero-kpi-label">Net Profit</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="dash-metrics">
          <MetricCard title="Total Revenue"     animVal={fmt(cRevenue)}  change={`Expenses: ${fmt(s.total_expenses||0)}`}         up={true}  icon={BarChart2}    gradient="linear-gradient(135deg,#8b5cf6,#6366f1)" accent="#8b5cf6" delay={0}   />
          <MetricCard title="Net Profit"        animVal={fmt(cProfit)}   change="This fiscal year"                                 up={s.net_profit>=0} icon={TrendingUp} gradient="linear-gradient(135deg,#10b981,#059669)" accent="#10b981" delay={70}  />
          <MetricCard title="Total Receivables" animVal={fmt(cReceiv)}   change={`Current: ${fmt(s.current_receivables||0)}`}     up={true}  icon={DollarSign}  gradient="linear-gradient(135deg,#3b82f6,#2563eb)" accent="#3b82f6" delay={140} />
          <MetricCard title="Total Payables"    animVal={fmt(cPayables)} change={`Overdue: ${fmt(s.overdue_payables||0)}`}        up={false} icon={AlertCircle} gradient="linear-gradient(135deg,#ef4444,#dc2626)" accent="#ef4444" delay={210} />
          <MetricCard title="Open Invoices"     animVal={String(cInvoices)} change={`${s.overdue_invoices||0} overdue`}           up={false} icon={FileText}    gradient="linear-gradient(135deg,#f59e0b,#d97706)" accent="#f59e0b" delay={280} />
        </div>

        {/* ── CHART ROW ── */}
        <div className="dash-mid">

          {/* Area chart */}
          <div className="card dash-chart-card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Revenue vs Expenses</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Last 6 months overview</p>
                </div>
                <div style={{ display: 'flex', gap: 14 }}>
                  {[['#6366f1','Revenue'],['#f43f5e','Expenses']].map(([c,l]) => (
                    <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />{l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="card-body" style={{ padding: '16px 8px 16px 4px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f43f5e" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={36} />
                  <Tooltip content={<DarkTooltip fmt={fmt} />} />
                  <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#6366f1" strokeWidth={2.5} fill="url(#gR)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#6366f1' }} />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gE)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: '#f43f5e' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card dash-qa-card">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Quick Actions</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Common tasks</p>
            </div>
            <div className="card-body" style={{ padding: '8px 14px 14px' }}>
              <QA icon={Plus}         label="New Invoice"    sub="Create & send"          to="/invoices"                  color="#6366f1" delay={0}   />
              <QA icon={Users}        label="Add Customer"   sub="Manage contacts"        to="/customers"                 color="#10b981" delay={50}  />
              <QA icon={ShoppingCart} label="Record Expense" sub="Track spending"         to="/expenses"                  color="#f59e0b" delay={100} />
              <QA icon={BarChart2}    label="Profit & Loss"  sub="Income statement"       to="/reports/profit-loss"       color="#3b82f6" delay={150} />
              <QA icon={Eye}          label="Balance Sheet"  sub="Financial position"     to="/reports/balance-sheet"     color="#8b5cf6" delay={200} />
              <QA icon={FileText}     label="Trial Balance"  sub="Account balances"       to="/reports/trial-balance"     color="#ef4444" delay={250} />
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="dash-bottom">

          {/* Bar chart */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Monthly Breakdown</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Revenue vs Expenses per month</p>
            </div>
            <div className="card-body" style={{ padding: '12px 8px 16px 4px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={36} />
                  <Tooltip content={<DarkTooltip fmt={fmt} />} />
                  <Bar dataKey="revenue"  name="Revenue"  fill="#6366f1" radius={[5,5,0,0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[5,5,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity feed */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0 }}>Recent Activity</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>Latest transactions</p>
              </div>
              <Link to="/invoices" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                View all <ChevronRight size={14} />
              </Link>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {(s.recent_activity?.length || 0) > 0
                ? s.recent_activity.map((a, i) => (
                    <div key={i} className="dash-act-row" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className={`dash-act-dot ${a.amount >= 0 ? 'teal' : 'red'}`} />
                      <div className="dash-act-body">
                        <span className="dash-act-desc">{a.description}</span>
                        <span className="dash-act-badge">{a.type}</span>
                      </div>
                      <span className="dash-act-date">{formatDate(a.date)}</span>
                      <span className={`dash-act-amt ${a.amount >= 0 ? 'teal' : 'red'}`}>
                        {a.amount >= 0 ? '+' : ''}{fmt(Math.abs(a.amount))}
                      </span>
                    </div>
                  ))
                : <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 14 }}>No recent activity yet</div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
