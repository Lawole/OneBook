import React, { useState, useCallback, useEffect } from 'react';
import { Download, TrendingUp, BarChart2, Activity, Users, Package, BookOpen, FileText, X } from 'lucide-react';
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

// ── Drill-down: click any figure tied to a CoA account to open its ledger ──
const LedgerContext = React.createContext({ open: () => {} });

const LedgerModal = ({ state, onClose, fmt }) => {
  if (!state) return null;
  const { loading, error, account, lines, totals, period } = state;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 24, width: '100%',
        maxWidth: 860, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Account Ledger
            </div>
            <h3 style={{ margin: '4px 0 4px' }}>
              {account ? (
                <>
                  <span style={{ fontFamily: 'monospace', color: '#64748b', marginRight: 8 }}>{account.code}</span>
                  {account.name}
                </>
              ) : (loading ? 'Loading…' : 'Ledger')}
            </h3>
            {account && (
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {account.type} · {account.category}
                {period && period.start_date && period.end_date && (
                  <span> · {period.start_date} to {period.end_date}</span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>Loading ledger…</div>
        )}
        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12 }}>
            {error}
          </div>
        )}
        {!loading && !error && lines && lines.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
            No journal lines for this account in the selected period.
          </div>
        )}
        {!loading && !error && lines && lines.length > 0 && (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
                <th className="text-right">Running</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.date && String(l.date).split('T')[0]}</td>
                  <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{l.reference}</td>
                  <td style={{ color: '#475569' }}>{l.description}</td>
                  <td className="text-right" style={{ color: '#3b82f6' }}>{l.debit ? fmt(l.debit) : '—'}</td>
                  <td className="text-right" style={{ color: '#ef4444' }}>{l.credit ? fmt(l.credit) : '—'}</td>
                  <td className="text-right" style={{ fontWeight: 600 }}>{fmt(l.running_balance)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid #1e293b', background: '#f8fafc' }}>
                  <td colSpan={3}>Totals</td>
                  <td className="text-right" style={{ color: '#3b82f6' }}>{fmt(totals.debit)}</td>
                  <td className="text-right" style={{ color: '#ef4444' }}>{fmt(totals.credit)}</td>
                  <td className="text-right">{fmt(totals.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <div style={{ fontWeight: 700, fontSize: 13, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '14px 0 6px' }}>
    {children}
  </div>
);

const Row = ({ label, value, prev, bold, color, indent, fmt, accountCode }) => {
  const hasPrev = prev !== undefined && prev !== null;
  const variance = hasPrev ? value - prev : 0;
  const variancePct = hasPrev && prev !== 0 ? (variance / Math.abs(prev)) * 100 : 0;
  const { open } = React.useContext(LedgerContext);
  const clickable = !!accountCode;
  const handleClick = clickable ? () => open(accountCode) : undefined;
  const valueColor = color || (value < 0 ? '#ef4444' : (clickable ? '#4f46e5' : '#1e293b'));
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: hasPrev ? '1fr 140px 140px 110px' : '1fr auto',
      gap: 12,
      alignItems: 'center',
      padding: '7px 0',
      borderBottom: '1px solid #f1f5f9',
      paddingLeft: indent ? 20 : 0,
    }}>
      <span style={{ fontWeight: bold ? 700 : 400, color: color || '#334155', fontSize: 14 }}>{label}</span>
      <span
        onClick={handleClick}
        title={clickable ? `Open ledger for ${accountCode}` : undefined}
        style={{
          textAlign: 'right',
          fontWeight: bold ? 700 : 500,
          color: valueColor,
          fontSize: 14,
          cursor: clickable ? 'pointer' : 'default',
          textDecoration: clickable ? 'underline dotted' : 'none',
          textDecorationThickness: '1px',
          textUnderlineOffset: '3px',
        }}
      >
        {fmt(value)}
      </span>
      {hasPrev && (
        <>
          <span
            onClick={handleClick}
            style={{
              textAlign: 'right', fontWeight: bold ? 700 : 500, color: '#64748b', fontSize: 14,
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            {fmt(prev)}
          </span>
          <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 600, color: variance >= 0 ? '#16a34a' : '#dc2626' }}>
            {variance >= 0 ? '▲' : '▼'} {prev !== 0 ? `${Math.abs(variancePct).toFixed(1)}%` : '—'}
          </span>
        </>
      )}
    </div>
  );
};

const ColumnHeader = ({ currentLabel, prevLabel }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: prevLabel ? '1fr 140px 140px 110px' : '1fr auto',
    gap: 12,
    padding: '6px 0',
    borderBottom: '2px solid #e2e8f0',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }}>
    <span />
    <span style={{ textAlign: 'right' }}>{currentLabel}</span>
    {prevLabel && (
      <>
        <span style={{ textAlign: 'right' }}>{prevLabel}</span>
        <span style={{ textAlign: 'right' }}>Δ</span>
      </>
    )}
  </div>
);

const EmptyState = () => (
  <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
    <p style={{ fontSize: 15 }}>Select a report type and date range, then click <strong>Generate Report</strong>.</p>
  </div>
);

const ProfitLossReport = ({ data, prev, dates, prevDates, fmt }) => {
  // Merge expense categories from both periods so each line shows current + previous
  const lookupPrev = (cat) => {
    if (!prev) return undefined;
    const m = (prev.expense_breakdown || []).find(x => x.category === cat);
    return m ? m.amount : 0;
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Profit & Loss Statement</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {dates.start && dates.end ? `${dates.start} to ${dates.end}` : 'All Time'}
            {prev && prevDates && prevDates.start && prevDates.end && (
              <span> · vs {prevDates.start} to {prevDates.end}</span>
            )}
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
      {prev && <ColumnHeader currentLabel="Current" prevLabel="Previous" />}
      <SectionTitle>Income</SectionTitle>
      <Row fmt={fmt} label="Revenue (Paid Invoices)" value={data.total_revenue} prev={prev?.total_revenue} />
      <Row fmt={fmt} label="Total Income" value={data.total_revenue} prev={prev?.total_revenue} bold />
      <SectionTitle>Expenses</SectionTitle>
      {(data.expense_breakdown || []).map((item, i) => (
        <Row fmt={fmt} key={i}
          label={item.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          value={item.amount}
          prev={prev ? lookupPrev(item.category) : undefined}
          accountCode={item.account_code}
          indent />
      ))}
      <Row fmt={fmt} label="Total Expenses" value={data.total_expenses} prev={prev?.total_expenses} bold />
      <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
        <Row fmt={fmt} label="NET PROFIT" value={data.net_profit} prev={prev?.net_profit} bold
          color={data.net_profit >= 0 ? '#16a34a' : '#dc2626'} />
      </div>
    </div>
  );
};

const BalanceSheetReport = ({ data, prev, fmt }) => {
  const findPrev = (list, code) => {
    if (!prev || !list) return undefined;
    const m = list.find(x => x.code === code);
    return m ? m.balance : 0;
  };
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b', marginBottom: 20 }}>Balance Sheet</div>
      {prev && <ColumnHeader currentLabel="Current" prevLabel="Previous" />}
      <SectionTitle>Assets</SectionTitle>
      <Row fmt={fmt} label="Accounts Receivable" value={data.assets.accounts_receivable} prev={prev?.assets?.accounts_receivable} indent />
      <Row fmt={fmt} label="Inventory" value={data.assets.inventory} prev={prev?.assets?.inventory} indent />
      {(data.assets.accounts || []).filter(a => a.balance !== 0).map(a => (
        <Row fmt={fmt} key={a.code}
          label={`${a.code} — ${a.name}`}
          value={a.balance}
          prev={prev ? findPrev(prev.assets?.accounts, a.code) : undefined}
          accountCode={a.code}
          indent />
      ))}
      <Row fmt={fmt} label="Total Assets" value={data.assets.total} prev={prev?.assets?.total} bold />
      <SectionTitle>Liabilities</SectionTitle>
      {(data.liabilities.accounts || []).filter(a => a.balance !== 0).map(a => (
        <Row fmt={fmt} key={a.code}
          label={`${a.code} — ${a.name}`}
          value={a.balance}
          prev={prev ? findPrev(prev.liabilities?.accounts, a.code) : undefined}
          accountCode={a.code}
          indent />
      ))}
      <Row fmt={fmt} label="Total Liabilities" value={data.liabilities.total} prev={prev?.liabilities?.total} bold />
      <SectionTitle>Equity</SectionTitle>
      {(data.equity.accounts || []).filter(a => a.balance !== 0).map(a => (
        <Row fmt={fmt} key={a.code}
          label={`${a.code} — ${a.name}`}
          value={a.balance}
          prev={prev ? findPrev(prev.equity?.accounts, a.code) : undefined}
          accountCode={a.code}
          indent />
      ))}
      <Row fmt={fmt} label="Retained Earnings" value={data.equity.retained_earnings} prev={prev?.equity?.retained_earnings} indent />
      <Row fmt={fmt} label="Total Equity" value={data.equity.total} prev={prev?.equity?.total} bold />
      <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
        <Row fmt={fmt} label="TOTAL LIABILITIES & EQUITY"
          value={data.liabilities.total + data.equity.total}
          prev={prev ? (prev.liabilities.total + prev.equity.total) : undefined}
          bold />
      </div>
    </div>
  );
};

const CashFlowReport = ({ data, prev, dates, prevDates, fmt }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Cash Flow Statement</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
          {dates.start && dates.end ? `${dates.start} to ${dates.end}` : 'All Time'}
          {prev && prevDates && prevDates.start && prevDates.end && (
            <span> · vs {prevDates.start} to {prevDates.end}</span>
          )}
        </div>
      </div>
    </div>
    {prev && <ColumnHeader currentLabel="Current" prevLabel="Previous" />}
    <SectionTitle>Operating Activities</SectionTitle>
    <Row fmt={fmt} label="Cash Received from Customers" value={data.operating.cash_from_customers} prev={prev?.operating?.cash_from_customers} indent />
    <Row fmt={fmt} label="Cash Paid to Suppliers" value={-data.operating.cash_to_suppliers} prev={prev ? -prev.operating.cash_to_suppliers : undefined} indent />
    <Row fmt={fmt} label="Net Cash from Operating" value={data.operating.net} prev={prev?.operating?.net} bold />
    <SectionTitle>Investing Activities</SectionTitle>
    <Row fmt={fmt} label="Net Cash from Investing" value={data.investing.net} prev={prev?.investing?.net} bold />
    <SectionTitle>Financing Activities</SectionTitle>
    <Row fmt={fmt} label="Net Cash from Financing" value={data.financing.net} prev={prev?.financing?.net} bold />
    <div style={{ marginTop: 16, borderTop: '2px solid #e2e8f0', paddingTop: 12 }}>
      <Row fmt={fmt} label="NET CHANGE IN CASH" value={data.net_change} prev={prev?.net_change} bold
        color={data.net_change >= 0 ? '#16a34a' : '#dc2626'} />
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
  const { open } = React.useContext(LedgerContext);
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
            <tr key={i} onClick={() => open(r.code)} style={{ cursor: 'pointer' }} title={`Open ledger for ${r.code}`}>
              <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{r.code}</td>
              <td className="font-medium">{r.name}</td>
              <td>
                <span style={{ background: TYPE_COLORS[r.type] + '18', color: TYPE_COLORS[r.type], padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  {r.type}
                </span>
              </td>
              <td className="text-right" style={{ color: r.debit  > 0 ? '#4f46e5' : '#94a3b8', textDecoration: r.debit  > 0 ? 'underline dotted' : 'none' }}>{r.debit > 0 ? fmt(r.debit) : '—'}</td>
              <td className="text-right" style={{ color: r.credit > 0 ? '#4f46e5' : '#94a3b8', textDecoration: r.credit > 0 ? 'underline dotted' : 'none' }}>{r.credit > 0 ? fmt(r.credit) : '—'}</td>
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

const STATUS_STYLES = {
  Paid:   { background: '#d1fae5', color: '#065f46' },
  Unpaid: { background: '#fef3c7', color: '#92400e' },
};

// On-screen preview of the Invoice report — one row per invoice line item,
// mirroring the FIRS B2B template. Invoice-level values render on the first
// line of each invoice only; the Excel/CSV export repeats them on every row
// exactly as the upload template requires.
const InvoiceReport = ({ data, dates, fmt }) => {
  const rows = data.rows || [];
  const summary = data.summary || {};
  const isoDate = (d) => (d ? String(d).split('T')[0] : '—');
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>Invoice Report</div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {dates.start && dates.end ? `${dates.start} to ${dates.end}` : 'All Time'}
            {' · '}{summary.invoice_count || 0} invoice{summary.invoice_count === 1 ? '' : 's'}
            {' · '}{summary.line_count || 0} line item{summary.line_count === 1 ? '' : 's'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ background: '#f1f5f9', color: '#475569', padding: '8px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13 }}>
            VAT: {fmt(summary.vat || 0)}
          </div>
          <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 15 }}>
            Total: {fmt(summary.total || 0)}
          </div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
          No invoices found for the selected period.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Customer</th>
                <th>Item</th>
                <th>Category</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Amount</th>
                <th className="text-right">VAT</th>
                <th className="text-right">Total</th>
                <th>Currency</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const firstLine = i === 0 || rows[i - 1].invoice_id !== r.invoice_id;
                const badge = STATUS_STYLES[r.payment_status] || STATUS_STYLES.Unpaid;
                return (
                  <tr key={i} style={firstLine && i !== 0 ? { borderTop: '2px solid #e2e8f0' } : undefined}>
                    <td className="font-medium" style={{ fontFamily: 'monospace' }}>{firstLine ? r.invoice_number : ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{firstLine ? isoDate(r.issue_date) : ''}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{firstLine ? isoDate(r.due_date) : ''}</td>
                    <td>{firstLine ? r.customer_name : ''}</td>
                    <td style={{ color: '#475569' }}>{r.item_name || '—'}</td>
                    <td style={{ color: '#64748b' }}>{r.item_category || '—'}</td>
                    <td className="text-right">{r.quantity != null ? r.quantity.toLocaleString() : '—'}</td>
                    <td className="text-right">{r.unit_price != null ? fmt(r.unit_price) : '—'}</td>
                    <td className="text-right">{r.amount != null ? fmt(r.amount) : '—'}</td>
                    <td className="text-right" style={{ color: '#64748b' }}>{firstLine ? fmt(r.vat_amount) : ''}</td>
                    <td className="text-right" style={{ fontWeight: 600 }}>{firstLine ? fmt(r.total) : ''}</td>
                    <td>{firstLine ? r.currency : ''}</td>
                    <td>
                      {firstLine && (
                        <span style={{ ...badge, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                          {r.payment_status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid #1e293b', background: '#f8fafc' }}>
                <td colSpan={9}>Totals ({summary.invoice_count || 0} invoices)</td>
                <td className="text-right">{fmt(summary.vat || 0)}</td>
                <td className="text-right">{fmt(summary.total || 0)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div style={{ marginTop: 14, fontSize: 12.5, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px' }}>
        The Excel export follows the FIRS B2B invoice upload template (28 columns, mandatory fields highlighted in red,
        dates as dd/mm/yyyy). Fields not yet tracked in OneBooks — Customer TIN, Zip Code, City, State and Country —
        are exported blank and should be completed before uploading to the portal. HSN and ISIC codes are imputed
        automatically by the portal during upload.
      </div>
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
  { value: 'invoice',            label: 'Invoice',             icon: FileText   },
];

const EXPORTABLE = ['profit-loss', 'balance-sheet', 'cash-flow', 'invoice'];

// ── Date preset helpers ─────────────────────────────────────────
const toISO = (d) => d.toISOString().split('T')[0];
const startOfMonth = (y, m) => new Date(Date.UTC(y, m, 1));
const endOfMonth   = (y, m) => new Date(Date.UTC(y, m + 1, 0));
const startOfQuarter = (y, q) => new Date(Date.UTC(y, q * 3, 1));
const endOfQuarter   = (y, q) => new Date(Date.UTC(y, q * 3 + 3, 0));

const computePreset = (preset) => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const q = Math.floor(m / 3);
  switch (preset) {
    case 'this-month':    return { start: toISO(startOfMonth(y, m)),       end: toISO(endOfMonth(y, m)) };
    case 'last-month':    return { start: toISO(startOfMonth(y, m - 1)),   end: toISO(endOfMonth(y, m - 1)) };
    case 'this-quarter':  return { start: toISO(startOfQuarter(y, q)),     end: toISO(endOfQuarter(y, q)) };
    case 'last-quarter': {
      const lq = q - 1 < 0 ? 3 : q - 1;
      const ly = q - 1 < 0 ? y - 1 : y;
      return { start: toISO(startOfQuarter(ly, lq)), end: toISO(endOfQuarter(ly, lq)) };
    }
    case 'this-year':     return { start: toISO(new Date(Date.UTC(y, 0, 1))),     end: toISO(new Date(Date.UTC(y, 11, 31))) };
    case 'last-year':     return { start: toISO(new Date(Date.UTC(y - 1, 0, 1))), end: toISO(new Date(Date.UTC(y - 1, 11, 31))) };
    default: return { start: '', end: '' };
  }
};

// Compute the previous-period range. Uses preset when known so monthly /
// quarterly / yearly comparisons line up. For custom ranges, picks the
// equal-length window ending the day before startDate.
const computePreviousRange = (preset, start, end) => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const q = Math.floor(m / 3);
  switch (preset) {
    case 'this-month':   return { start: toISO(startOfMonth(y, m - 1)),   end: toISO(endOfMonth(y, m - 1)) };
    case 'last-month':   return { start: toISO(startOfMonth(y, m - 2)),   end: toISO(endOfMonth(y, m - 2)) };
    case 'this-quarter': {
      const pq = q - 1 < 0 ? 3 : q - 1;
      const py = q - 1 < 0 ? y - 1 : y;
      return { start: toISO(startOfQuarter(py, pq)), end: toISO(endOfQuarter(py, pq)) };
    }
    case 'last-quarter': {
      const pq = q - 2 < 0 ? q - 2 + 4 : q - 2;
      const py = q - 2 < 0 ? y - 1 : y;
      return { start: toISO(startOfQuarter(py, pq)), end: toISO(endOfQuarter(py, pq)) };
    }
    case 'this-year':    return { start: toISO(new Date(Date.UTC(y - 1, 0, 1))), end: toISO(new Date(Date.UTC(y - 1, 11, 31))) };
    case 'last-year':    return { start: toISO(new Date(Date.UTC(y - 2, 0, 1))), end: toISO(new Date(Date.UTC(y - 2, 11, 31))) };
    default: {
      if (!start || !end) return { start: '', end: '' };
      const s = new Date(start);
      const e = new Date(end);
      const days = Math.round((e - s) / 86400000) + 1;
      const prevEnd = new Date(s);
      prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setUTCDate(prevStart.getUTCDate() - (days - 1));
      return { start: toISO(prevStart), end: toISO(prevEnd) };
    }
  }
};

const PRESETS = [
  { key: 'this-month',   label: 'This Month' },
  { key: 'last-month',   label: 'Last Month' },
  { key: 'this-quarter', label: 'This Quarter' },
  { key: 'last-quarter', label: 'Last Quarter' },
  { key: 'this-year',    label: 'This Year' },
  { key: 'last-year',    label: 'Last Year' },
];

const COMPARE_SUPPORTED = ['profit-loss', 'balance-sheet', 'cash-flow'];

const Reports = () => {
  const { fmt } = useCurrency();
  const [reportType, setReportType] = useState('profit-loss');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('');
  const [compare, setCompare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState(null);
  const [prevData, setPrevData] = useState(null);
  const [prevDates, setPrevDates] = useState({ start: '', end: '' });
  const [error, setError] = useState('');
  const [ledger, setLedger] = useState(null); // { loading, error, account, lines, totals, period }

  const openLedger = useCallback(async (code) => {
    if (!code) return;
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate)   params.end_date = endDate;
    setLedger({ loading: true, error: '', account: null, lines: null, totals: null, period: null });
    try {
      const res = await reportAPI.getAccountLedger(code, params);
      setLedger({ loading: false, error: '', ...res.data });
    } catch (err) {
      setLedger({
        loading: false,
        error: err.response?.data?.message || 'Unable to load ledger',
        account: null, lines: [], totals: null, period: null,
      });
    }
  }, [startDate, endDate]);

  const closeLedger = useCallback(() => setLedger(null), []);

  // Close the ledger on Esc.
  useEffect(() => {
    if (!ledger) return undefined;
    const h = (e) => { if (e.key === 'Escape') closeLedger(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [ledger, closeLedger]);

  const applyPreset = (key) => {
    const { start, end } = computePreset(key);
    setStartDate(start);
    setEndDate(end);
    setActivePreset(key);
    setData(null);
    setPrevData(null);
    setError('');
  };

  const fetchReport = async (params) => {
    if      (reportType === 'profit-loss')       return reportAPI.getProfitLoss(params);
    else if (reportType === 'balance-sheet')     return reportAPI.getBalanceSheet();
    else if (reportType === 'cash-flow')         return reportAPI.getCashFlow(params);
    else if (reportType === 'sales-by-customer') return reportAPI.getSalesByCustomer(params);
    else if (reportType === 'sales-by-item')     return reportAPI.getSalesByItem(params);
    else if (reportType === 'trial-balance')     return reportAPI.getTrialBalance(params);
    else if (reportType === 'invoice')           return reportAPI.getInvoiceReport(params);
    throw new Error('Unknown report type');
  };

  const generate = useCallback(async () => {
    setLoading(true); setError(''); setData(null); setPrevData(null);
    try {
      const params = {};
      if (startDate) params.start_date = startDate;
      if (endDate)   params.end_date = endDate;
      const res = await fetchReport(params);
      setData(res.data);

      if (compare && COMPARE_SUPPORTED.includes(reportType)) {
        const prevRange = computePreviousRange(activePreset, startDate, endDate);
        if (prevRange.start && prevRange.end) {
          const prevParams = { start_date: prevRange.start, end_date: prevRange.end };
          try {
            const prevRes = await fetchReport(prevParams);
            setPrevData(prevRes.data);
            setPrevDates(prevRange);
          } catch { /* leave prevData null on failure */ }
        }
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, startDate, endDate, compare, activePreset]);

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
      else if (reportType === 'invoice')       res = await reportAPI.exportInvoiceReport(format, params);
      downloadFile(res.data, filename);
    } catch (err) {
      alert('Failed to export report');
    } finally { setExporting(false); }
  }, [reportType, startDate, endDate]);

  return (
    <LedgerContext.Provider value={{ open: openLedger }}>
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
            {/* Preset chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    border: '1.5px solid',
                    borderColor: activePreset === p.key ? '#4f46e5' : '#e2e8f0',
                    background: activePreset === p.key ? '#4f46e5' : '#fff',
                    color: activePreset === p.key ? '#fff' : '#475569',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
              {activePreset && (
                <button
                  type="button"
                  onClick={() => { setActivePreset(''); setStartDate(''); setEndDate(''); }}
                  style={{
                    padding: '7px 12px', borderRadius: 999, border: '1.5px dashed #cbd5e1',
                    background: '#fff', color: '#64748b', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                <label>Start Date</label>
                <input type="date" className="form-control" value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setActivePreset(''); }} />
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 160 }}>
                <label>End Date</label>
                <input type="date" className="form-control" value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setActivePreset(''); }} />
              </div>
              {COMPARE_SUPPORTED.includes(reportType) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 42, color: '#475569', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
                  Compare to previous period
                </label>
              )}
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
              <ProfitLossReport data={data} prev={prevData} dates={{ start: startDate, end: endDate }} prevDates={prevDates} fmt={fmt} />
            )}
            {data && reportType === 'balance-sheet' && (
              <BalanceSheetReport data={data} prev={prevData} fmt={fmt} />
            )}
            {data && reportType === 'cash-flow' && (
              <CashFlowReport data={data} prev={prevData} dates={{ start: startDate, end: endDate }} prevDates={prevDates} fmt={fmt} />
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
            {data && reportType === 'invoice' && (
              <InvoiceReport data={data} dates={{ start: startDate, end: endDate }} fmt={fmt} />
            )}
          </div>
        </div>

      </div>
      <LedgerModal state={ledger} onClose={closeLedger} fmt={fmt} />
    </div>
    </LedgerContext.Provider>
  );
};

export default Reports;
