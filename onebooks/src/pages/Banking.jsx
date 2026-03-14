import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Upload, X, Edit2, Trash2, CheckCircle, Link, Ban,
  RefreshCw, Building2, Tag, Scissors,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import Header from '../components/Header';
import { bankingAPI, accountAPI } from '../services/api';
import useCurrency from '../hooks/useCurrency';

// ── helpers ────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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
    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    {children}
  </div>
);

const ModalBox = ({ children, width = 480 }) => (
  <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
    {children}
  </div>
);

const ModalHeader = ({ title, onClose }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}>
      <X size={20} />
    </button>
  </div>
);

// ── Balance Bar Chart ──────────────────────────────────────────
const BalancesChart = ({ accounts, fmt }) => {
  const data = accounts.map((a) => ({
    name: a.name.length > 16 ? a.name.substring(0, 16) + '…' : a.name,
    balance: parseFloat(a.current_balance) || 0,
    fullName: a.name,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value;
    const entry = payload[0].payload;
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{entry.fullName}</div>
        <div style={{ color: val >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{fmt(val)}</div>
      </div>
    );
  };

  const tickFormatter = (v) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
    return v;
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 2 }}>Account Balances</div>
      <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Overview of all bank and cash account balances</div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={tickFormatter} width={60} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="balance" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.balance >= 0 ? '#3b82f6' : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Balance summary row */}
      <div style={{ display: 'flex', gap: 28, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
        {accounts.map((a) => (
          <div key={a.id} style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, color: parseFloat(a.current_balance) >= 0 ? '#1e293b' : '#ef4444', fontSize: 15 }}>
              {fmt(a.current_balance)}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{a.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Account Form Modal ─────────────────────────────────────────
const AccountModal = ({ initial, onSave, onClose, saving, error }) => {
  const blank = { name: '', bank_name: '', account_number: '', account_type: 'checking', current_balance: '', currency_code: 'USD' };
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
      <ModalBox>
        <ModalHeader title={initial ? 'Edit Account' : 'Add Bank Account'} onClose={onClose} />
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-group"><label>Account Name *</label><input className="form-control" required value={form.name} onChange={f('name')} placeholder="Main Checking" /></div>
          <div className="form-group"><label>Bank Name</label><input className="form-control" value={form.bank_name} onChange={f('bank_name')} placeholder="Chase, Bank of America…" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label>Account Number</label><input className="form-control" value={form.account_number} onChange={f('account_number')} placeholder="****1234" /></div>
            <div className="form-group">
              <label>Account Type</label>
              <select className="form-control" value={form.account_type} onChange={f('account_type')}>
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Opening Balance</label>
              <input className="form-control" value={balanceDisplay} onChange={handleBalanceChange} onBlur={handleBalanceBlur} onFocus={handleBalanceFocus} placeholder="0.00" />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                {parseFloat(form.current_balance) > 0
                  ? `= ${new Intl.NumberFormat('en-US', { style: 'currency', currency: form.currency_code || 'USD' }).format(parseFloat(form.current_balance) || 0)}`
                  : 'e.g. 1,250,000.00'}
              </div>
            </div>
            <div className="form-group"><label>Currency</label><input className="form-control" value={form.currency_code} onChange={f('currency_code')} placeholder="USD" maxLength={5} /></div>
          </div>
          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Account'}</button>
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
      setError(err.response?.data?.message || 'Import failed');
    } finally { setLoading(false); }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox>
        <ModalHeader title={`Import Statement — ${account.name}`} onClose={onClose} />

        <div
          style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 10, padding: 30, textAlign: 'center', marginBottom: 20, cursor: 'pointer' }}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={32} style={{ color: '#94a3b8', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{file ? file.name : 'Click to select your bank statement'}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Supports CSV files exported from your bank</div>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <div style={{ background: '#eff6ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
          <strong>Supported CSV formats:</strong><br />
          Your CSV should have columns: <code>Date, Description, Deposit, Withdrawal</code> or <code>Date, Description, Amount</code>.<br />
          Most banks offer CSV export under "Download" or "Export transactions".
        </div>

        {error  && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
        {result && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '12px 16px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
            ✅ <strong>{result.imported} transactions imported</strong>{result.skipped > 0 ? `, ${result.skipped} duplicates skipped` : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={!file || loading} onClick={handleImport}>
            <Upload size={16} />{loading ? 'Importing…' : 'Import Statement'}
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

  // Load existing splits when panel opens
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

  // Fetch match suggestions when match tab is active
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
      } catch (err) { setCatError(err.response?.data?.message || 'Failed to save splits.'); }
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
      } catch (err) { setCatError(err.response?.data?.message || 'Failed to categorise transaction.'); }
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

  const tabBtn = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '12px 8px', border: 'none', background: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        color: tab === id ? '#2563eb' : '#64748b',
        borderBottom: `2px solid ${tab === id ? '#2563eb' : 'transparent'}`,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', position: 'sticky', top: 20 }}>
      {/* Tab header */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        {tabBtn('match',      'Match Tran…')}
        {tabBtn('categorize', 'Categorize…')}
        <button onClick={onClose} style={{ padding: '12px', border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
          <X size={18} />
        </button>
      </div>

      {/* Transaction summary */}
      <div style={{ padding: '14px 18px', background: transaction.type === 'credit' ? '#f0fdf4' : '#fff7f7', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2 }}>{transaction.description}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>{fmtDate(transaction.date)}</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: transaction.type === 'credit' ? '#10b981' : '#ef4444' }}>
            {transaction.type === 'credit' ? '+' : '−'}{fmt(transaction.amount)}
          </div>
        </div>
        {transaction.reference && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Ref: {transaction.reference}</div>}
      </div>

      <div style={{ padding: 18, maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>

        {/* ── Match Tab ── */}
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
              <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '2px 7px', background: s.match_type === 'invoice' ? '#dbeafe' : '#fef3c7', color: s.match_type === 'invoice' ? '#1e40af' : '#92400e', borderRadius: 4 }}>
                      {s.match_type}
                    </span>
                    <span style={{ fontWeight: 600, color: '#1e293b', marginLeft: 8, fontSize: 13 }}>{s.reference}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{fmt(s.amount)}</span>
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
                <Ban size={14} /> Exclude Transaction
              </button>
            </div>
          </div>
        )}

        {/* ── Categorize Tab ── */}
        {tab === 'categorize' && (
          <div>
            {loadingSplits ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Loading…</div>
            ) : (
              <>
                {/* Single account selector (hidden when itemised) */}
                {!isItemized && (
                  <div className="form-group" style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
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

                {/* Itemise toggle */}
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
                    background: isItemized ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${isItemized ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    color: isItemized ? '#2563eb' : '#475569', marginBottom: 16,
                  }}
                >
                  <Scissors size={14} />
                  {isItemized ? 'Cancel Itemise' : 'Itemise (Split Transaction)'}
                </button>

                {/* Split lines */}
                {isItemized && (
                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Split Lines</div>

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
                            style={{ background: 'none', border: 'none', cursor: splits.length > 1 ? 'pointer' : 'not-allowed', color: splits.length > 1 ? '#ef4444' : '#cbd5e1', padding: 4 }}
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
                      style={{ fontSize: 12, color: '#2563eb', background: 'none', border: '1px dashed #93c5fd', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', width: '100%', marginTop: 4 }}
                    >
                      + Add Line
                    </button>

                    {/* Running totals */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                      {[
                        { label: 'Transaction Total', val: fmt(txnAmount), color: '#1e293b' },
                        { label: 'Allocated',         val: fmt(totalSplits), color: totalSplits > txnAmount + 0.01 ? '#ef4444' : '#10b981' },
                        { label: 'Remaining',         val: fmt(Math.abs(remaining)), color: Math.abs(remaining) < 0.01 ? '#10b981' : '#f59e0b' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                          <span>{label}:</span>
                          <span style={{ fontWeight: 700, color }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Notes</label>
                  <textarea
                    className="form-control"
                    style={{ minHeight: 60, resize: 'vertical', fontSize: 13 }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes…"
                  />
                </div>

                {catError && (
                  <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                    {catError}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleSaveCategorize}
                  disabled={catSaving}
                >
                  {catSaving ? 'Saving…' : 'Save Categorisation'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Banking Page ──────────────────────────────────────────
const Banking = () => {
  const { fmt: fmtRaw } = useCurrency();
  const fmt = (n) => fmtRaw(Math.abs(n));

  const [accounts,       setAccounts]       = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions,   setTransactions]   = useState([]);
  const [stats,          setStats]          = useState(null);
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [loadingAccts,   setLoadingAccts]   = useState(true);
  const [loadingTxns,    setLoadingTxns]    = useState(false);
  const [modal,          setModal]          = useState(null); // null|'addAccount'|'editAccount'|'import'
  const [editAccountData, setEditAccountData] = useState(null);
  const [saving,         setSaving]         = useState(false);
  const [acctError,      setAcctError]      = useState('');

  // Panel state
  const [activeTxn,   setActiveTxn]   = useState(null); // transaction open in panel
  const [coaAccounts, setCoaAccounts] = useState([]);

  // Load chart of accounts for categorisation dropdown
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
    } catch (err) { setAcctError(err.response?.data?.message || 'Failed to create account'); }
    finally { setSaving(false); }
  };

  const handleEditAccount = async (form) => {
    setAcctError(''); setSaving(true);
    try {
      await bankingAPI.updateAccount(editAccountData.id, form);
      await fetchAccounts();
      setModal(null);
    } catch (err) { setAcctError(err.response?.data?.message || 'Failed to update'); }
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

  // Reconciliation progress: matched + categorized + excluded count as processed
  const reconciliationPercent = stats && parseInt(stats.total) > 0
    ? Math.round(((parseInt(stats.matched || 0) + parseInt(stats.excluded || 0) + parseInt(stats.categorized || 0)) / parseInt(stats.total)) * 100)
    : 0;

  const panelOpen = !!activeTxn;

  return (
    <div className="page">
      <Header title="Banking" subtitle="Manage accounts, import statements and reconcile transactions" />

      <div className="page-content">
        {/* Balance bar chart — shown whenever there are accounts */}
        {!loadingAccts && accounts.length > 0 && (
          <BalancesChart accounts={accounts} fmt={fmt} />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: panelOpen ? '240px 1fr 400px' : '280px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left: Account List ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>Accounts</span>
              <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => { setAcctError(''); setModal('addAccount'); }}>
                <Plus size={15} /> Add
              </button>
            </div>

            {loadingAccts ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading…</div>
            ) : accounts.length === 0 ? (
              <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 30, textAlign: 'center' }}>
                <Building2 size={32} style={{ color: '#cbd5e1', marginBottom: 10 }} />
                <div style={{ color: '#94a3b8', fontSize: 14 }}>No accounts yet.<br />Add your first bank account.</div>
              </div>
            ) : (
              accounts.map((acct) => (
                <div
                  key={acct.id}
                  onClick={() => { setSelectedAccount(acct); setActiveTxn(null); }}
                  style={{
                    background: '#fff',
                    border: `2px solid ${selectedAccount?.id === acct.id ? '#3b82f6' : '#e2e8f0'}`,
                    borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acct.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{acct.bank_name || ACCOUNT_TYPES.find((t) => t.value === acct.account_type)?.label}</div>
                      <div style={{ fontWeight: 700, color: '#1e293b', marginTop: 6, fontSize: 15 }}>{fmt(acct.current_balance)}</div>
                      {parseInt(acct.unmatched_count) > 0 && (
                        <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>⚠ {acct.unmatched_count} unmatched</div>
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
              ))
            )}
          </div>

          {/* ── Centre: Transactions ── */}
          <div>
            {!selectedAccount ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
                <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: 16 }}>Select an account to view transactions</div>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: '#1e293b' }}>{selectedAccount.name}</div>
                    {selectedAccount.bank_name && <div style={{ fontSize: 13, color: '#94a3b8' }}>{selectedAccount.bank_name}</div>}
                  </div>
                  <button className="btn btn-primary" onClick={() => setModal('import')}>
                    <Upload size={16} /> Import Statement
                  </button>
                </div>

                {/* Reconciliation progress */}
                {stats && parseInt(stats.total) > 0 && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>Reconciliation Progress</span>
                      <span style={{ fontWeight: 700, color: reconciliationPercent === 100 ? '#10b981' : '#f59e0b' }}>{reconciliationPercent}%</span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: reconciliationPercent === 100 ? '#10b981' : '#3b82f6', width: `${reconciliationPercent}%`, transition: 'width 0.4s ease', borderRadius: 999 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Unmatched',   val: stats.unmatched,                       color: '#f59e0b' },
                        { label: 'Matched',     val: stats.matched,                         color: '#10b981' },
                        { label: 'Categorized', val: stats.categorized || 0,                color: '#3b82f6' },
                        { label: 'Excluded',    val: stats.excluded,                        color: '#94a3b8' },
                        { label: 'Money In',    val: fmt(stats.total_credits),              color: '#10b981' },
                        { label: 'Money Out',   val: fmt(stats.total_debits),               color: '#ef4444' },
                      ].map(({ label, val, color }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, color, fontSize: 15 }}>{val}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filter tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {['all', 'unmatched', 'matched', 'categorized', 'excluded'].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        borderColor: statusFilter === s ? '#3b82f6' : '#e2e8f0',
                        background:  statusFilter === s ? '#eff6ff'  : '#fff',
                        color:       statusFilter === s ? '#2563eb'  : '#64748b',
                      }}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                  <button onClick={fetchTransactions} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} title="Refresh">
                    <RefreshCw size={16} />
                  </button>
                </div>

                {/* Transactions table */}
                <div className="card">
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
                              <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
                              <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
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
                              background: activeTxn?.id === txn.id ? '#eff6ff' : 'transparent',
                              transition: 'background 0.1s',
                            }}
                          >
                            <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 13 }}>{fmtDate(txn.date)}</td>
                            <td style={{ maxWidth: panelOpen ? 160 : 280 }}>
                              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }}>{txn.description}</div>
                              {txn.reference        && <div style={{ fontSize: 12, color: '#94a3b8' }}>Ref: {txn.reference}</div>}
                              {txn.coa_account_name && <div style={{ fontSize: 12, color: '#3b82f6' }}>{txn.coa_account_code} – {txn.coa_account_name}</div>}
                              {txn.notes            && <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{txn.notes}</div>}
                            </td>
                            {/* Deposit column (credit) */}
                            <td className="text-right" style={{ fontWeight: 700, whiteSpace: 'nowrap', color: '#10b981', fontSize: 14 }}>
                              {txn.type === 'credit' ? fmt(txn.amount) : ''}
                            </td>
                            {/* Withdrawal column (debit) */}
                            <td className="text-right" style={{ fontWeight: 700, whiteSpace: 'nowrap', color: '#ef4444', fontSize: 14 }}>
                              {txn.type === 'debit' ? fmt(txn.amount) : ''}
                            </td>
                            <td><StatusBadge status={txn.status} /></td>
                            <td className="text-right" style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                              {/* Categorise / match button */}
                              <button
                                className="btn-icon"
                                title="Categorise / Match"
                                onClick={(e) => { e.stopPropagation(); setActiveTxn(activeTxn?.id === txn.id ? null : txn); }}
                                style={{ color: activeTxn?.id === txn.id ? '#2563eb' : '#64748b' }}
                              >
                                <Tag size={15} />
                              </button>
                              {/* Unmatch button for matched transactions */}
                              {txn.status === 'matched' && (
                                <button
                                  className="btn-icon"
                                  title="Unmatch"
                                  style={{ color: '#10b981' }}
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
                      {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                      {panelOpen && <span style={{ marginLeft: 12, color: '#3b82f6' }}>Click a row or <Tag size={12} style={{ display: 'inline' }} /> to open the categorise panel</span>}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Right: Categorise / Match Panel ── */}
          {panelOpen && (
            <CategorizePanel
              key={activeTxn.id}
              transaction={activeTxn}
              coaAccounts={coaAccounts}
              onClose={() => setActiveTxn(null)}
              onSaved={() => { setActiveTxn(null); fetchTransactions(); fetchAccounts(); }}
              fmt={fmt}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'addAccount' && (
        <AccountModal onSave={handleCreateAccount} onClose={() => setModal(null)} saving={saving} error={acctError} />
      )}
      {modal === 'editAccount' && editAccountData && (
        <AccountModal initial={editAccountData} onSave={handleEditAccount} onClose={() => setModal(null)} saving={saving} error={acctError} />
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
