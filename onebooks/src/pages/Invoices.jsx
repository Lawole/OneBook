import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Download, Eye, Trash2, X } from 'lucide-react';
import Header from '../components/Header';
import { invoiceAPI, customerAPI, itemAPI } from '../services/api';
import { formatCurrency, formatDate, downloadFile } from '../utils/helpers';

const emptyLine = { description: '', quantity: 1, unit_price: '' };

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    customer_id: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    lines: [{ ...emptyLine }],
  });

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await invoiceAPI.getAll({ search, status: statusFilter });
      setInvoices(response.data.invoices);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const openModal = async () => {
    try {
      const [custRes, itemRes] = await Promise.all([
        customerAPI.getAll({ per_page: 100 }),
        itemAPI.getAll({ per_page: 100 }),
      ]);
      setCustomers(custRes.data.customers || []);
      setItems(itemRes.data.items || []);
    } catch (err) {
      console.error('Error loading customers/items:', err);
    }
    setShowModal(true);
  };

  const updateLine = (idx, field, value) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: value };
    if (field === 'description') {
      const matched = items.find((i) => i.name === value);
      if (matched) lines[idx].unit_price = matched.unit_price;
    }
    setForm({ ...form, lines });
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] });
  const removeLine = (idx) => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });

  const subtotal = form.lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        customer_id: form.customer_id,
        invoice_date: form.invoice_date,
        due_date: form.due_date,
        notes: form.notes,
        items: form.lines.map((l) => ({
          description: l.description,
          quantity: parseInt(l.quantity),
          unit_price: parseFloat(l.unit_price),
        })),
      };
      await invoiceAPI.create(payload);
      setShowModal(false);
      setForm({ customer_id: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '', notes: '', lines: [{ ...emptyLine }] });
      fetchInvoices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async (id, invoiceNumber) => {
    try {
      const response = await invoiceAPI.downloadPDF(id);
      downloadFile(response.data, `invoice_${invoiceNumber}.pdf`);
    } catch (err) {
      console.error('Error downloading PDF:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await invoiceAPI.delete(id);
      fetchInvoices();
    } catch (err) {
      console.error('Error deleting invoice:', err);
    }
  };

  const getStatusBadge = (status) => {
    const badges = { draft: 'badge badge-secondary', sent: 'badge badge-info', paid: 'badge badge-success', overdue: 'badge badge-danger' };
    return badges[status] || 'badge';
  };

  return (
    <div className="page">
      <Header title="Invoices" subtitle="Manage your sales invoices" />

      <div className="page-content">
        <div className="page-actions">
          <div className="filters">
            <div className="search-box">
              <Search size={20} />
              <input type="text" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 150 }}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={20} /> New Invoice
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th><th>Customer</th><th>Date</th><th>Due Date</th><th>Amount</th><th>Status</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center">Loading...</td></tr>
                ) : invoices.length > 0 ? invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-medium">{inv.invoice_number}</td>
                    <td>{inv.customer_name}</td>
                    <td>{formatDate(inv.invoice_date)}</td>
                    <td>{formatDate(inv.due_date)}</td>
                    <td>{formatCurrency(inv.total_amount)}</td>
                    <td><span className={getStatusBadge(inv.status)}>{inv.status}</span></td>
                    <td className="text-right">
                      <button className="btn-icon" onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)} title="Download PDF"><Download size={18} /></button>
                      <button className="btn-icon text-danger" onClick={() => handleDelete(inv.id)} title="Delete"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="text-center text-muted">No invoices yet. Create your first invoice!</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={overlay}>
          <div style={{ ...modal, maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>New Invoice</h3>
              <button onClick={() => setShowModal(false)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Customer *</label>
                <select className="form-control" required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Select customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>)}
                </select>
                {customers.length === 0 && <small style={{ color: '#f59e0b' }}>No customers found — add a customer first.</small>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Invoice Date *</label>
                  <input className="form-control" type="date" required value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Due Date *</label>
                  <input className="form-control" type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Line Items *</label>
                {form.lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <input
                      className="form-control"
                      placeholder="Description"
                      required
                      value={line.description}
                      onChange={(e) => updateLine(idx, 'description', e.target.value)}
                      list={`items-list-${idx}`}
                    />
                    <datalist id={`items-list-${idx}`}>
                      {items.map((i) => <option key={i.id} value={i.name} />)}
                    </datalist>
                    <input className="form-control" type="number" min="1" placeholder="Qty" required value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} />
                    <input className="form-control" type="number" step="0.01" placeholder="Price" required value={line.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} />
                    {form.lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(idx)} style={{ ...closeBtn, color: '#ef4444' }}><X size={16} /></button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-outline" style={{ marginTop: 4 }} onClick={addLine}>+ Add Line</button>
              </div>

              <div style={{ textAlign: 'right', fontWeight: 600, marginBottom: 12 }}>
                Subtotal: {formatCurrency(subtotal)}
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, thank you note..." />
              </div>

              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Invoice'}</button>
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

export default Invoices;
