import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, X, Edit2 } from 'lucide-react';
import Header from '../components/Header';
import { expenseAPI } from '../services/api';
import { formatDate } from '../utils/helpers';
import useCurrency from '../hooks/useCurrency';

const CATEGORIES = [
  { value: 'office-supplies', label: 'Office Supplies' },
  { value: 'travel', label: 'Travel' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'software', label: 'Software & Subscriptions' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const blank = { description: '', category: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' };

const ExpenseForm = ({ initial, onSave, onCancel, saving, error }) => {
  const [form, setForm] = useState(initial);
  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group">
        <label>Description *</label>
        <input className="form-control" required value={form.description} onChange={f('description')} placeholder="Office supplies purchase" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group">
          <label>Category *</label>
          <select className="form-control" required value={form.category} onChange={f('category')}>
            <option value="">Select category</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Amount *</label>
          <input className="form-control" type="number" step="0.01" required value={form.amount} onChange={f('amount')} placeholder="0.00" />
        </div>
        <div className="form-group">
          <label>Date *</label>
          <input className="form-control" type="date" required value={form.expense_date} onChange={f('expense_date')} />
        </div>
      </div>
      <div className="form-group">
        <label>Notes</label>
        <textarea className="form-control" rows={2} value={form.notes} onChange={f('notes')} placeholder="Additional notes..." />
      </div>
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Expense'}</button>
      </div>
    </form>
  );
};

const Expenses = () => {
  const { fmt } = useCurrency();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'create' | 'edit'
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchExpenses = useCallback(async () => {
    try {
      const response = await expenseAPI.getAll({ search, category: categoryFilter });
      setExpenses(response.data.expenses);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const closeModal = () => { setModal(null); setEditData(null); setError(''); };

  const handleCreate = async (form) => {
    setError(''); setSaving(true);
    try {
      await expenseAPI.create(form);
      closeModal(); fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add expense');
    } finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setError(''); setSaving(true);
    try {
      await expenseAPI.update(form._id, form);
      closeModal(); fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update expense');
    } finally { setSaving(false); }
  };

  const openEdit = (exp) => {
    setError('');
    setEditData({
      _id: exp.id,
      description: exp.description,
      category: exp.category,
      amount: exp.amount,
      expense_date: exp.expense_date?.split('T')[0] || '',
      notes: exp.notes || '',
    });
    setModal('edit');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try { await expenseAPI.delete(id); fetchExpenses(); }
    catch (err) { console.error(err); }
  };

  const getCategoryLabel = (val) => CATEGORIES.find((c) => c.value === val)?.label || val;

  return (
    <div className="page">
      <Header title="Expenses" subtitle="Track and manage your business expenses" />

      <div className="page-content">
        <div className="page-actions">
          <div className="filters">
            <div className="search-box">
              <Search size={20} />
              <input type="text" placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-control" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: 180 }}>
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => { setError(''); setModal('create'); }}>
            <Plus size={20} /> Add Expense
          </button>
        </div>

        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense #</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center" style={{ padding: 40, color: '#94a3b8' }}>Loading expenses...</td></tr>
                ) : expenses.length > 0 ? expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(exp.expense_date)}</td>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{exp.expense_number}</span></td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</div>
                      {exp.notes && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.notes}</div>}
                    </td>
                    <td><span className="badge badge-secondary">{getCategoryLabel(exp.category)}</span></td>
                    <td style={{ color: '#64748b' }}>{exp.vendor_name || '—'}</td>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(exp.amount)}</td>
                    <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon" onClick={() => openEdit(exp)} title="Edit"><Edit2 size={16} /></button>
                      <button className="btn-icon text-danger" onClick={() => handleDelete(exp.id)} title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7">
                      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
                        <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
                        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>No expenses yet</div>
                        <div style={{ color: '#94a3b8', fontSize: 14 }}>Click "Add Expense" to record your first expense</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {expenses.length > 0 && (
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</span>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>
                Total: {fmt(expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}
              </span>
            </div>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>{modal === 'edit' ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={closeModal} style={closeBtn}><X size={20} /></button>
            </div>
            <ExpenseForm
              initial={modal === 'edit' ? editData : blank}
              onSave={modal === 'edit' ? handleEdit : handleCreate}
              onCancel={closeModal}
              saving={saving}
              error={error}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 };

export default Expenses;
