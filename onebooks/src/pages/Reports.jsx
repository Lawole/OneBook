import React, { useState, useCallback } from 'react';
import { Download, TrendingUp, BarChart2, Activity } from 'lucide-react';
import Header from '../components/Header';
import { reportAPI } from '../services/api';
import { formatCurrency, downloadFile } from '../utils/helpers';

const fmt = (n) => formatCurrency(n || 0);

const SectionTitle = ({ children }) => (
  <div style={{ fontWeight: 700, fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '14px 0 6px' }}>
    {children}
  </div>
);

const Row = ({ label, value, bold, color, indent }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9', paddingLeft: indent ? 20 : 0 }}>
    <span style={{ fontWeight: bold ? 700 : 400, color: color || '#334155', fontSize: 14 }}>{label}</span>
    <span style={{ fontWeight: bold ? 700 : 500, color: color || (value < 0 ? '#ef4444' : '#1e293b'), fontSize: 14 }}>
      {fmt(value)}
    </span>
  </div>
);

const EmptyState = () => (
  <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
    <p style={{ fontSize: 15 }}>Select a report type and date range, then click <strong>Generate Report</strong>.</p>
  </div>
);

const ProfitLossReport = ({ data, dates }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Profit & Loss Statement</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          {dates.start && dates.end ? `${dates.start} to ${dates.end}` : 'All Time'}
        </div>
      </div>
      <div style={{
        background: data.net_profit >= 0 ? '#d1fae5' : '#fee2e2',
        color: data.net_profit >= 0 ? '#065f46' : '#991b1b',
        padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 18,
      }}>
        Net: {fmt(data.net_profit)}
      </div>
    </div>
    <SectionTitle>Income</SectionTitle>
    <Row label="Revenue (Paid Invoices)" value={data.total_revenue} />
    <Row label="Total Income" value={data.total_revenue} bold />
    <SectionTitle>Expenses</SectionTitle>
    {(data.expense_breakdown || []).map((item, i) => (
      <Row key={i} label={item.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={item.amount} indent />
    ))}
    <Row label="Total Expenses" value={data.total_expenses} bold />
    <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
      <Row label="NET PROFIT" value={data.net_profit} bold color={data.net_profit >= 0 ? '#16a34a' : '#dc2626'} />
    </div>
  </div>
);

const BalanceSheetReport = ({ data }) => (
  <div>
    <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b', marginBottom: 20 }}>Balance Sheet</div>
    <SectionTitle>Assets</SectionTitle>
    <Row label="Accounts Receivable" value={data.assets.accounts_receivable} indent />
    <Row label="Inventory" value={data.assets.inventory} indent />
    <Row label="Total Assets" value={data.assets.total} bold />
    <SectionTitle>Liabilities</SectionTitle>
    <Row label="Accounts Payable" value={data.liabilities.accounts_payable} indent />
    <Row label="Total Liabilities" value={data.liabilities.total} bold />
    <SectionTitle>Equity</SectionTitle>
    <Row label="Retained Earnings" value={data.equity.retained_earnings} indent />
    <Row label="Total Equity" value={data.equity.total} bold />
    <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
      <Row label="TOTAL LIABILITIES & EQUITY" value={data.liabilities.total + data.equity.total} bold />
    </div>
  </div>
);

const CashFlowReport = ({ data, dates }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Cash Flow Statement</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          {dates.start && dates.end ? `${dates.start} to ${dates.end}` : 'All Time'}
        </div>
      </div>
    </div>
    <SectionTitle>Operating Activities</SectionTitle>
    <Row label="Cash Received from Customers" value={data.operating.cash_from_customers} indent />
    <Row label="Cash Paid to Suppliers" value={-data.operating.cash_to_suppliers} indent />
    <Row label="Net Cash from Operating" value={data.operating.net} bold />
    <SectionTitle>Investing Activities</SectionTitle>
    <Row label="Net Cash from Investing" value={data.investing.net} bold />
    <SectionTitle>Financing Activities</SectionTitle>
    <Row label="Net Cash from Financing" value={data.financing.net} bold />
    <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
      <Row label="NET CHANGE IN CASH" value={data.net_change} bold color={data.net_change >= 0 ? '#16a34a' : '#dc2626'} />
    </div>
  </div>
);

const REPORT_TYPES = [
  { value: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp },
  { value: 'balance-sheet', label: 'Balance Sheet', icon: BarChart2 },
  { value: 'cash-flow', label: 'Cash Flow', icon: Activity },
];

const Reports = () => {
  const [reportType, setReportType] = useState('profit-loss');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const generate = useCallback(async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      let res;
      if (reportType === 'profit-loss') res = await reportAPI.getProfitLoss(params);
      else if (reportType === 'balance-sheet') res = await reportAPI.getBalanceSheet();
      else if (reportType === 'cash-flow') res = await reportAPI.getCashFlow(params);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report');
    } finally { setLoading(false); }
  }, [reportType, startDate, endDate]);

  const handleExport = useCallback(async (format) => {
    setExporting(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      let res;
      const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      if (reportType === 'profit-loss') res = await reportAPI.exportProfitLoss(format, params);
      else if (reportType === 'balance-sheet') res = await reportAPI.exportBalanceSheet(format);
      else if (reportType === 'cash-flow') res = await reportAPI.exportCashFlow(format, params);
      downloadFile(res.data, filename);
    } catch (err) {
      alert('Failed to export report');
    } finally { setExporting(false); }
  }, [reportType, startDate, endDate]);

  return (
    <div className="page">
      <Header title="Reports" subtitle="Generate and export financial reports" />
      <div className="page-content">

        {/* Report type selector */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {REPORT_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setReportType(value); setData(null); setError(''); }}
              style={{
                flex: 1, padding: '14px 16px', borderRadius: 12, border: '2px solid',
                borderColor: reportType === value ? '#4f46e5' : '#e2e8f0',
                background: reportType === value ? '#4f46e5' : '#fff',
                color: reportType === value ? '#fff' : '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                <label>Start Date</label>
                <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                <label>End Date</label>
                <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ height: 42, whiteSpace: 'nowrap' }}>
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
              <button className="btn btn-outline" onClick={() => handleExport('excel')} disabled={exporting || !data} style={{ height: 42 }}>
                <Download size={16} /> Excel
              </button>
              <button className="btn btn-outline" onClick={() => handleExport('csv')} disabled={exporting || !data} style={{ height: 42 }}>
                <Download size={16} /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* Report output */}
        <div className="card">
          <div className="card-body">
            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>{error}</div>
            )}
            {!data && !loading && !error && <EmptyState />}
            {loading && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 15 }}>Generating report...</div>
            )}
            {data && reportType === 'profit-loss' && (
              <ProfitLossReport data={data} dates={{ start: startDate, end: endDate }} />
            )}
            {data && reportType === 'balance-sheet' && (
              <BalanceSheetReport data={data} />
            )}
            {data && reportType === 'cash-flow' && (
              <CashFlowReport data={data} dates={{ start: startDate, end: endDate }} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Reports;
