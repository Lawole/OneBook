import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import Header from '../components/Header';
import { expenseAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';

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

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ description: '', category: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });

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

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await expenseAPI.create(form);
      setShowModal(false);
      setForm({ description: '', category: '', amount: '', expense_date: new Date().toISOString().split('T')[0], notes: '' });
      fetchExpenses();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await expenseAPI.delete(id);
      fetchExpenses();
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

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
            <select className="form-control" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: 200 }}>
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} /> Add Expense
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Expense #</th><th>Description</th><th>Category</th><th>Vendor</th><th>Amount</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center">Loading...</td></tr>
                ) : expenses.length > 0 ? expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td>{formatDate(exp.expense_date)}</td>
                    <td className="font-medium">{exp.expense_number}</td>
                    <td>{exp.description}</td>
                    <td><span className="badge badge-secondary">{exp.category?.replace(/-/g, ' ')}</span></td>
                    <td>{exp.vendor_name || '-'}</td>
                    <td>{formatCurrency(exp.amount)}</td>
                    <td className="text-right">
                      <button className="btn-icon text-danger" onClick={() => handleDelete(exp.id)} title="Delete"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="text-center text-muted">No expenses yet. Add your first expense!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Add Expense</h3>
              <button onClick={() => setShowModal(false)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Description *</label>
                <input className="form-control" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Office supplies purchase" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Category *</label>
                  <select className="form-control" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Select category</option>
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount *</label>
                  <input className="form-control" type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Date *</label>
                  <input className="form-control" type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
              </div>
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 };

export default Expenses;
