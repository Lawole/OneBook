import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, Upload, X, Edit2, Trash2, CheckCircle, Link, Ban,
  RefreshCw, Building2, Tag, Scissors, Paperclip, ExternalLink,
  AlertTriangle, Info, Sparkles, Wallet,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import Header from '../components/Header';
import CurrencyPicker from '../components/CurrencyPicker';
import { bankingAPI, accountAPI, filesAPI } from '../services/api';
import useCurrency from '../hooks/useCurrency';
import { WORLD_CURRENCIES } from '../utils/currencies';

// ── helpers ────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const currencyFlag = (code) => WORLD_CURRENCIES.find((c) => c.code === code)?.flag || '';

const ACCOUNT_TYPES = [
  { value: 'checking',    label: 'Checking Account' },
  { value: 'savings',     label: 'Savings Account'  },
  { value: 'credit_card', label: 'Credit Card'      },
  { value: 'cash',        label: 'Cash'             },
  { value: 'other',       label: 'Other'            },
];

const STATUS_CONFIG = {
  unmatched:   { label: 'Unmatched',   bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  matched:     { label: 'Matched',     bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  excluded:    { label: 'Excluded',    bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  categorized: { label: 'Categorized', bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
};

// ── error message helper ───────────────────────────────────────
const buildErrorText = (err, fallback = 'Something went wrong.') => {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  const parts = [];
  if (data.message) parts.push(data.message);
  if (data.reason  && data.reason  !== data.message) parts.push(`Reason: ${data.reason}`);
  if (data.remedy) parts.push(`How to fix: ${data.remedy}`);
  return parts.join('  ·  ') || fallback;
};

// ── shared UI ──────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unmatched;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
};

const Overlay = ({ children, onClose }) => (
  <div
    style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    {children}
  </div>
);

const ModalBox = ({ children, width = 520 }) => (
  <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 80px rgba(15, 23, 42, 0.25)' }}>
    {children}
  </div>
);

const ModalHeader = ({ title, subtitle, onClose }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
    <div>
      <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: '#0f172a', letterSpacing: -0.1 }}>{title}</h3>
      {subtitle && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{subtitle}</div>}
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 8, marginTop: -6 }}>
      <X size={20} />
    </button>
  </div>
);

const ErrorPanel = ({ text }) => (
  <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px 14px', borderRadius: 10, marginBottom: 12, fontSize: 13, border: '1px solid #fecaca', display: 'flex', gap: 10 }}>
    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{text}</div>
  </div>
);

// ── Metric Card (KPI at the top) ───────────────────────────────
const MetricCard = ({ icon: Icon, label, value, delta, tone = 'neutral' }) => {
  const toneColors = {
    positive: { icon: '#0d9488', bg: '#ecfeff', chip: '#0d9488' },
    negative: { icon: '#dc2626', bg: '#fef2f2', chip: '#dc2626' },
    neutral:  { icon: '#334155', bg: '#f1f5f9', chip: '#334155' },
    accent:   { icon: '#4f46e5', bg: '#eef2ff', chip: '#4f46e5' },
  }[tone];

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e6e8ee',
      borderRadius: 14,
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: -0.3 }}>{value}</div>
        {delta && (
          <div style={{ fontSize: 12, fontWeight: 600, color: toneColors.chip, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            {delta}
          </div>
        )}
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: toneColors.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} style={{ color: toneColors.icon }} />
      </div>
    </div>
  );
};

// ── Balance Bar Chart ──────────────────────────────────────────
const BalancesChart = ({ accounts, fmt }) => {
  const data = accounts.map((a) => ({
    name: a.name.length > 16 ? a.name.substring(0, 16) + '…' : a.name,
    balance: parseFloat(a.current_balance) || 0,
    fullName: a.name,
    currency: a.currency_code,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    const entry = payload[0].payload;
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', boxShadow: '0 10px 24px rgba(15,23,42,0.12)' }}>
        <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>{entry.fullName}</div>
        <div style={{ color: val >= 0 ? '#0d9488' : '#dc2626', fontWeight: 700 }}>{fmt(val)}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{entry.currency}</div>
      </div>
    );
  };

  const tickFormatter = (v) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
    return v;
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 16, padding: '22px 26px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', letterSpacing: -0.1 }}>Account balances</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Real-time snapshot of every bank and cash account</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '5px 10px', borderRadius: 20, fontSize: 12, color: '#64748b' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
          Live
        </div>
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={tickFormatter} width={60} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,70,229,0.06)' }} />
          <Bar dataKey="balance" radius={[8, 8, 0, 0]} barSize={38}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.balance >= 0 ? '#4f46e5' : '#dc2626'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ── Account Form Modal ─────────────────────────────────────────
const AccountModal = ({ initial, onSave, onClose, saving, error, defaultCurrency = 'USD' }) => {
  const blank = { name: '', bank_name: '', account_number: '', account_type: 'checking', current_balance: '', currency_code: defaultCurrency };
  const [form, setForm] = useState(initial || blank);
  const [balanceDisplay, setBalanceDisplay] = useState(() => {
    const v = (initial || blank).current_balance;
    return v ? Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  });
  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleBalanceChange = (e) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setBalanceDisplay(raw);
    setForm({ ...form, current_balance: raw });
  };
  const handleBalanceBlur  = () => {
    const num = parseFloat(form.current_balance) || 0;
    setBalanceDisplay(num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  };
  const handleBalanceFocus = () => setBalanceDisplay(form.current_balance || '');

  return (
    <Overlay onClose={onClose}>
      <ModalBox width={540}>
        <ModalHeader
          title={initial ? 'Edit bank account' : 'Add bank account'}
          subtitle={initial ? 'Update the details of this account' : 'Connect a checking, savings, credit card or cash account'}
          onClose={onClose}
        />
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-group">
            <label>Account name *</label>
            <input className="form-control" required value={form.name} onChange={f('name')} placeholder="Main Checking" />
          </div>
          <div className="form-group">
            <label>Bank name</label>
            <input className="form-control" value={form.bank_name} onChange={f('bank_name')} placeholder="Chase, Bank of America…" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Account number</label>
              <input className="form-control" value={form.account_number} onChange={f('account_number')} placeholder="****1234" />
            </div>
            <div className="form-group">
              <label>Account type</label>
              <select className="form-control" value={form.account_type} onChange={f('account_type')}>
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Opening balance</label>
              <input className="form-control" value={balanceDisplay} onChange={handleBalanceChange} onBlur={handleBalanceBlur} onFocus={handleBalanceFocus} placeholder="0.00" />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>e.g. 1,250,000.00</div>
            </div>
            <div className="form-group">
              <label>Currency</label>
              <CurrencyPicker
                value={form.currency_code || defaultCurrency}
                onChange={(code) => setForm({ ...form, currency_code: code })}
                size="md"
              />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                Foreign-currency accounts are converted to your base currency in reports.
              </div>
            </div>
          </div>
          {error && <ErrorPanel text={error} />}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : (initial ? 'Save changes' : 'Add account')}</button>
          </div>
        </form>
      </ModalBox>
    </Overlay>
  );
};

// ── Import Modal ───────────────────────────────────────────────
const ImportModal = ({ account, onImported, onClose }) => {
  const fileRef = useRef();
  const [file, setFile]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]  = useState(null);
  const [error, setError]    = useState('');

  const handleImport = async () => {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await bankingAPI.importStatement(account.id, file);
      setResult(res.data);
      onImported();
    } catch (err) {
      setError(buildErrorText(err, 'Import failed.'));
      // Even on failure the server may have details — surface first row error
      const rowErrs = err.response?.data?.details?.errors || err.response?.data?.row_errors;
      if (Array.isArray(rowErrs) && rowErrs.length) {
        setResult({ row_errors: rowErrs });
      }
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox width={600}>
        <ModalHeader title={`Import statement — ${account.name}`} subtitle="Upload a CSV or Excel export from your bank" onClose={onClose} />

        <div
          style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 12, padding: 32, textAlign: 'center', marginBottom: 20, cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} style={{ color: '#94a3b8', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{file ? file.name : 'Click to select your bank statement'}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Supports .csv, .xlsx and .xls files</div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.xlsx,.xls,.xlsm" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <div style={{ background: '#eff6ff', borderRadius: 10, padding: '14px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af', display: 'flex', gap: 10 }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Recognised columns:</strong> Date, Description (or Narration / Memo / Details), Amount (or Debit &amp; Credit / Withdrawal &amp; Deposit), and an optional Reference / Cheque no.<br />
            <strong>Auto-categorise:</strong> if a description contains an invoice number or a Chart-of-Account identifier, the transaction is matched automatically.
          </div>
        </div>

        {error && <ErrorPanel text={error} />}

        {result && result.imported > 0 && (
          <div style={{ background: '#ecfdf5', color: '#065f46', padding: '12px 16px', borderRadius: 10, marginBottom: 12, fontSize: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Sparkles size={16} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong>{result.message}</strong>
              <div style={{ fontSize: 12, marginTop: 4, color: '#047857' }}>
                {result.rows_examined} row{result.rows_examined === 1 ? '' : 's'} examined.
              </div>
            </div>
          </div>
        )}

        {result && result.row_errors && result.row_errors.length > 0 && (
          <div style={{ background: '#fef3c7', color: '#78350f', padding: '12px 16px', borderRadius: 10, marginBottom: 12, fontSize: 13, border: '1px solid #fcd34d' }}>
            <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
              <AlertTriangle size={15} /> {result.row_errors.length} row{result.row_errors.length === 1 ? '' : 's'} could not be imported
            </div>
            <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 12 }}>
              {result.row_errors.map((e, i) => (
                <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid #fde68a' }}>
                  {e.row && <strong>Row {e.row}: </strong>}{e.reason}
                  {e.remedy && <div style={{ color: '#92400e', marginTop: 2 }}>↳ {e.remedy}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={!file || loading} onClick={handleImport}>
            <Upload size={16} />{loading ? 'Importing…' : 'Import statement'}
          </button>
        </div>
      </ModalBox>
    </Overlay>
  );
};

// ── Categorise / Match Panel ───────────────────────────────────
const CategorizePanel = ({ transaction, coaAccounts, onClose, onSaved, fmt }) => {
  const [tab, setTab] = useState('categorize');

  // Match tab
  const [suggestions,  setSuggestions]  = useState([]);
  const [loadingSugg,  setLoadingSugg]  = useState(false);
  const [matchSaving,  setMatchSaving]  = useState(null);

  // Categorize tab
  const [coaAccountId,  setCoaAccountId]  = useState(transaction.coa_account_id?.toString() || '');
  const [notes,         setNotes]          = useState(transaction.notes || '');
  const [isItemized,    setIsItemized]     = useState(false);
  const [splits,        setSplits]         = useState([
    { coa_account_id: '', amount: '', description: '' },
    { coa_account_id: '', amount: '', description: '' },
  ]);
  const [loadingSplits, setLoadingSplits] = useState(false);
  const [catSaving,     setCatSaving]     = useState(false);
  const [catError,      setCatError]      = useState('');

  // Receipt upload
  const receiptRef                            = useRef();
  const [receipt,          setReceipt]        = useState(
    transaction.receipt_file_id
      ? { id: transaction.receipt_file_id, name: transaction.receipt_file_name, url: transaction.receipt_file_url, reference: transaction.receipt_reference, mime_type: transaction.receipt_mime_type }
      : null
  );
  const [receiptRef2,      setReceiptRef2]    = useState(transaction.receipt_reference || transaction.reference || '');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptError,     setReceiptError]   = useState('');

  useEffect(() => {
    setLoadingSplits(true);
    bankingAPI.getSplits(transaction.id)
      .then((res) => {
        if (res.data.splits.length > 0) {
          setIsItemized(true);
          setSplits(res.data.splits.map((s) => ({
            coa_account_id: s.coa_account_id?.toString() || '',
            amount: s.amount?.toString() || '',
            description: s.description || '',
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSplits(false));
  }, [transaction.id]);

  useEffect(() => {
    if (tab !== 'match') return;
    setLoadingSugg(true);
    bankingAPI.getMatchSuggestions(transaction.id)
      .then((res) => setSuggestions(res.data.suggestions))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSugg(false));
  }, [tab, transaction.id]);

  const handleMatch = async (suggestion) => {
    setMatchSaving(suggestion.id);
    try {
      await bankingAPI.updateTransaction(transaction.id, {
        status: 'matched',
        matched_type: suggestion.match_type,
        matched_id: suggestion.id,
      });
      onSaved();
    } catch (err) { console.error(err); }
    finally { setMatchSaving(null); }
  };

  const handleExclude = async () => {
    setMatchSaving('exclude');
    try {
      await bankingAPI.updateTransaction(transaction.id, { status: 'excluded' });
      onSaved();
    } catch (err) { console.error(err); }
    finally { setMatchSaving(null); }
  };

  const txnAmount    = parseFloat(transaction.amount) || 0;
  const totalSplits  = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  const remaining    = txnAmount - totalSplits;

  const handleSaveCategorize = async () => {
    setCatError('');

    if (isItemized) {
      const validSplits = splits.filter((s) => s.coa_account_id && parseFloat(s.amount) > 0);
      if (validSplits.length === 0) { setCatError('Add at least one split line with an account and amount.'); return; }
      const total = validSplits.reduce((s, l) => s + parseFloat(l.amount), 0);
      if (Math.abs(total - txnAmount) > 0.01) {
        setCatError(`Split total (${fmt(total)}) must equal transaction amount (${fmt(txnAmount)}).`);
        return;
      }
      setCatSaving(true);
      try {
        await bankingAPI.saveSplits(transaction.id, validSplits);
        await bankingAPI.updateTransaction(transaction.id, { status: 'categorized', notes });
        onSaved();
      } catch (err) { setCatError(buildErrorText(err, 'Failed to save splits.')); }
      finally { setCatSaving(false); }
    } else {
      if (!coaAccountId) { setCatError('Please select an account to categorise this transaction.'); return; }
      setCatSaving(true);
      try {
        await bankingAPI.updateTransaction(transaction.id, {
          status: 'categorized',
          coa_account_id: parseInt(coaAccountId),
          notes,
        });
        onSaved();
      } catch (err) { setCatError(buildErrorText(err, 'Failed to categorise transaction.')); }
      finally { setCatSaving(false); }
    }
  };

  const updateSplit = (i, field, value) => {
    const next = [...splits];
    next[i] = { ...next[i], [field]: value };
    setSplits(next);
  };
  const addSplit    = () => setSplits([...splits, { coa_account_id: '', amount: '', description: '' }]);
  const removeSplit = (i) => splits.length > 1 && setSplits(splits.filter((_, idx) => idx !== i));

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    setUploadingReceipt(true); setReceiptError('');
    try {
      const uploaded = await filesAPI.uploadFile(file, {
        reference:    receiptRef2 || transaction.reference || `TXN-${transaction.id}`,
        source_type:  'bank_transaction',
        source_id:    transaction.id,
        auto_receipts: 'true',
        notes:         `Receipt for: ${transaction.description}`,
      });
      setReceipt(uploaded.data);
      onSaved();
    } catch (err) {
      setReceiptError(buildErrorText(err, 'Upload failed'));
    } finally { setUploadingReceipt(false); }
  };

  const handleRemoveReceipt = async () => {
    if (!window.confirm('Detach this receipt? The file will remain in Files > Receipts.')) return;
    try {
      await bankingAPI.updateTransaction(transaction.id, { receipt_file_id: null });
      setReceipt(null);
    } catch (err) { console.error(err); }
  };

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        color: tab === id ? '#4f46e5' : '#64748b',
        borderBottom: `2px solid ${tab === id ? '#4f46e5' : 'transparent'}`,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 16, overflow: 'hidden', position: 'sticky', top: 20 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e6e8ee', background: '#f8fafc' }}>
        {tabBtn('match',      'Match')}
        {tabBtn('categorize', 'Categorize')}
        <button onClick={onClose} style={{ padding: '12px', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: '16px 20px', background: transaction.type === 'credit' ? '#f0fdf4' : '#fff7ed', borderBottom: '1px solid #e6e8ee' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>{transaction.description}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>{fmtDate(transaction.date)}</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: transaction.type === 'credit' ? '#0d9488' : '#dc2626' }}>
            {transaction.type === 'credit' ? '+' : '−'}{fmt(transaction.amount)}
          </div>
        </div>
        {transaction.reference && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Ref: {transaction.reference}</div>}
        {transaction.auto_matched && (
          <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eef2ff', padding: '2px 8px', borderRadius: 12 }}>
            <Sparkles size={11} /> Auto-matched
          </div>
        )}
      </div>

      <div style={{ padding: 20, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>

        {tab === 'match' && (
          <div>
            <div style={{ fontWeight: 600, color: '#475569', marginBottom: 12, fontSize: 13 }}>
              {loadingSugg
                ? 'Finding matches…'
                : suggestions.length > 0
                  ? `${suggestions.length} possible match${suggestions.length > 1 ? 'es' : ''} found`
                  : 'No close matches found'}
            </div>

            {!loadingSugg && suggestions.map((s) => (
              <div key={s.id} style={{ border: '1px solid #e6e8ee', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '2px 7px', background: s.match_type === 'invoice' ? '#eef2ff' : '#fef3c7', color: s.match_type === 'invoice' ? '#4f46e5' : '#92400e', borderRadius: 4 }}>
                      {s.match_type}
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a', marginLeft: 8, fontSize: 13 }}>{s.reference}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{fmt(s.amount)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{s.party || '—'} · {fmtDate(s.date)}</div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '6px 12px', fontSize: 13 }}
                  onClick={() => handleMatch(s)}
                  disabled={!!matchSaving}
                >
                  {matchSaving === s.id ? 'Matching…' : <><Link size={14} /> Match</>}
                </button>
              </div>
            ))}

            {!loadingSugg && suggestions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
                No {transaction.type === 'credit' ? 'invoices' : 'expenses'} found with a similar amount or description.
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <button
                className="btn btn-outline"
                style={{ width: '100%', color: '#64748b', fontSize: 13 }}
                onClick={handleExclude}
                disabled={!!matchSaving}
              >
                <Ban size={14} /> Exclude transaction
              </button>
            </div>
          </div>
        )}

        {tab === 'categorize' && (
          <div>
            {loadingSplits ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Loading…</div>
            ) : (
              <>
                {!isItemized && (
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
                      Account *
                    </label>
                    <select
                      className="form-control"
                      value={coaAccountId}
                      onChange={(e) => setCoaAccountId(e.target.value)}
                    >
                      <option value="">Select an account</option>
                      {coaAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!isItemized && splits.every((s) => !s.coa_account_id)) {
                      setSplits([
                        { coa_account_id: '', amount: '', description: '' },
                        { coa_account_id: '', amount: '', description: '' },
                      ]);
                    }
                    setIsItemized((v) => !v);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: isItemized ? '#eef2ff' : '#f8fafc',
                    border: `1px solid ${isItemized ? '#818cf8' : '#e2e8f0'}`,
                    borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    color: isItemized ? '#4f46e5' : '#475569', marginBottom: 16,
                  }}
                >
                  <Scissors size={14} />
                  {isItemized ? 'Cancel itemise' : 'Itemise (split transaction)'}
                </button>

                {isItemized && (
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 10 }}>Split lines</div>

                    {splits.map((split, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <select
                            className="form-control"
                            style={{ fontSize: 12, padding: '5px 8px' }}
                            value={split.coa_account_id}
                            onChange={(e) => updateSplit(i, 'coa_account_id', e.target.value)}
                          >
                            <option value="">Select account</option>
                            {coaAccounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code} – {a.name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            className="form-control"
                            style={{ fontSize: 12, padding: '5px 8px' }}
                            value={split.amount}
                            onChange={(e) => updateSplit(i, 'amount', e.target.value)}
                            placeholder="Amount"
                            min="0"
                            step="0.01"
                          />
                          <button
                            onClick={() => removeSplit(i)}
                            style={{ background: 'none', border: 'none', cursor: splits.length > 1 ? 'pointer' : 'not-allowed', color: splits.length > 1 ? '#dc2626' : '#cbd5e1', padding: 4 }}
                            disabled={splits.length <= 1}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <input
                          className="form-control"
                          style={{ fontSize: 12, padding: '5px 8px' }}
                          value={split.description}
                          onChange={(e) => updateSplit(i, 'description', e.target.value)}
                          placeholder="Description / note for this line"
                        />
                      </div>
                    ))}

                    <button
                      onClick={addSplit}
                      style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: '1px dashed #a5b4fc', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', width: '100%', marginTop: 4 }}
                    >
                      + Add line
                    </button>

                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                      {[
                        { label: 'Transaction total', val: fmt(txnAmount), color: '#0f172a' },
                        { label: 'Allocated',         val: fmt(totalSplits), color: totalSplits > txnAmount + 0.01 ? '#dc2626' : '#0d9488' },
                        { label: 'Remaining',         val: fmt(Math.abs(remaining)), color: Math.abs(remaining) < 0.01 ? '#0d9488' : '#f59e0b' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                          <span>{label}:</span>
                          <span style={{ fontWeight: 700, color }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>Notes</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: 60, resize: 'vertical', fontSize: 13 }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes…"
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Paperclip size={14} /> Receipt / proof
                  </div>

                  {receipt ? (
                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Paperclip size={15} style={{ color: '#0d9488' }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#065f46' }}>{receipt.original_name || receipt.name}</div>
                            {receipt.reference && <div style={{ fontSize: 12, color: '#94a3b8' }}>Ref: {receipt.reference}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a href={receipt.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488', textDecoration: 'none' }} title="View">
                            <ExternalLink size={14} />
                          </a>
                          <button onClick={handleRemoveReceipt} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }} title="Detach">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <a href="/files" style={{ fontSize: 12, color: '#4f46e5', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ExternalLink size={11} /> View in Files → Receipts
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8 }}>
                        <input
                          className="form-control"
                          style={{ fontSize: 13 }}
                          value={receiptRef2}
                          onChange={(e) => setReceiptRef2(e.target.value)}
                          placeholder="Reference # (optional)"
                        />
                        <button
                          type="button"
                          onClick={() => receiptRef.current?.click()}
                          disabled={uploadingReceipt}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}
                        >
                          <Paperclip size={14} />
                          {uploadingReceipt ? 'Uploading…' : 'Attach'}
                        </button>
                        <input
                          ref={receiptRef}
                          type="file"
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                          style={{ display: 'none' }}
                          onChange={(e) => handleReceiptUpload(e.target.files[0])}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        Image, PDF, or document — saved to Files → Receipts
                      </div>
                    </div>
                  )}

                  {receiptError && <ErrorPanel text={receiptError} />}
                </div>

                {catError && <ErrorPanel text={catError} />}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleSaveCategorize}
                  disabled={catSaving}
                >
                  {catSaving ? 'Saving…' : 'Save categorisation'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Format an amount in a specific currency (independent of the OneBook
// base currency). Used everywhere bank transactions / balances are shown
// so a NGN account renders ₦ even when the base currency is USD.
const formatIn = (amount, currency) => {
  const code = currency || 'USD';
  const abs = Math.abs(parseFloat(amount) || 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(abs);
  } catch {
    return `${code} ${abs.toFixed(2)}`;
  }
};

// ── Main Banking Page ──────────────────────────────────────────
const Banking = () => {
  const { fmt: fmtRaw, currency: baseCurrency } = useCurrency();
  const fmt = (n) => fmtRaw(Math.abs(n));

  const [accounts,       setAccounts]       = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions,   setTransactions]   = useState([]);
  const [stats,          setStats]          = useState(null);
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [loadingAccts,   setLoadingAccts]   = useState(true);
  const [loadingTxns,    setLoadingTxns]    = useState(false);
  const [modal,          setModal]          = useState(null);
  const [editAccountData, setEditAccountData] = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [acctError,      setAcctError]      = useState('');
  const [autoRunning,    setAutoRunning]    = useState(false);
  const [autoResult,     setAutoResult]     = useState(null);

  const [activeTxn,   setActiveTxn]   = useState(null);
  const [coaAccounts, setCoaAccounts] = useState([]);

  useEffect(() => {
    accountAPI.getAll()
      .then((res) => setCoaAccounts(res.data.accounts || []))
      .catch(() => setCoaAccounts([]));
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await bankingAPI.getAccounts();
      setAccounts(res.data.accounts);
    } catch (err) { console.error(err); }
    finally { setLoadingAccts(false); }
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!selectedAccount) return;
    setLoadingTxns(true);
    try {
      const res = await bankingAPI.getTransactions({ account_id: selectedAccount.id, status: statusFilter, per_page: 100 });
      setTransactions(res.data.transactions);
      setStats(res.data.stats);
    } catch (err) { console.error(err); }
    finally { setLoadingTxns(false); }
  }, [selectedAccount, statusFilter]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleCreateAccount = async (form) => {
    setAcctError(''); setSaving(true);
    try {
      const res = await bankingAPI.createAccount(form);
      await fetchAccounts();
      setSelectedAccount(res.data);
      setModal(null);
    } catch (err) { setAcctError(buildErrorText(err, 'Failed to create account')); }
    finally { setSaving(false); }
  };

  const handleEditAccount = async (form) => {
    setAcctError(''); setSaving(true);
    try {
      await bankingAPI.updateAccount(editAccountData.id, form);
      await fetchAccounts();
      setModal(null);
    } catch (err) { setAcctError(buildErrorText(err, 'Failed to update')); }
    finally { setSaving(false); }
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Delete this account and all its transactions?')) return;
    try {
      await bankingAPI.deleteAccount(id);
      if (selectedAccount?.id === id) { setSelectedAccount(null); setActiveTxn(null); }
      fetchAccounts();
    } catch (err) { console.error(err); }
  };

  const handleDeleteTxn = async (id) => {
    if (!window.confirm('Remove this transaction?')) return;
    try {
      await bankingAPI.deleteTransaction(id);
      if (activeTxn?.id === id) setActiveTxn(null);
      fetchTransactions();
    } catch (err) { console.error(err); }
  };

  const handleUnmatch = async (txn) => {
    await bankingAPI.updateTransaction(txn.id, { status: 'unmatched', matched_type: null, matched_id: null });
    fetchTransactions();
  };

  const handleAutoCategorise = async () => {
    if (!selectedAccount) return;
    setAutoRunning(true); setAutoResult(null);
    try {
      const res = await bankingAPI.autoCategorise(selectedAccount.id);
      setAutoResult(res.data);
      fetchTransactions();
      setTimeout(() => setAutoResult(null), 5000);
    } catch (err) {
      setAutoResult({ error: buildErrorText(err, 'Auto-categorisation failed') });
    } finally { setAutoRunning(false); }
  };

  const reconciliationPercent = stats && parseInt(stats.total) > 0
    ? Math.round(((parseInt(stats.matched || 0) + parseInt(stats.excluded || 0) + parseInt(stats.categorized || 0)) / parseInt(stats.total)) * 100)
    : 0;

  const totals = useMemo(() => {
    const inBase = accounts.filter((a) => a.currency_code === baseCurrency);
    const totalBalance = inBase.reduce((s, a) => s + (parseFloat(a.current_balance) || 0), 0);
    return {
      totalBalance,
      accountCount: accounts.length,
      inBaseCount: inBase.length,
    };
  }, [accounts, baseCurrency]);

  const panelOpen = !!activeTxn;

  return (
    <div className="page">
      <Header title="Banking" subtitle="Manage accounts, import statements and reconcile transactions" />

      <div className="page-content">
        {/* KPI ribbon */}
        {!loadingAccts && accounts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 20 }}>
            <MetricCard
              icon={Wallet}
              label={`Total balance · ${baseCurrency}`}
              value={fmt(totals.totalBalance)}
              tone="accent"
              delta={totals.inBaseCount < totals.accountCount
                ? <span>Excludes {totals.accountCount - totals.inBaseCount} foreign-currency account{totals.accountCount - totals.inBaseCount > 1 ? 's' : ''}</span>
                : null}
            />
            <MetricCard
              icon={ArrowUpRight}
              label={`Money in${selectedAccount ? ` · ${selectedAccount.currency_code}` : ''}`}
              value={stats && selectedAccount
                ? formatIn(stats.total_credits || 0, selectedAccount.currency_code)
                : '—'}
              tone="positive"
            />
            <MetricCard
              icon={ArrowDownRight}
              label={`Money out${selectedAccount ? ` · ${selectedAccount.currency_code}` : ''}`}
              value={stats && selectedAccount
                ? formatIn(stats.total_debits || 0, selectedAccount.currency_code)
                : '—'}
              tone="negative"
            />
            <MetricCard
              icon={CheckCircle}
              label="Reconciled"
              value={`${reconciliationPercent}%`}
              tone={reconciliationPercent === 100 ? 'positive' : 'neutral'}
              delta={stats && <span>{stats.matched || 0} matched · {stats.categorized || 0} categorised · {stats.unmatched || 0} to review</span>}
            />
          </div>
        )}

        {!loadingAccts && accounts.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <BalancesChart accounts={accounts} fmt={fmt} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: panelOpen ? '260px 1fr 400px' : '300px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left: Account List ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, letterSpacing: -0.1 }}>Accounts</span>
              <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => { setAcctError(''); setModal('addAccount'); }}>
                <Plus size={15} /> Add
              </button>
            </div>

            {loadingAccts ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</div>
            ) : accounts.length === 0 ? (
              <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 14, padding: 32, textAlign: 'center' }}>
                <Building2 size={34} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                <div style={{ color: '#64748b', fontSize: 14, marginBottom: 12, fontWeight: 600 }}>No accounts yet</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 14 }}>Add your first bank or cash account to get started.</div>
                <button className="btn btn-primary" onClick={() => setModal('addAccount')}>
                  <Plus size={15} /> Add account
                </button>
              </div>
            ) : (
              accounts.map((acct) => {
                const isSelected = selectedAccount?.id === acct.id;
                return (
                  <div
                    key={acct.id}
                    onClick={() => { setSelectedAccount(acct); setActiveTxn(null); }}
                    style={{
                      background: '#fff',
                      border: `1px solid ${isSelected ? '#4f46e5' : '#e6e8ee'}`,
                      boxShadow: isSelected ? '0 6px 22px rgba(79,70,229,0.14)' : '0 1px 2px rgba(15,23,42,0.03)',
                      borderRadius: 14,
                      padding: '14px 16px',
                      marginBottom: 10,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 15 }}>{currencyFlag(acct.currency_code) || '💳'}</span>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acct.name}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {acct.bank_name || ACCOUNT_TYPES.find((t) => t.value === acct.account_type)?.label}
                          {' · '}{acct.currency_code}
                        </div>
                        <div style={{ fontWeight: 700, color: parseFloat(acct.current_balance) < 0 ? '#dc2626' : '#0f172a', marginTop: 8, fontSize: 16, letterSpacing: -0.2 }}>
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: acct.currency_code || 'USD' }).format(parseFloat(acct.current_balance) || 0)}
                        </div>
                        {parseInt(acct.unmatched_count) > 0 && (
                          <div style={{ fontSize: 11, color: '#b45309', marginTop: 6, fontWeight: 600, background: '#fef3c7', display: 'inline-block', padding: '2px 8px', borderRadius: 12 }}>
                            {acct.unmatched_count} to review
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 6 }}>
                        <button className="btn-icon" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setEditAccountData(acct); setAcctError(''); setModal('editAccount'); }} title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon text-danger" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acct.id); }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Centre: Transactions ── */}
          <div>
            {!selectedAccount ? (
              <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 16, padding: '80px 20px', textAlign: 'center' }}>
                <Building2 size={44} style={{ color: '#cbd5e1', marginBottom: 14 }} />
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16, marginBottom: 4 }}>Choose an account</div>
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Pick an account on the left to see its transactions.</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 20, color: '#0f172a', letterSpacing: -0.2 }}>{selectedAccount.name}</div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      {selectedAccount.bank_name && <>{selectedAccount.bank_name} · </>}
                      {selectedAccount.currency_code}
                      {selectedAccount.account_number && <> · ••••{String(selectedAccount.account_number).slice(-4)}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-outline"
                      onClick={handleAutoCategorise}
                      disabled={autoRunning}
                      title="Re-run auto-categorisation on unmatched transactions"
                    >
                      <Sparkles size={16} />
                      {autoRunning ? 'Working…' : 'Auto-categorise'}
                    </button>
                    <button className="btn btn-primary" onClick={() => setModal('import')}>
                      <Upload size={16} /> Import statement
                    </button>
                  </div>
                </div>

                {autoResult && (
                  <div style={{
                    background: autoResult.error ? '#fef2f2' : '#eef2ff',
                    color:      autoResult.error ? '#991b1b' : '#4338ca',
                    padding: '10px 16px',
                    borderRadius: 10,
                    marginBottom: 16,
                    fontSize: 13,
                    border: `1px solid ${autoResult.error ? '#fecaca' : '#c7d2fe'}`,
                  }}>
                    {autoResult.error || autoResult.message}
                  </div>
                )}

                {stats && parseInt(stats.total) > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e6e8ee', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>Reconciliation progress</span>
                      <span style={{ fontWeight: 700, color: reconciliationPercent === 100 ? '#0d9488' : '#4f46e5' }}>{reconciliationPercent}%</span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: 999, height: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: reconciliationPercent === 100 ? 'linear-gradient(90deg,#22c55e,#0d9488)' : 'linear-gradient(90deg,#818cf8,#4f46e5)', width: `${reconciliationPercent}%`, transition: 'width 0.4s ease', borderRadius: 999 }} />
                    </div>
                  </div>
                )}

                {/* Filter chips */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['all', 'unmatched', 'matched', 'categorized', 'excluded'].map((s) => {
                    const count = s === 'all' ? stats?.total : stats?.[s];
                    const active = statusFilter === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        style={{
                          padding: '7px 14px', borderRadius: 999, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          borderColor: active ? '#4f46e5' : '#e2e8f0',
                          background:  active ? '#eef2ff'  : '#fff',
                          color:       active ? '#4338ca'  : '#64748b',
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                        {count !== undefined && (
                          <span style={{ background: active ? '#fff' : '#f1f5f9', color: active ? '#4338ca' : '#64748b', padding: '1px 8px', borderRadius: 999, fontSize: 11 }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button onClick={fetchTransactions} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} title="Refresh">
                    <RefreshCw size={16} />
                  </button>
                </div>

                <div className="card" style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e6e8ee' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th className="text-right">Deposit</th>
                          <th className="text-right">Withdrawal</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingTxns ? (
                          <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading transactions…</td></tr>
                        ) : transactions.length === 0 ? (
                          <tr><td colSpan="6">
                            <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                              <Upload size={38} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                                {statusFilter !== 'all' ? `No ${statusFilter} transactions` : 'No transactions yet'}
                              </div>
                              <div style={{ color: '#94a3b8', fontSize: 14 }}>
                                {statusFilter === 'all' ? 'Import a bank statement to get started' : 'Switch to "All" to see all transactions'}
                              </div>
                            </div>
                          </td></tr>
                        ) : transactions.map((txn) => (
                          <tr
                            key={txn.id}
                            onClick={() => setActiveTxn(activeTxn?.id === txn.id ? null : txn)}
                            style={{
                              cursor: 'pointer',
                              background: activeTxn?.id === txn.id ? '#eef2ff' : 'transparent',
                              transition: 'background 0.1s',
                            }}
                          >
                            <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 13 }}>{fmtDate(txn.date)}</td>
                            <td style={{ maxWidth: panelOpen ? 160 : 280 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0f172a', flex: 1 }}>{txn.description}</span>
                                {txn.receipt_file_id && (
                                  <Paperclip size={12} style={{ color: '#0d9488', flexShrink: 0 }} title="Receipt attached" />
                                )}
                                {txn.auto_matched && (
                                  <Sparkles size={12} style={{ color: '#4f46e5', flexShrink: 0 }} title="Auto-matched during import" />
                                )}
                              </div>
                              {txn.reference        && <div style={{ fontSize: 12, color: '#94a3b8' }}>Ref: {txn.reference}</div>}
                              {txn.coa_account_name && <div style={{ fontSize: 12, color: '#4f46e5' }}>{txn.coa_account_code} – {txn.coa_account_name}</div>}
                              {txn.notes            && <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{txn.notes}</div>}
                            </td>
                            <td className="text-right" style={{ fontWeight: 700, whiteSpace: 'nowrap', color: '#0d9488', fontSize: 14 }}>
                              {txn.type === 'credit'
                                ? formatIn(txn.amount, txn.currency_code || selectedAccount?.currency_code)
                                : ''}
                            </td>
                            <td className="text-right" style={{ fontWeight: 700, whiteSpace: 'nowrap', color: '#dc2626', fontSize: 14 }}>
                              {txn.type === 'debit'
                                ? formatIn(txn.amount, txn.currency_code || selectedAccount?.currency_code)
                                : ''}
                            </td>
                            <td><StatusBadge status={txn.status} /></td>
                            <td className="text-right" style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                className="btn-icon"
                                title="Categorise / Match"
                                onClick={(e) => { e.stopPropagation(); setActiveTxn(activeTxn?.id === txn.id ? null : txn); }}
                                style={{ color: activeTxn?.id === txn.id ? '#4f46e5' : '#64748b' }}
                              >
                                <Tag size={15} />
                              </button>
                              {txn.status === 'matched' && (
                                <button
                                  className="btn-icon"
                                  title="Unmatch"
                                  style={{ color: '#0d9488' }}
                                  onClick={(e) => { e.stopPropagation(); handleUnmatch(txn); }}
                                >
                                  <CheckCircle size={15} />
                                </button>
                              )}
                              <button
                                className="btn-icon text-danger"
                                title="Remove"
                                onClick={(e) => { e.stopPropagation(); handleDeleteTxn(txn.id); }}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {transactions.length > 0 && (
                    <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', fontSize: 13, color: '#64748b' }}>
                      Showing {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {panelOpen && (
            <CategorizePanel
              key={activeTxn.id}
              transaction={activeTxn}
              coaAccounts={coaAccounts}
              onClose={() => setActiveTxn(null)}
              onSaved={() => { setActiveTxn(null); fetchTransactions(); fetchAccounts(); }}
              fmt={(n) => formatIn(n, activeTxn.currency_code || selectedAccount?.currency_code)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'addAccount' && (
        <AccountModal
          onSave={handleCreateAccount}
          onClose={() => setModal(null)}
          saving={saving}
          error={acctError}
          defaultCurrency={baseCurrency}
        />
      )}
      {modal === 'editAccount' && editAccountData && (
        <AccountModal
          initial={editAccountData}
          onSave={handleEditAccount}
          onClose={() => setModal(null)}
          saving={saving}
          error={acctError}
          defaultCurrency={baseCurrency}
        />
      )}
      {modal === 'import' && selectedAccount && (
        <ImportModal
          account={selectedAccount}
          onImported={() => { fetchAccounts(); fetchTransactions(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default Banking;
