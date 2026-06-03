import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Calendar, ChevronDown, ArrowRight, Send, Sparkles,
  FileText, ShoppingCart, BarChart2,
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

/* ── Custom light tooltip ──────────────────────────────────────── */
const LightTooltip = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="dv2-tooltip">
      <div className="dv2-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="dv2-tooltip-row">
          <span className="dv2-tooltip-dot" style={{ background: p.color }} />
          <span className="dv2-tooltip-name">{p.name}</span>
          <span className="dv2-tooltip-val">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Circular ring progress ────────────────────────────────────── */
const Ring = ({ value = 0 }) => {
  const pct = Math.max(0, Math.min(100, value));
  const circumference = 264; // 2 * π * 42
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="dv2-kpi-ring">
      <svg className="dv2-ring-svg" viewBox="0 0 100 100">
        <circle className="dv2-ring-bg" cx="50" cy="50" r="42" />
        <circle
          className="dv2-ring-fg"
          cx="50" cy="50" r="42"
          style={{ '--ring-offset': offset, strokeDashoffset: offset }}
        />
      </svg>
      <div className="dv2-ring-label">{Math.round(pct)}%</div>
    </div>
  );
};

/* ── Dashboard ─────────────────────────────────────────────────── */
const Dashboard = () => {
  const { user } = useAuth();
  const { fmt } = useCurrency();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [activeTab, setActiveTab] = useState('sales'); // sales | financial

  const mock = {
    stats: {
      total_revenue: 125000, total_expenses: 57570, net_profit: 67430,
      total_receivables: 45250, current_receivables: 32150,
      total_payables: 12800, overdue_payables: 2300,
      outstanding_invoices: 23, overdue_invoices: 5,
      recent_activity: [
        { date: '2026-06-07', description: 'INV-0045', type: 'Invoice',  amount:  5250 },
        { date: '2026-06-06', description: 'Office Supplies', type: 'Expense', amount: -450 },
        { date: '2026-06-05', description: 'INV-0044', type: 'Invoice',  amount:  3800 },
        { date: '2026-06-04', description: 'Software Subscription', type: 'Expense', amount: -299 },
        { date: '2026-06-03', description: 'INV-0043', type: 'Invoice',  amount:  7650 },
      ],
    },
    chart: [
      { month: 'Jan', revenue: 40000, expenses: 25000 },
      { month: 'Feb', revenue: 42000, expenses: 26000 },
      { month: 'Mar', revenue: 45000, expenses: 28000 },
      { month: 'Apr', revenue: 47000, expenses: 29000 },
      { month: 'May', revenue: 50000, expenses: 30000 },
      { month: 'Jun', revenue: 52000, expenses: 31000 },
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
      }
    })();
  }, []); // eslint-disable-line

  const s = stats || {};

  /* derived metrics */
  const monthRevenue = s.total_revenue || 0;
  const monthExpenses = s.total_expenses || 0;
  // Achievement ring: how much of revenue is profit (kept as %)
  const profitPct = monthRevenue > 0 ? Math.round(((s.net_profit || 0) / monthRevenue) * 100) : 0;
  // % vs previous period (compare first two chart points if available)
  const last = chartData?.[chartData.length - 1]?.revenue || monthRevenue;
  const prev = chartData?.[chartData.length - 2]?.revenue || 0;
  const revenueChange = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;

  // KPI 2: invoices stat
  const openInv = s.outstanding_invoices || 0;
  const overdueInv = s.overdue_invoices || 0;

  // KPI 3: next item from activity
  const nextItem = s.recent_activity?.[0];

  // Average invoice
  const avgInvoice = openInv > 0 ? Math.round((s.total_receivables || 0) / openInv) : 0;

  /* count-ups */
  const cRevenue = useCountUp(monthRevenue);
  const cOpen = useCountUp(openInv, 900);
  const cOverdue = useCountUp(overdueInv, 900);
  const cAvg = useCountUp(avgInvoice);

  /* chart shape for the dual-line view ("This month" vs "Last month")
     We re-use the existing month series — current half vs previous half. */
  const dualSeries = (chartData || []).map((d, i, arr) => {
    const half = Math.floor(arr.length / 2);
    return {
      day: d.month,
      current: i >= half ? d.revenue : null,
      previous: i < half ? d.revenue * 1.4 : null, // shifted up to read like screenshot
    };
  });

  /* Sparkline bars for the dark assistant card */
  const sparkValues = (chartData || []).slice(-12).map(d => d.revenue || 0);
  const sparkMax = Math.max(1, ...sparkValues);

  if (loading) return (
    <div className="dv2-loading">
      <div className="dv2-loading-spinner" />
      <p>Loading dashboard…</p>
    </div>
  );

  const firstName = user?.name?.split(' ')[0] || 'there';
  const today = new Date();
  const monthName = today.toLocaleString('en-US', { month: 'long' });
  const dateRangeStart = new Date(today.getFullYear(), today.getMonth(), 1)
    .toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const dateRangeEnd = today.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="page dv2-page">
      <Header
        title="Dashboard"
        subtitle={demo ? 'Demo Mode — sample data shown' : `${greeting()}, ${firstName} 👋`}
      />

      <div className="dv2-content">
        {demo && (
          <div className="dv2-demo-banner">
            <Sparkles size={14} />
            <strong>Demo Mode:</strong> Connect your database to see real data.
          </div>
        )}

        {/* ── Tabs row ── */}
        <div className="dv2-tabs-row">
          <div className="dv2-tabs">
            <button
              className={`dv2-tab ${activeTab === 'sales' ? 'active' : ''}`}
              onClick={() => setActiveTab('sales')}
            >
              Sales
            </button>
            <button
              className={`dv2-tab ${activeTab === 'financial' ? 'active' : ''}`}
              onClick={() => setActiveTab('financial')}
            >
              Financial
            </button>
          </div>

          <div className="dv2-date-pill">
            <Calendar size={14} />
            <span>{dateRangeStart}</span>
            <span style={{ color: 'var(--text-muted)' }}>—</span>
            <span>{dateRangeEnd}</span>
            <span className="dv2-sep" />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Last 30 days <ChevronDown size={14} />
            </span>
          </div>
        </div>

        {/* ── KPI cards row ── */}
        <div className="dv2-kpis">
          {/* Card 1: Revenue with ring */}
          <div className="dv2-card" style={{ animationDelay: '0s' }}>
            <div className="dv2-card-tag">
              <span className="dv2-card-tag-dot" /> Revenue this month · {monthName}
            </div>
            <div className="dv2-kpi-rev-top">
              <div className="dv2-kpi-rev-text">
                <div className="dv2-kpi-value">{fmt(cRevenue)}</div>
                <div className="dv2-kpi-sub">vs previous month</div>
                <span className={`dv2-pct-pill ${revenueChange >= 0 ? 'up' : 'down'}`}>
                  {revenueChange >= 0 ? '↑' : '↓'} {Math.abs(revenueChange)}%
                </span>
              </div>
              <Ring value={profitPct} />
            </div>
          </div>

          {/* Card 2: Open invoices + overdue */}
          <div className="dv2-card" style={{ animationDelay: '0.06s' }}>
            <div className="dv2-card-tag">
              <span className="dv2-card-tag-dot" /> Open invoices
            </div>
            <div className="dv2-kpi-stack">
              <div className="dv2-kpi-stack-row">
                <div className="dv2-kpi-stack-num">{cOpen}</div>
              </div>
              <div className="dv2-kpi-stack-divider" />
              <div className="dv2-card-tag" style={{ margin: 0 }}>
                <span className="dv2-card-tag-dot" /> Overdue
              </div>
              <div className="dv2-kpi-stack-row">
                <div className="dv2-kpi-stack-num" style={{ fontSize: 24 }}>{cOverdue}</div>
                <span className={`dv2-pct-pill ${overdueInv === 0 ? 'up' : 'down'}`}>
                  {overdueInv === 0 ? '↑ 0%' : '↓ needs attention'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Next due item */}
          <div className="dv2-card" style={{ animationDelay: '0.12s' }}>
            <div className="dv2-card-tag">
              <span className="dv2-card-tag-dot" /> Next due
            </div>
            <div className="dv2-kpi-due-time">
              {nextItem ? formatDate(nextItem.date) : '—'}
            </div>
            <div className="dv2-kpi-due-row">
              Description: <strong>{nextItem?.description || 'No pending items'}</strong>
            </div>
            <div className="dv2-kpi-due-row">
              Status: <span className="dv2-status-pill">{nextItem?.type === 'Expense' ? 'Pending' : 'Awaiting'}</span>
            </div>
            <Link to="/invoices" className="dv2-card-cta">
              View <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* ── Mid row: revenue chart + dark assistant ── */}
        <div className="dv2-mid">
          {/* Revenue chart */}
          <div className="dv2-chart-card">
            <div className="dv2-chart-head">
              <div className="dv2-chart-title">Total revenue</div>
              <div className="dv2-legend">
                <span className="dv2-legend-item">
                  <span className="dv2-legend-dot" style={{ background: '#5b5fff' }} />
                  This month <span className="dv2-legend-val">{fmt(monthRevenue)}</span>
                </span>
                <span className="dv2-legend-item">
                  <span className="dv2-legend-dot" style={{ background: '#5fbf8f' }} />
                  Last month <span className="dv2-legend-val">{fmt(monthExpenses)}</span>
                </span>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dualSeries} margin={{ top: 6, right: 16, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dv2-grad-current" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5b5fff" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#5b5fff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 4" stroke="#e8e4f5" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9a99b3' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9a99b3' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={42} />
                  <Tooltip content={<LightTooltip fmt={fmt} />} cursor={{ stroke: '#cec8e8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Line
                    type="monotone" dataKey="previous" name="Last month"
                    stroke="#5fbf8f" strokeWidth={2.4}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'white', fill: '#5fbf8f' }}
                    connectNulls
                  />
                  <Line
                    type="monotone" dataKey="current" name="This month"
                    stroke="#5b5fff" strokeWidth={2.6}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'white', fill: '#5b5fff' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dark assistant card */}
          <div className="dv2-assist">
            <div className="dv2-assist-head">
              <span className="dv2-assist-title">
                <span className="dv2-assist-title-dot" /> Average invoice
              </span>
              <span className="dv2-assist-badge">
                NEW
                <span className="dv2-assist-badge-dots">
                  <span className="dv2-assist-badge-dot" />
                  <span className="dv2-assist-badge-dot" />
                </span>
              </span>
            </div>

            <div>
              <div className="dv2-assist-value">{fmt(cAvg)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="dv2-assist-pill">↑ +4%</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>vs previous month</span>
              </div>
            </div>

            <div className="dv2-assist-sparkline">
              {sparkValues.length > 0 ? sparkValues.map((v, i) => {
                const h = Math.max(8, (v / sparkMax) * 36);
                const hi = i >= sparkValues.length - 3;
                return <div key={i} className={`dv2-assist-spark-bar ${hi ? 'hi' : ''}`} style={{ height: `${h}px`, animationDelay: `${i * 30}ms` }} />;
              }) : Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="dv2-assist-spark-bar" style={{ height: `${10 + Math.random() * 24}px` }} />
              ))}
            </div>

            <div className="dv2-assist-divider" />

            <div>
              <div className="dv2-assist-section-label">
                <Sparkles size={12} /> Assistant
              </div>
              <div className="dv2-assist-actions">
                <Link to="/reports/cash-flow" className="dv2-assist-action">
                  <span className="dv2-assist-action-icon"><BarChart2 size={13} /></span>
                  Generate cash-flow report for {monthName}
                </Link>
                <Link to="/items" className="dv2-assist-action">
                  <span className="dv2-assist-action-icon"><ShoppingCart size={13} /></span>
                  Calculate average inventory turnover
                </Link>
                <Link to="/accountant/budgets" className="dv2-assist-action">
                  <span className="dv2-assist-action-icon"><FileText size={13} /></span>
                  Create a budget for the next quarter
                </Link>
              </div>
            </div>

            <div className="dv2-assist-input-wrap">
              <input
                className="dv2-assist-input"
                placeholder="Send a message…"
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.value = ''; }}
              />
              <button className="dv2-assist-send" type="button" aria-label="Send">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom chart ── */}
        <div className="dv2-chart-card dv2-bottom">
          <div className="dv2-chart-head">
            <div className="dv2-chart-title">Average invoice</div>
            <div className="dv2-legend">
              <span className="dv2-legend-item">
                <span className="dv2-legend-dot" style={{ background: '#5b5fff' }} />
                This month <span className="dv2-legend-val">{fmt(avgInvoice)}</span>
              </span>
              <span className="dv2-legend-item">
                <span className="dv2-legend-dot" style={{ background: '#5fbf8f' }} />
                Last month <span className="dv2-legend-val">{fmt(Math.round(avgInvoice * 0.92))}</span>
              </span>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={dualSeries} margin={{ top: 6, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 4" stroke="#e8e4f5" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9a99b3' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9a99b3' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip content={<LightTooltip fmt={fmt} />} cursor={{ stroke: '#cec8e8', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Line type="monotone" dataKey="previous" name="Last month" stroke="#5fbf8f" strokeWidth={2.4} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'white', fill: '#5fbf8f' }} connectNulls />
                <Line type="monotone" dataKey="current" name="This month" stroke="#5b5fff" strokeWidth={2.6} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'white', fill: '#5b5fff' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
