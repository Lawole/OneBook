import React, { useState, useCallback } from 'react';
import { Download, TrendingUp, BarChart2, Activity, Users, Package, BookOpen } from 'lucide-react';
import Header from '../components/Header';
import { reportAPI } from '../services/api';
import { downloadFile } from '../utils/helpers';
import useCurrency from '../hooks/useCurrency';
import {
  mockSalesByCustomer,
  mockSalesByItem,
  mockTrialBalance,
} from '../utils/mockData';

const isDemoMode = () => localStorage.getItem('demoMode') === 'true';

const SectionTitle = ({ children }) => (
  <div style={{ fontWeight: 700, fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '14px 0 6px' }}>
    {children}
  </div>
);

const Row = ({ label, value, bold, color, indent, fmt }) => (
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

const ProfitLossReport = ({ data, dates, fmt }) => (
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
    <Row fmt={fmt} label="Revenue (Paid Invoices)" value={data.total_revenue} />
    <Row fmt={fmt} label="Total Income" value={data.total_revenue} bold />
    <SectionTitle>Expenses</SectionTitle>
    {(data.expense_breakdown || []).map((item, i) => (
      <Row fmt={fmt} key={i} label={item.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} value={item.amount} indent />
    ))}
    <Row fmt={fmt} label="Total Expenses" value={data.total_expenses} bold />
    <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
      <Row fmt={fmt} label="NET PROFIT" value={data.net_profit} bold color={data.net_profit >= 0 ? '#16a34a' : '#dc2626'} />
    </div>
  </div>
);

const BalanceSheetReport = ({ data, fmt }) => (
  <div>
    <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b', marginBottom: 20 }}>Balance Sheet</div>
    <SectionTitle>Assets</SectionTitle>
    <Row fmt={fmt} label="Accounts Receivable" value={data.assets.accounts_receivable} indent />
    <Row fmt={fmt} label="Inventory" value={data.assets.inventory} indent />
    <Row fmt={fmt} label="Total Assets" value={data.assets.total} bold />
    <SectionTitle>Liabilities</SectionTitle>
    <Row fmt={fmt} label="Accounts Payable" value={data.liabilities.accounts_payable} indent />
    <Row fmt={fmt} label="Total Liabilities" value={data.liabilities.total} bold />
    <SectionTitle>Equity</SectionTitle>
    <Row fmt={fmt} label="Retained Earnings" value={data.equity.retained_earnings} indent />
    <Row fmt={fmt} label="Total Equity" value={data.equity.total} bold />
    <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
      <Row fmt={fmt} label="TOTAL LIABILITIES & EQUITY" value={data.liabilities.total + data.equity.total} bold />
    </div>
  </div>
);

const CashFlowReport = ({ data, dates, fmt }) => (
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
    <Row fmt={fmt} label="Cash Received from Customers" value={data.operating.cash_from_customers} indent />
    <Row fmt={fmt} label="Cash Paid to Suppliers" value={-data.operating.cash_to_suppliers} indent />
    <Row fmt={fmt} label="Net Cash from Operating" value={data.operating.net} bold />
    <SectionTitle>Investing Activities</SectionTitle>
    <Row fmt={fmt} label="Net Cash from Investing" value={data.investing.net} bold />
    <SectionTitle>Financing Activities</SectionTitle>
    <Row fmt={fmt} label="Net Cash from Financing" value={data.financing.net} bold />
    <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
      <Row fmt={fmt} label="NET CHANGE IN CASH" value={data.net_change} bold color={data.net_change >= 0 ? '#16a34a' : '#dc2626'} />
    </div>
  </div>
);

const SalesByCustomerReport = ({ data, dates, fmt }) => {
  const customers = data.customers || [];
  const grandTotal = customers.reduce((s, r) => s + r.total_sales, 0);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Sales by Customer</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {dates.start && dates.end ? `${dates.start} to ${dates.end}` : 'All Time'}
          </div>
        </div>
        <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 18 }}>
          Total: {fmt(grandTotal)}
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th className="text-right">Invoices</th>
            <th className="text-right">Total Sales</th>
            <th className="text-right">Paid</th>
            <th className="text-right">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((r, i) => (
            <tr key={i}>
              <td className="font-medium">{r.customer_name}</td>
              <td className="text-right">{r.invoice_count}</td>
              <td className="text-right">{fmt(r.total_sales)}</td>
              <td className="text-right" style={{ color: '#16a34a' }}>{fmt(r.paid)}</td>
              <td className="text-right" style={{ color: r.outstanding > 0 ? '#dc2626' : '#6b7280' }}>{fmt(r.outstanding)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
            <td>Total</td>
            <td className="text-right">{customers.reduce((s, r) => s + r.invoice_count, 0)}</td>
            <td className="text-right">{fmt(grandTotal)}</td>
            <td className="text-right" style={{ color: '#16a34a' }}>{fmt(customers.reduce((s, r) => s + r.paid, 0))}</td>
            <td className="text-right" style={{ color: '#dc2626' }}>{fmt(customers.reduce((s, r) => s + r.outstanding, 0))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const SalesByItemReport = ({ data, dates, fmt }) => {
  const items = data.items || [];
  const grandTotal = items.reduce((s, r) => s + r.total_revenue, 0);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Sales by Item</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {dates.start && dates.end ? `${dates.start} to ${dates.end}` : 'All Time'}
          </div>
        </div>
        <div style={{ background: '#f0fdf4', color: '#15803d', padding: '8px 20px', borderRadius: 10, fontWeight: 700, fontSize: 18 }}>
          Total: {fmt(grandTotal)}
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Item / Product</th>
            <th className="text-right">Qty Sold</th>
            <th className="text-right">Total Revenue</th>
            <th className="text-right">Avg Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r, i) => (
            <tr key={i}>
              <td className="font-medium">{r.item_name}</td>
              <td className="text-right">{r.qty_sold.toLocaleString()}</td>
              <td className="text-right">{fmt(r.total_revenue)}</td>
              <td className="text-right">{fmt(r.avg_price)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
            <td>Total</td>
            <td className="text-right">{items.reduce((s, r) => s + r.qty_sold, 0).toLocaleString()}</td>
            <td className="text-right">{fmt(grandTotal)}</td>
            <td className="text-right">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const TYPE_COLORS = {
  Asset: '#3b82f6', Liability: '#ef4444', Equity: '#8b5cf6', Revenue: '#10b981', Expense: '#f59e0b',
};

const TrialBalanceReport = ({ data, dates, fmt }) => {
  const accounts = data.accounts || [];
  const { debit: totalDebit, credit: totalCredit } = data.totals || {};
  const balanced = totalDebit === totalCredit;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Trial Balance</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {dates.start && dates.end ? `As of ${dates.end}` : 'Current Period'}
          </div>
        </div>
        <div style={{
          background: balanced ? '#d1fae5' : '#fee2e2',
          color: balanced ? '#065f46' : '#991b1b',
          padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13,
        }}>
          {balanced ? '✓ Balanced' : '⚠ Out of Balance'}
        </div>
      </div>
      {!balanced && (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          Difference: {fmt(Math.abs(totalDebit - totalCredit))} — please review journal entries.
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Account Name</th>
            <th>Type</th>
            <th className="text-right">Debit</th>
            <th className="text-right">Credit</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((r, i) => (
            <tr key={i}>
              <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{r.code}</td>
              <td className="font-medium">{r.name}</td>
              <td>
                <span style={{ background: TYPE_COLORS[r.type] + '18', color: TYPE_COLORS[r.type], padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  {r.type}
                </span>
              </td>
              <td className="text-right">{r.debit > 0 ? fmt(r.debit) : '—'}</td>
              <td className="text-right">{r.credit > 0 ? fmt(r.credit) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700, borderTop: '2px solid #1e293b', background: '#f8fafc' }}>
            <td colSpan={3}>TOTALS</td>
            <td className="text-right">{fmt(totalDebit)}</td>
            <td className="text-right">{fmt(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

const REPORT_TYPES = [
  { value: 'profit-loss',        label: 'Profit & Loss',       icon: TrendingUp },
  { value: 'balance-sheet',      label: 'Balance Sheet',       icon: BarChart2  },
  { value: 'cash-flow',          label: 'Cash Flow',           icon: Activity   },
  { value: 'sales-by-customer',  label: 'Sales by Customer',   icon: Users      },
  { value: 'sales-by-item',      label: 'Sales by Item',       icon: Package    },
  { value: 'trial-balance',      label: 'Trial Balance',       icon: BookOpen   },
];

const EXPORTABLE = ['profit-loss', 'balance-sheet', 'cash-flow'];

const Reports = () => {
  const { fmt } = useCurrency();
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
      if (endDate)   params.end_date = endDate;
      let res;
      if      (reportType === 'profit-loss')       res = await reportAPI.getProfitLoss(params);
      else if (reportType === 'balance-sheet')     res = await reportAPI.getBalanceSheet();
      else if (reportType === 'cash-flow')         res = await reportAPI.getCashFlow(params);
      else if (reportType === 'sales-by-customer') res = await reportAPI.getSalesByCustomer(params);
      else if (reportType === 'sales-by-item')     res = await reportAPI.getSalesByItem(params);
      else if (reportType === 'trial-balance')     res = await reportAPI.getTrialBalance(params);
      setData(res.data);
    } catch (err) {
      if (reportType === 'sales-by-customer' && isDemoMode()) {
        setData({ customers: mockSalesByCustomer });
      } else if (reportType === 'sales-by-item' && isDemoMode()) {
        setData({ items: mockSalesByItem });
      } else if (reportType === 'trial-balance' && isDemoMode()) {
        setData(mockTrialBalance);
      } else {
        setError(err.response?.data?.message || 'Failed to generate report');
      }
    } finally { setLoading(false); }
  }, [reportType, startDate, endDate]);

  const handleExport = useCallback(async (format) => {
    if (!EXPORTABLE.includes(reportType)) {
      alert('Export is not yet supported for this report type.');
      return;
    }
    setExporting(true);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date = endDate;
      let res;
      const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      if      (reportType === 'profit-loss')   res = await reportAPI.exportProfitLoss(format, params);
      else if (reportType === 'balance-sheet') res = await reportAPI.exportBalanceSheet(format);
      else if (reportType === 'cash-flow')     res = await reportAPI.exportCashFlow(format, params);
      downloadFile(res.data, filename);
    } catch (err) {
      alert('Failed to export report');
    } finally { setExporting(false); }
  }, [reportType, startDate, endDate]);

  return (
    <div className="page">
      <Header title="Reports" subtitle="Generate and export financial reports" />
      <div className="page-content">

        {/* Report type selector — wrap into two rows for 6 types */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
          {REPORT_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => { setReportType(value); setData(null); setError(''); }}
              style={{
                padding: '12px 14px', borderRadius: 12, border: '2px solid',
                borderColor: reportType === value ? '#4f46e5' : '#e2e8f0',
                background: reportType === value ? '#4f46e5' : '#fff',
                color: reportType === value ? '#fff' : '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
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
              {EXPORTABLE.includes(reportType) && (
                <>
                  <button className="btn btn-outline" onClick={() => handleExport('excel')} disabled={exporting || !data} style={{ height: 42 }}>
                    <Download size={16} /> Excel
                  </button>
                  <button className="btn btn-outline" onClick={() => handleExport('csv')} disabled={exporting || !data} style={{ height: 42 }}>
                    <Download size={16} /> CSV
                  </button>
                </>
              )}
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
              <ProfitLossReport data={data} dates={{ start: startDate, end: endDate }} fmt={fmt} />
            )}
            {data && reportType === 'balance-sheet' && (
              <BalanceSheetReport data={data} fmt={fmt} />
            )}
            {data && reportType === 'cash-flow' && (
              <CashFlowReport data={data} dates={{ start: startDate, end: endDate }} fmt={fmt} />
            )}
            {data && reportType === 'sales-by-customer' && (
              <SalesByCustomerReport data={data} dates={{ start: startDate, end: endDate }} fmt={fmt} />
            )}
            {data && reportType === 'sales-by-item' && (
              <SalesByItemReport data={data} dates={{ start: startDate, end: endDate }} fmt={fmt} />
            )}
            {data && reportType === 'trial-balance' && (
              <TrialBalanceReport data={data} dates={{ start: startDate, end: endDate }} fmt={fmt} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Reports;
