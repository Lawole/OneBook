import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Edit2, X, BookOpen, PenLine, BarChart2, RefreshCw, Layers, CheckCircle, AlertCircle,
} from 'lucide-react';
import Header from '../components/Header';
import { accountAPI, journalAPI, budgetAPI, fxAPI, bulkAPI } from '../services/api';
import useCurrency from '../hooks/useCurrency';
import { WORLD_CURRENCIES } from '../utils/currencies';
import {
  mockChartOfAccounts, mockJournals, mockBudgets, mockFxAdjustments,
  mockInvoices, mockExpenses, mockCategories,
} from '../utils/mockData';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
const TYPE_COLORS = {
  Asset: '#3b82f6', Liability: '#ef4444', Equity: '#8b5cf6', Revenue: '#10b981', Expense: '#f59e0b',
};

const TypeBadge = ({ type }) => (
  <span style={{
    background: (TYPE_COLORS[type] || '#64748b') + '18',
    color: TYPE_COLORS[type] || '#64748b',
    padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600,
  }}>{type}</span>
);

const StatusBadge = ({ status }) => {
  const colors = { posted: '#10b981', draft: '#f59e0b', active: '#3b82f6', inactive: '#6b7280' };
  const c = colors[status] || '#6b7280';
  return (
    <span style={{ background: c + '18', color: c, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
};

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─────────────────────────────────────────────────────────────────────────────
// Chart of Accounts Tab
// ─────────────────────────────────────────────────────────────────────────────

const blankAccount = { code: '', name: '', type: 'Asset', category: '', balance: '' };

const ChartOfAccountsTab = ({ fmt }) => {
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [form, setForm] = useState(blankAccount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    accountAPI.getAll()
      .then((res) => setAccounts(res.data.accounts || []))
      .catch(() => setAccounts(mockChartOfAccounts));
  }, []);

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase();
    const matchQ = !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
    const matchT = !typeFilter || a.type === typeFilter;
    return matchQ && matchT;
  });

  const openCreate = () => { setForm(blankAccount); setError(''); setModal('create'); };
  const openEdit = (a) => { setForm({ ...a }); setError(''); setModal('edit'); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        await accountAPI.create(form);
        setAccounts((prev) => [...prev, { ...form, id: Date.now(), balance: parseFloat(form.balance) || 0 }]);
      } else {
        await accountAPI.update(form.id, form);
        setAccounts((prev) => prev.map((a) => a.id === form.id ? { ...form, balance: parseFloat(form.balance) || 0 } : a));
      }
      setModal(null);
    } catch {
      // demo mode: apply locally
      if (modal === 'create') {
        setAccounts((prev) => [...prev, { ...form, id: Date.now(), balance: parseFloat(form.balance) || 0 }]);
      } else {
        setAccounts((prev) => prev.map((a) => a.id === form.id ? { ...form, balance: parseFloat(form.balance) || 0 } : a));
      }
      setModal(null);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this account?')) return;
    try { await accountAPI.delete(id); } catch { /* demo */ }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="form-control" placeholder="Search accounts..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <select className="form-control" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 150 }}>
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={18} /> Add Account</button>
      </div>

      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Account Name</th><th>Type</th><th>Category</th><th className="text-right">Balance</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted">No accounts found.</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{a.code}</td>
                  <td className="font-medium">{a.name}</td>
                  <td><TypeBadge type={a.type} /></td>
                  <td style={{ color: '#64748b', fontSize: 13 }}>{a.category}</td>
                  <td className="text-right" style={{ color: a.balance < 0 ? '#dc2626' : '#1e293b' }}>{fmt(a.balance)}</td>
                  <td className="text-right">
                    <button className="btn-icon" onClick={() => openEdit(a)} title="Edit"><Edit2 size={16} /></button>
                    <button className="btn-icon text-danger" onClick={() => handleDelete(a.id)} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 480 }}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>{modal === 'create' ? 'New Account' : 'Edit Account'}</h3>
              <button onClick={() => setModal(null)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Account Code *</label>
                  <input className="form-control" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1100" />
                </div>
                <div className="form-group">
                  <label>Type *</label>
                  <select className="form-control" required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Account Name *</label>
                <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Accounts Receivable" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Category</label>
                  <input className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Current Asset" />
                </div>
                <div className="form-group">
                  <label>Opening Balance</label>
                  <input className="form-control" type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Manual Journals Tab
// ─────────────────────────────────────────────────────────────────────────────

const emptyLine = { account_code: '', account_name: '', type: 'debit', amount: '' };
const blankJournal = { reference: '', date: new Date().toISOString().split('T')[0], description: '', lines: [{ ...emptyLine }, { ...emptyLine }] };

const ManualJournalsTab = ({ fmt }) => {
  const [journals, setJournals] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | 'edit' | 'view'
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(blankJournal);
  const [saving, setSaving] = useState(false);
  const [lineError, setLineError] = useState('');

  useEffect(() => {
    journalAPI.getAll()
      .then((res) => setJournals(res.data.journals || []))
      .catch(() => setJournals(mockJournals));
  }, []);

  const totalDebits = (lines) => lines.filter((l) => l.type === 'debit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCredits = (lines) => lines.filter((l) => l.type === 'credit').reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const openCreate = () => { setForm({ ...blankJournal, lines: [{ ...emptyLine }, { ...emptyLine }] }); setLineError(''); setModal('create'); };
  const openEdit = (j) => {
    if (j.status === 'posted') return;
    setForm({ ...j, lines: j.lines.map((l) => ({ ...l })) });
    setLineError('');
    setModal('edit');
  };
  const openView = (j) => { setCurrent(j); setModal('view'); };

  const updateLine = (idx, field, value) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: value };
    setForm({ ...form, lines });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const dr = totalDebits(form.lines);
    const cr = totalCredits(form.lines);
    if (Math.abs(dr - cr) > 0.001) { setLineError(`Debits (${fmt(dr)}) ≠ Credits (${fmt(cr)}). Please balance the entry.`); return; }
    setLineError(''); setSaving(true);
    const payload = { ...form, status: 'draft' };
    try {
      if (modal === 'create') {
        await journalAPI.create(payload);
        setJournals((prev) => [...prev, { ...payload, id: Date.now() }]);
      } else {
        await journalAPI.update(form.id, payload);
        setJournals((prev) => prev.map((j) => j.id === form.id ? { ...payload, id: form.id } : j));
      }
    } catch {
      if (modal === 'create') setJournals((prev) => [...prev, { ...payload, id: Date.now() }]);
      else setJournals((prev) => prev.map((j) => j.id === form.id ? { ...payload, id: form.id } : j));
    } finally { setSaving(false); setModal(null); }
  };

  const handlePost = async (j) => {
    if (!window.confirm(`Post journal ${j.reference}? This cannot be undone.`)) return;
    try { await journalAPI.post(j.id); } catch { /* demo */ }
    setJournals((prev) => prev.map((x) => x.id === j.id ? { ...x, status: 'posted' } : x));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this journal entry?')) return;
    try { await journalAPI.delete(id); } catch { /* demo */ }
    setJournals((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={18} /> New Journal Entry</button>
      </div>

      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead>
              <tr><th>Reference</th><th>Date</th><th>Description</th><th>Status</th><th className="text-right">Total Debit</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {journals.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted">No journal entries yet.</td></tr>
              ) : journals.map((j) => (
                <tr key={j.id}>
                  <td className="font-medium">{j.reference}</td>
                  <td>{j.date}</td>
                  <td style={{ color: '#64748b' }}>{j.description}</td>
                  <td><StatusBadge status={j.status} /></td>
                  <td className="text-right">{fmt(totalDebits(j.lines))}</td>
                  <td className="text-right">
                    <button className="btn-icon" onClick={() => openView(j)} title="View"><BookOpen size={16} /></button>
                    {j.status !== 'posted' && (
                      <>
                        <button className="btn-icon" onClick={() => openEdit(j)} title="Edit"><Edit2 size={16} /></button>
                        <button className="btn-icon" onClick={() => handlePost(j)} title="Post" style={{ color: '#10b981' }}><CheckCircle size={16} /></button>
                      </>
                    )}
                    <button className="btn-icon text-danger" onClick={() => handleDelete(j.id)} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {modal === 'view' && current && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 600 }}>
            <div style={modalHeader}>
              <div>
                <h3 style={{ margin: 0 }}>{current.reference}</h3>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{current.description} · {current.date}</p>
              </div>
              <button onClick={() => setModal(null)} style={closeBtn}><X size={20} /></button>
            </div>
            <table className="table">
              <thead><tr><th>Account Code</th><th>Account Name</th><th>Debit</th><th>Credit</th></tr></thead>
              <tbody>
                {current.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace' }}>{l.account_code}</td>
                    <td>{l.account_name}</td>
                    <td style={{ color: '#3b82f6' }}>{l.type === 'debit' ? fmt(l.amount) : '—'}</td>
                    <td style={{ color: '#ef4444' }}>{l.type === 'credit' ? fmt(l.amount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ color: '#3b82f6' }}>{fmt(totalDebits(current.lines))}</td>
                  <td style={{ color: '#ef4444' }}>{fmt(totalCredits(current.lines))}</td>
                </tr>
              </tfoot>
            </table>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(modal === 'create' || modal === 'edit') && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 640 }}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>{modal === 'create' ? 'New Journal Entry' : 'Edit Journal Entry'}</h3>
              <button onClick={() => setModal(null)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Reference *</label>
                  <input className="form-control" required value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="JNL-XXXX" />
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input className="form-control" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Journal Lines *</label>
              {form.lines.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 110px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input className="form-control" placeholder="Code" value={line.account_code} onChange={(e) => updateLine(idx, 'account_code', e.target.value)} />
                  <input className="form-control" placeholder="Account Name" value={line.account_name} onChange={(e) => updateLine(idx, 'account_name', e.target.value)} />
                  <select className="form-control" value={line.type} onChange={(e) => updateLine(idx, 'type', e.target.value)}>
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                  <input className="form-control" type="number" step="0.01" placeholder="Amount" value={line.amount} onChange={(e) => updateLine(idx, 'amount', e.target.value)} />
                  {form.lines.length > 2 && (
                    <button type="button" style={closeBtn} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline" style={{ marginBottom: 12 }} onClick={() => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] })}>+ Add Line</button>

              {/* Running totals */}
              <div style={{ display: 'flex', gap: 20, marginBottom: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                <span>Debits: <strong style={{ color: '#3b82f6' }}>{fmt(totalDebits(form.lines))}</strong></span>
                <span>Credits: <strong style={{ color: '#ef4444' }}>{fmt(totalCredits(form.lines))}</strong></span>
                {Math.abs(totalDebits(form.lines) - totalCredits(form.lines)) > 0.001 && (
                  <span style={{ color: '#f59e0b' }}>⚠ Difference: {fmt(Math.abs(totalDebits(form.lines) - totalCredits(form.lines)))}</span>
                )}
              </div>

              {lineError && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{lineError}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save as Draft'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Budgets Tab
// ─────────────────────────────────────────────────────────────────────────────

const BudgetsTab = ({ fmt }) => {
  const [budgets, setBudgets] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | 'view'
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState({ fiscal_year: new Date().getFullYear(), name: '', lines: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    budgetAPI.getAll()
      .then((res) => setBudgets(res.data.budgets || []))
      .catch(() => setBudgets(mockBudgets));
  }, []);

  const openCreate = () => {
    setForm({
      fiscal_year: new Date().getFullYear() + 1,
      name: '',
      lines: [{ account_code: '', account_name: '', category: 'Revenue', annual_total: '', actual_to_date: 0 }],
    });
    setModal('create');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      status: 'active',
      lines: form.lines.map((l) => ({
        ...l,
        annual_total: parseFloat(l.annual_total) || 0,
        monthly: Array(12).fill(0).map((_, i) => Math.round((parseFloat(l.annual_total) || 0) / 12)),
      })),
    };
    try {
      await budgetAPI.create(payload);
      setBudgets((prev) => [...prev, { ...payload, id: Date.now() }]);
    } catch {
      setBudgets((prev) => [...prev, { ...payload, id: Date.now() }]);
    } finally { setSaving(false); setModal(null); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    try { await budgetAPI.delete(id); } catch { /* demo */ }
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { account_code: '', account_name: '', category: 'Revenue', annual_total: '', actual_to_date: 0 }] });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={18} /> New Budget</button>
      </div>

      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead><tr><th>Budget Name</th><th>Fiscal Year</th><th>Status</th><th className="text-right">Total Budgeted</th><th className="text-right">Actual to Date</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {budgets.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted">No budgets yet.</td></tr>
              ) : budgets.map((b) => {
                const totalBudget = b.lines.reduce((s, l) => s + (l.annual_total || 0), 0);
                const totalActual = b.lines.reduce((s, l) => s + (l.actual_to_date || 0), 0);
                return (
                  <tr key={b.id}>
                    <td className="font-medium">{b.name}</td>
                    <td>{b.fiscal_year}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="text-right">{fmt(totalBudget)}</td>
                    <td className="text-right">{fmt(totalActual)}</td>
                    <td className="text-right">
                      <button className="btn-icon" onClick={() => { setCurrent(b); setModal('view'); }} title="View"><BookOpen size={16} /></button>
                      <button className="btn-icon text-danger" onClick={() => handleDelete(b.id)} title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Budget Details */}
      {modal === 'view' && current && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 900 }}>
            <div style={modalHeader}>
              <div>
                <h3 style={{ margin: 0 }}>{current.name}</h3>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>FY{current.fiscal_year} · {current.status}</p>
              </div>
              <button onClick={() => setModal(null)} style={closeBtn}><X size={20} /></button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>Account</th><th>Category</th><th className="text-right">Annual Budget</th><th className="text-right">Actual to Date</th><th className="text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {current.lines.map((l, i) => {
                    const variance = l.annual_total - l.actual_to_date;
                    return (
                      <tr key={i}>
                        <td><span style={{ fontFamily: 'monospace', color: '#64748b', marginRight: 8 }}>{l.account_code}</span>{l.account_name}</td>
                        <td><TypeBadge type={l.category === 'Revenue' ? 'Revenue' : 'Expense'} /></td>
                        <td className="text-right">{fmt(l.annual_total)}</td>
                        <td className="text-right">{fmt(l.actual_to_date)}</td>
                        <td className="text-right" style={{ color: variance >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {variance >= 0 ? '+' : ''}{fmt(variance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={2}>Total</td>
                    <td className="text-right">{fmt(current.lines.reduce((s, l) => s + (l.annual_total || 0), 0))}</td>
                    <td className="text-right">{fmt(current.lines.reduce((s, l) => s + (l.actual_to_date || 0), 0))}</td>
                    <td className="text-right">{fmt(current.lines.reduce((s, l) => s + (l.annual_total - l.actual_to_date), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Budget */}
      {modal === 'create' && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 640 }}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>New Budget</h3>
              <button onClick={() => setModal(null)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Budget Name *</label>
                  <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FY2027 Operating Budget" />
                </div>
                <div className="form-group">
                  <label>Fiscal Year *</label>
                  <input className="form-control" type="number" required value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: parseInt(e.target.value) })} />
                </div>
              </div>

              <label style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Budget Lines</label>
              {form.lines.map((line, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 110px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input className="form-control" placeholder="Code" value={line.account_code} onChange={(e) => { const l = [...form.lines]; l[idx] = { ...l[idx], account_code: e.target.value }; setForm({ ...form, lines: l }); }} />
                  <input className="form-control" placeholder="Account Name" value={line.account_name} onChange={(e) => { const l = [...form.lines]; l[idx] = { ...l[idx], account_name: e.target.value }; setForm({ ...form, lines: l }); }} />
                  <select className="form-control" value={line.category} onChange={(e) => { const l = [...form.lines]; l[idx] = { ...l[idx], category: e.target.value }; setForm({ ...form, lines: l }); }}>
                    <option>Revenue</option><option>Expense</option>
                  </select>
                  <input className="form-control" type="number" step="0.01" placeholder="Annual Budget" value={line.annual_total} onChange={(e) => { const l = [...form.lines]; l[idx] = { ...l[idx], annual_total: e.target.value }; setForm({ ...form, lines: l }); }} />
                  {form.lines.length > 1 && (
                    <button type="button" style={closeBtn} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })}><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" className="btn btn-outline" style={{ marginBottom: 16 }} onClick={addLine}>+ Add Line</button>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Budget'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Currency Adjustment Tab
// ─────────────────────────────────────────────────────────────────────────────

const blankFx = { date: new Date().toISOString().split('T')[0], from_currency: 'USD', to_currency: 'NGN', exchange_rate: '', affected_accounts: '', adjustment_amount: '', notes: '' };

const CurrencyAdjustmentTab = ({ fmt }) => {
  const [adjustments, setAdjustments] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(blankFx);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fxAPI.getAll()
      .then((res) => setAdjustments(res.data.adjustments || []))
      .catch(() => setAdjustments(mockFxAdjustments));
  }, []);

  const openCreate = () => { setForm(blankFx); setEditId(null); setModal(true); };
  const openEdit = (a) => {
    setForm({ ...a, affected_accounts: a.affected_accounts.join(', ') });
    setEditId(a.id);
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      exchange_rate: parseFloat(form.exchange_rate),
      adjustment_amount: parseFloat(form.adjustment_amount),
      affected_accounts: form.affected_accounts.split(',').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editId) {
        await fxAPI.update(editId, payload);
        setAdjustments((prev) => prev.map((a) => a.id === editId ? { ...payload, id: editId } : a));
      } else {
        await fxAPI.create(payload);
        setAdjustments((prev) => [...prev, { ...payload, id: Date.now() }]);
      }
    } catch {
      if (editId) setAdjustments((prev) => prev.map((a) => a.id === editId ? { ...payload, id: editId } : a));
      else setAdjustments((prev) => [...prev, { ...payload, id: Date.now() }]);
    } finally { setSaving(false); setModal(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this adjustment?')) return;
    try { await fxAPI.delete(id); } catch { /* demo */ }
    setAdjustments((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openCreate}><Plus size={18} /> New Adjustment</button>
      </div>

      <div className="card">
        <div className="card-body">
          <table className="table">
            <thead>
              <tr><th>Date</th><th>From</th><th>To</th><th className="text-right">Rate</th><th>Accounts</th><th className="text-right">Adjustment</th><th>Notes</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {adjustments.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted">No adjustments yet.</td></tr>
              ) : adjustments.map((a) => (
                <tr key={a.id}>
                  <td>{a.date}</td>
                  <td><strong>{a.from_currency}</strong></td>
                  <td><strong>{a.to_currency}</strong></td>
                  <td className="text-right">{Number(a.exchange_rate).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>{(a.affected_accounts || []).join(', ')}</td>
                  <td className="text-right" style={{ color: a.adjustment_amount >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                    {a.adjustment_amount >= 0 ? '+' : ''}{fmt(Math.abs(a.adjustment_amount))}
                  </td>
                  <td style={{ fontSize: 12, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.notes}</td>
                  <td className="text-right">
                    <button className="btn-icon" onClick={() => openEdit(a)} title="Edit"><Edit2 size={16} /></button>
                    <button className="btn-icon text-danger" onClick={() => handleDelete(a.id)} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 520 }}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>{editId ? 'Edit Adjustment' : 'New Currency Adjustment'}</h3>
              <button onClick={() => setModal(false)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Date *</label>
                  <input className="form-control" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Exchange Rate *</label>
                  <input className="form-control" type="number" step="0.0001" required value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} placeholder="e.g. 1580.50" />
                </div>
                <div className="form-group">
                  <label>From Currency *</label>
                  <select className="form-control" value={form.from_currency} onChange={(e) => setForm({ ...form, from_currency: e.target.value })}>
                    {WORLD_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>To Currency *</label>
                  <select className="form-control" value={form.to_currency} onChange={(e) => setForm({ ...form, to_currency: e.target.value })}>
                    {WORLD_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Affected Account Codes</label>
                <input className="form-control" value={form.affected_accounts} onChange={(e) => setForm({ ...form, affected_accounts: e.target.value })} placeholder="e.g. 1000, 1100 (comma-separated)" />
              </div>
              <div className="form-group">
                <label>Adjustment Amount *</label>
                <input className="form-control" type="number" step="0.01" required value={form.adjustment_amount} onChange={(e) => setForm({ ...form, adjustment_amount: e.target.value })} placeholder="Use negative for loss" />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Adjustment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Update Tab
// ─────────────────────────────────────────────────────────────────────────────

const INVOICE_STATUSES = ['draft', 'sent', 'unpaid', 'paid', 'overdue'];
const STATUS_COLORS = { draft: '#6b7280', sent: '#3b82f6', unpaid: '#f59e0b', paid: '#10b981', overdue: '#ef4444' };

const BulkUpdateTab = ({ fmt }) => {
  const [recordType, setRecordType] = useState('invoices');
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [action, setAction] = useState('status');
  const [actionValue, setActionValue] = useState('paid');
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    setSelected(new Set()); setResult('');
    bulkAPI.getRecords(recordType, {})
      .then((res) => setRecords(res.data.records || []))
      .catch(() => setRecords(recordType === 'invoices' ? mockInvoices : mockExpenses));
  }, [recordType]);

  const filtered = records.filter((r) => {
    if (recordType === 'invoices' && statusFilter) return r.status === statusFilter;
    if (recordType === 'expenses' && catFilter) return r.category === catFilter;
    return true;
  });

  const toggleAll = () => {
    if (selected.size === filtered.length) { setSelected(new Set()); }
    else { setSelected(new Set(filtered.map((r) => r.id))); }
  };

  const toggleOne = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const handleApply = async () => {
    if (selected.size === 0) { alert('Please select at least one record.'); return; }
    setApplying(true); setResult('');
    const ids = [...selected];
    try {
      await bulkAPI.applyBulk(recordType, ids, action, actionValue);
    } catch { /* demo */ }
    // Apply locally
    setRecords((prev) => prev.map((r) => {
      if (!ids.includes(r.id)) return r;
      if (recordType === 'invoices' && action === 'status') return { ...r, status: actionValue };
      if (recordType === 'expenses' && action === 'category') return { ...r, category: actionValue };
      return r;
    }));
    setResult(`✓ Updated ${ids.length} record${ids.length > 1 ? 's' : ''} successfully.`);
    setSelected(new Set());
    setApplying(false);
  };

  return (
    <div>
      {/* Step 1: Record type */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {['invoices', 'expenses'].map((t) => (
          <button key={t} onClick={() => setRecordType(t)} style={{
            flex: 1, padding: '14px 16px', borderRadius: 12, border: '2px solid',
            borderColor: recordType === t ? '#4f46e5' : '#e2e8f0',
            background: recordType === t ? '#4f46e5' : '#fff',
            color: recordType === t ? '#fff' : '#475569',
            cursor: 'pointer', fontWeight: 600, fontSize: 14, textTransform: 'capitalize', transition: 'all 0.15s',
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Step 2: Filters + table */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        {recordType === 'invoices' ? (
          <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">All Statuses</option>
            {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        ) : (
          <select className="form-control" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">All Categories</option>
            {mockCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        )}
        <span style={{ fontSize: 13, color: '#64748b' }}>{selected.size} selected</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <table className="table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
                {recordType === 'invoices' ? (
                  <><th>#</th><th>Customer</th><th>Date</th><th className="text-right">Amount</th><th>Status</th></>
                ) : (
                  <><th>#</th><th>Description</th><th>Date</th><th className="text-right">Amount</th><th>Category</th></>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => toggleOne(r.id)}>
                  <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} onClick={(e) => e.stopPropagation()} /></td>
                  {recordType === 'invoices' ? (
                    <>
                      <td className="font-medium">{r.invoice_number}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.invoice_date}</td>
                      <td className="text-right">{fmt(r.total_amount)}</td>
                      <td><span style={{ background: (STATUS_COLORS[r.status] || '#64748b') + '18', color: STATUS_COLORS[r.status] || '#64748b', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{r.status}</span></td>
                    </>
                  ) : (
                    <>
                      <td className="font-medium">{r.expense_number}</td>
                      <td>{r.description}</td>
                      <td>{r.expense_date}</td>
                      <td className="text-right">{fmt(r.amount)}</td>
                      <td style={{ fontSize: 12, color: '#64748b' }}>{r.category}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Step 3: Apply action */}
      <div className="card">
        <div className="card-body">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label>Action</label>
              <select className="form-control" value={action} onChange={(e) => setAction(e.target.value)}>
                {recordType === 'invoices' ? <option value="status">Change Status</option> : <option value="category">Change Category</option>}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label>New Value</label>
              {recordType === 'invoices' ? (
                <select className="form-control" value={actionValue} onChange={(e) => setActionValue(e.target.value)}>
                  {INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              ) : (
                <select className="form-control" value={actionValue} onChange={(e) => setActionValue(e.target.value)}>
                  {mockCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              )}
            </div>
            <button className="btn btn-primary" onClick={handleApply} disabled={applying || selected.size === 0}>
              {applying ? 'Applying...' : `Apply to ${selected.size} record${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
          {result && (
            <div style={{ marginTop: 12, background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              {result}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Accountant Page
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { slug: 'chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen  },
  { slug: 'journals',          label: 'Manual Journals',   icon: PenLine   },
  { slug: 'budgets',           label: 'Budgets',           icon: BarChart2 },
  { slug: 'currency',          label: 'Currency Adjustment', icon: RefreshCw },
  { slug: 'bulk-update',       label: 'Bulk Update',       icon: Layers    },
];

const getActiveSlug = (pathname) => {
  if (pathname.includes('journals'))    return 'journals';
  if (pathname.includes('budgets'))     return 'budgets';
  if (pathname.includes('currency'))    return 'currency';
  if (pathname.includes('bulk-update')) return 'bulk-update';
  return 'chart-of-accounts';
};

const Accountant = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { fmt } = useCurrency();
  const activeSlug = getActiveSlug(location.pathname);

  const subtitles = {
    'chart-of-accounts': 'Manage your full chart of accounts',
    'journals':          'Create and post double-entry journal entries',
    'budgets':           'Set and track budgets by fiscal year',
    'currency':          'Record foreign exchange revaluations',
    'bulk-update':       'Apply bulk changes to invoices or expenses',
  };

  return (
    <div className="page">
      <Header title="Accountant" subtitle={subtitles[activeSlug]} />
      <div className="page-content">

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {TABS.map(({ slug, label, icon: Icon }) => (
            <button
              key={slug}
              onClick={() => navigate(`/accountant/${slug}`)}
              style={{
                padding: '10px 16px', borderRadius: 10, border: '2px solid',
                borderColor: activeSlug === slug ? '#4f46e5' : '#e2e8f0',
                background: activeSlug === slug ? '#4f46e5' : '#fff',
                color: activeSlug === slug ? '#fff' : '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontWeight: 600, fontSize: 13, transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {activeSlug === 'chart-of-accounts' && <ChartOfAccountsTab fmt={fmt} />}
        {activeSlug === 'journals'          && <ManualJournalsTab fmt={fmt} />}
        {activeSlug === 'budgets'           && <BudgetsTab fmt={fmt} />}
        {activeSlug === 'currency'          && <CurrencyAdjustmentTab fmt={fmt} />}
        {activeSlug === 'bulk-update'       && <BulkUpdateTab fmt={fmt} />}

      </div>
    </div>
  );
};

export default Accountant;
