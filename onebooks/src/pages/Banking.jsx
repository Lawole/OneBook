import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Upload, X, Edit2, Trash2, CheckCircle, Link, Ban, RefreshCw, Building2, ChevronRight } from 'lucide-react';
import Header from '../components/Header';
import { bankingAPI } from '../services/api';

// ── helpers ────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking Account' },
  { value: 'savings', label: 'Savings Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  unmatched:   { label: 'Unmatched',  bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  matched:     { label: 'Matched',    bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  excluded:    { label: 'Excluded',   bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  categorized: { label: 'Categorized',bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
};

// ── sub-components ─────────────────────────────────────────────

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
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
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
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}><X size={20} /></button>
  </div>
);

// ── Account Form Modal ─────────────────────────────────────────
const AccountModal = ({ initial, onSave, onClose, saving, error }) => {
  const blank = { name: '', bank_name: '', account_number: '', account_type: 'checking', current_balance: '', currency_code: 'USD' };
  const [form, setForm] = useState(initial || blank);
  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <Overlay onClose={onClose}>
      <ModalBox>
        <ModalHeader title={initial ? 'Edit Account' : 'Add Bank Account'} onClose={onClose} />
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="form-group"><label>Account Name *</label><input className="form-control" required value={form.name} onChange={f('name')} placeholder="Main Checking" /></div>
          <div className="form-group"><label>Bank Name</label><input className="form-control" value={form.bank_name} onChange={f('bank_name')} placeholder="Chase, Bank of America..." /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label>Account Number</label><input className="form-control" value={form.account_number} onChange={f('account_number')} placeholder="****1234" /></div>
            <div className="form-group"><label>Account Type</label>
              <select className="form-control" value={form.account_type} onChange={f('account_type')}>
                {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Opening Balance</label><input className="form-control" type="number" step="0.01" value={form.current_balance} onChange={f('current_balance')} placeholder="0.00" /></div>
            <div className="form-group"><label>Currency</label><input className="form-control" value={form.currency_code} onChange={f('currency_code')} placeholder="USD" maxLength={5} /></div>
          </div>
          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Account'}</button>
          </div>
        </form>
      </ModalBox>
    </Overlay>
  );
};

// ── Import Modal ───────────────────────────────────────────────
const ImportModal = ({ account, onImported, onClose }) => {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

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

        <div style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 10, padding: 30, textAlign: 'center', marginBottom: 20, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
          <Upload size={32} style={{ color: '#94a3b8', marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{file ? file.name : 'Click to select your bank statement'}</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Supports CSV files exported from your bank</div>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0])} />
        </div>

        <div style={{ background: '#eff6ff', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
          <strong>Supported CSV formats:</strong><br />
          Your CSV should have columns like: <code>Date, Description, Debit, Credit</code> or <code>Date, Description, Amount</code>.<br />
          Most banks offer CSV export under "Download" or "Export transactions".
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}

        {result && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '12px 16px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
            ✅ <strong>{result.imported} transactions imported</strong>{result.skipped > 0 ? `, ${result.skipped} duplicates skipped` : ''}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={!file || loading} onClick={handleImport}>
            <Upload size={16} />{loading ? 'Importing...' : 'Import Statement'}
          </button>
        </div>
      </ModalBox>
    </Overlay>
  );
};

// ── Match Modal ────────────────────────────────────────────────
const MatchModal = ({ transaction, onMatched, onClose }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    bankingAPI.getMatchSuggestions(transaction.id)
      .then(res => setSuggestions(res.data.suggestions))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [transaction.id]);

  const match = async (suggestion) => {
    setSaving(suggestion.id);
    try {
      await bankingAPI.updateTransaction(transaction.id, {
        status: 'matched',
        matched_type: suggestion.match_type,
        matched_id: suggestion.id,
      });
      onMatched();
    } catch (err) { console.error(err); }
    finally { setSaving(null); }
  };

  const exclude = async () => {
    setSaving('exclude');
    try { await bankingAPI.updateTransaction(transaction.id, { status: 'excluded' }); onMatched(); }
    catch (err) { console.error(err); }
    finally { setSaving(null); }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalBox width={580}>
        <ModalHeader title="Match Transaction" onClose={onClose} />

        <div style={{ background: transaction.type === 'credit' ? '#d1fae5' : '#fee2e2', borderRadius: 10, padding: '14px 18px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{transaction.description}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{fmtDate(transaction.date)}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, color: transaction.type === 'credit' ? '#10b981' : '#ef4444' }}>
              {transaction.type === 'credit' ? '+' : '-'}{fmt(transaction.amount)}
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 600, marginBottom: 12, color: '#475569' }}>
          {loading ? 'Finding matches...' : suggestions.length > 0 ? `${suggestions.length} possible match${suggestions.length > 1 ? 'es' : ''} found` : 'No close matches found'}
        </div>

        {!loading && suggestions.map((s) => (
          <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.2s' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', padding: '2px 8px', background: s.match_type === 'invoice' ? '#dbeafe' : '#fef3c7', color: s.match_type === 'invoice' ? '#1e40af' : '#92400e', borderRadius: 4 }}>
                  {s.match_type}
                </span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{s.reference}</span>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.party || '—'} · {fmtDate(s.date)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>{fmt(s.amount)}</span>
              <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => match(s)} disabled={saving === s.id}>
                {saving === s.id ? '...' : <><Link size={14} /> Match</>}
              </button>
            </div>
          </div>
        ))}

        {!loading && suggestions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 14 }}>
            No {transaction.type === 'credit' ? 'invoices' : 'expenses'} with a similar amount found.<br />
            You can exclude this transaction or create a matching record first.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <button className="btn btn-outline" style={{ color: '#64748b' }} onClick={exclude} disabled={!!saving}>
            <Ban size={15} /> Exclude
          </button>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </ModalBox>
    </Overlay>
  );
};

// ── Main Banking Page ──────────────────────────────────────────
const Banking = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingAccts, setLoadingAccts] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [modal, setModal] = useState(null); // null|'addAccount'|'editAccount'|'import'|'match'
  const [editAccountData, setEditAccountData] = useState(null);
  const [matchTxn, setMatchTxn] = useState(null);
  const [saving, setSaving] = useState(false);
  const [acctError, setAcctError] = useState('');

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
      if (selectedAccount?.id === id) setSelectedAccount(null);
      fetchAccounts();
    } catch (err) { console.error(err); }
  };

  const handleDeleteTxn = async (id) => {
    if (!window.confirm('Remove this transaction?')) return;
    try { await bankingAPI.deleteTransaction(id); fetchTransactions(); } catch (err) { console.error(err); }
  };

  const reconciliationPercent = stats ? (stats.total > 0 ? Math.round(((parseInt(stats.matched) + parseInt(stats.excluded)) / parseInt(stats.total)) * 100) : 0) : 0;

  return (
    <div className="page">
      <Header title="Banking" subtitle="Manage accounts, import statements and reconcile transactions" />

      <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left: Account List ── */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>Accounts</span>
            <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => { setAcctError(''); setModal('addAccount'); }}>
              <Plus size={15} /> Add
            </button>
          </div>

          {loadingAccts ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Loading...</div>
          ) : accounts.length === 0 ? (
            <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 30, textAlign: 'center' }}>
              <Building2 size={32} style={{ color: '#cbd5e1', marginBottom: 10 }} />
              <div style={{ color: '#94a3b8', fontSize: 14 }}>No accounts yet.<br />Add your first bank account.</div>
            </div>
          ) : (
            accounts.map((acct) => (
              <div
                key={acct.id}
                onClick={() => setSelectedAccount(acct)}
                style={{ background: '#fff', border: `2px solid ${selectedAccount?.id === acct.id ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>{acct.name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{acct.bank_name || ACCOUNT_TYPES.find(t => t.value === acct.account_type)?.label}</div>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginTop: 6, fontSize: 15 }}>{fmt(acct.current_balance)}</div>
                    {parseInt(acct.unmatched_count) > 0 && (
                      <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>⚠ {acct.unmatched_count} unmatched</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); setEditAccountData(acct); setAcctError(''); setModal('editAccount'); }} title="Edit"><Edit2 size={14} /></button>
                    <button className="btn-icon text-danger" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acct.id); }} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Right: Transactions ── */}
        <div>
          {!selectedAccount ? (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '60px 20px', textAlign: 'center' }}>
              <ChevronRight size={40} style={{ color: '#cbd5e1', marginBottom: 12 }} />
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
                      { label: 'Unmatched', val: stats.unmatched, color: '#f59e0b' },
                      { label: 'Matched', val: stats.matched, color: '#10b981' },
                      { label: 'Excluded', val: stats.excluded, color: '#94a3b8' },
                      { label: 'Money In', val: fmt(stats.total_credits), color: '#10b981' },
                      { label: 'Money Out', val: fmt(stats.total_debits), color: '#ef4444' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color, fontSize: 16 }}>{val}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['all', 'unmatched', 'matched', 'excluded'].map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      borderColor: statusFilter === s ? '#3b82f6' : '#e2e8f0',
                      background: statusFilter === s ? '#eff6ff' : '#fff',
                      color: statusFilter === s ? '#2563eb' : '#64748b' }}>
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
                        <th>Type</th>
                        <th className="text-right">Amount</th>
                        <th>Status</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingTxns ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading transactions...</td></tr>
                      ) : transactions.length === 0 ? (
                        <tr><td colSpan="6">
                          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🏦</div>
                            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>
                              {statusFilter !== 'all' ? `No ${statusFilter} transactions` : 'No transactions yet'}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: 14 }}>
                              {statusFilter === 'all' ? 'Import a bank statement to get started' : `Switch to "All" to see all transactions`}
                            </div>
                          </div>
                        </td></tr>
                      ) : transactions.map((txn) => (
                        <tr key={txn.id}>
                          <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 13 }}>{fmtDate(txn.date)}</td>
                          <td style={{ maxWidth: 280 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1e293b' }}>{txn.description}</div>
                            {txn.reference && <div style={{ fontSize: 12, color: '#94a3b8' }}>Ref: {txn.reference}</div>}
                            {txn.category && <div style={{ fontSize: 12, color: '#3b82f6' }}>{txn.category}</div>}
                            {txn.notes && <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{txn.notes}</div>}
                          </td>
                          <td>
                            <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                              background: txn.type === 'credit' ? '#d1fae5' : '#fee2e2',
                              color: txn.type === 'credit' ? '#065f46' : '#991b1b' }}>
                              {txn.type === 'credit' ? '▲ Credit' : '▼ Debit'}
                            </span>
                          </td>
                          <td className="text-right" style={{ fontWeight: 700, whiteSpace: 'nowrap', color: txn.type === 'credit' ? '#10b981' : '#ef4444', fontSize: 15 }}>
                            {txn.type === 'credit' ? '+' : '-'}{fmt(txn.amount)}
                          </td>
                          <td><StatusBadge status={txn.status} /></td>
                          <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                            {txn.status === 'unmatched' && (
                              <button className="btn-icon" title="Match to invoice/expense"
                                onClick={() => { setMatchTxn(txn); setModal('match'); }}
                                style={{ color: '#3b82f6' }}>
                                <Link size={15} />
                              </button>
                            )}
                            {txn.status === 'matched' && (
                              <button className="btn-icon" title="Unmatch" style={{ color: '#10b981' }}
                                onClick={async () => { await bankingAPI.updateTransaction(txn.id, { status: 'unmatched', matched_type: null, matched_id: null }); fetchTransactions(); }}>
                                <CheckCircle size={15} />
                              </button>
                            )}
                            <button className="btn-icon text-danger" title="Remove" onClick={() => handleDeleteTxn(txn.id)}>
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
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal === 'addAccount' && <AccountModal onSave={handleCreateAccount} onClose={() => setModal(null)} saving={saving} error={acctError} />}
      {modal === 'editAccount' && editAccountData && (
        <AccountModal initial={editAccountData} onSave={handleEditAccount} onClose={() => setModal(null)} saving={saving} error={acctError} />
      )}
      {modal === 'import' && selectedAccount && (
        <ImportModal account={selectedAccount} onImported={() => { fetchAccounts(); fetchTransactions(); }} onClose={() => setModal(null)} />
      )}
      {modal === 'match' && matchTxn && (
        <MatchModal transaction={matchTxn} onMatched={() => { setModal(null); fetchTransactions(); }} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

export default Banking;
