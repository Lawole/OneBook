import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Download, Trash2, X } from 'lucide-react';
import Header from '../components/Header';
import { creditNoteAPI, customerAPI, invoiceAPI } from '../services/api';
import { formatCurrency, formatDate, downloadFile } from '../utils/helpers';

const STATUS_COLORS = {
  draft:  { bg: '#f1f5f9', color: '#475569' },
  issued: { bg: '#dbeafe', color: '#1e40af' },
  applied:{ bg: '#d1fae5', color: '#065f46' },
  void:   { bg: '#fee2e2', color: '#991b1b' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft'}
    </span>
  );
};

const blankItem = () => ({ description: '', quantity: 1, unit_price: '' });

const CreditNoteForm = ({ onSave, onCancel, saving, error }) => {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({
    customer_id: '',
    invoice_id: '',
    credit_date: new Date().toISOString().split('T')[0],
    reason: '',
    tax_rate: 0,
    items: [blankItem()],
  });

  useEffect(() => {
    customerAPI.getAll({ per_page: 200 }).then(r => setCustomers(r.data.customers || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.customer_id) { setInvoices([]); return; }
    invoiceAPI.getAll({ per_page: 200 }).then(r => {
      setInvoices((r.data.invoices || []).filter(inv => String(inv.customer_id) === String(form.customer_id)));
    }).catch(() => {});
  }, [form.customer_id]);

  const setField = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const setItem = (i, field) => (e) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: e.target.value };
    setForm({ ...form, items });
  };

  const addItem = () => setForm({ ...form, items: [...form.items, blankItem()] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  const subtotal = form.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const tax = subtotal * ((parseFloat(form.tax_rate) || 0) / 100);
  const total = subtotal + tax;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      items: form.items.map(it => ({
        description: it.description,
        quantity: parseFloat(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
      })),
      tax_rate: parseFloat(form.tax_rate) || 0,
      invoice_id: form.invoice_id || null,
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: '40px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 660, boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New Credit Note</h3>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Customer *</label>
              <select className="form-control" required value={form.customer_id} onChange={setField('customer_id')}>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Credit Date *</label>
              <input type="date" className="form-control" required value={form.credit_date} onChange={setField('credit_date')} />
            </div>
            <div className="form-group">
              <label>Related Invoice (optional)</label>
              <select className="form-control" value={form.invoice_id} onChange={setField('invoice_id')}>
                <option value="">None</option>
                {invoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {formatCurrency(inv.total_amount)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Tax Rate (%)</label>
              <input type="number" className="form-control" min="0" max="100" step="0.01" value={form.tax_rate} onChange={setField('tax_rate')} />
            </div>
          </div>
          <div className="form-group">
            <label>Reason</label>
            <textarea className="form-control" rows={2} value={form.reason} onChange={setField('reason')} placeholder="Reason for credit note..." />
          </div>

          {/* Line items */}
          <div style={{ marginTop: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#334155', marginBottom: 8 }}>Line Items</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Description</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Qty</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Unit Price</span>
              <span />
            </div>
            {form.items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px 36px', gap: 8, marginBottom: 8 }}>
                <input className="form-control" required value={item.description} onChange={setItem(i, 'description')} placeholder="Item description" />
                <input className="form-control" type="number" min="1" value={item.quantity} onChange={setItem(i, 'quantity')} />
                <input className="form-control" type="number" min="0" step="0.01" required value={item.unit_price} onChange={setItem(i, 'unit_price')} placeholder="0.00" />
                <button type="button" onClick={() => removeItem(i)} disabled={form.items.length === 1}
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addItem} style={{ fontSize: 13, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              + Add Line Item
            </button>
          </div>

          {/* Totals */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
              <span style={{ color: '#64748b' }}>Subtotal</span>
              <span style={{ fontWeight: 500 }}>{formatCurrency(subtotal)}</span>
            </div>
            {tax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                <span style={{ color: '#64748b' }}>Tax ({form.tax_rate}%)</span>
                <span style={{ fontWeight: 500 }}>{formatCurrency(tax)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: 8, fontSize: 15 }}>
              <span style={{ fontWeight: 700 }}>Total Credit</span>
              <span style={{ fontWeight: 700, color: '#4f46e5' }}>{formatCurrency(total)}</span>
            </div>
          </div>

          {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Credit Note'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CreditNotes = () => {
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await creditNoteAPI.getAll({ per_page: 100 });
      setCreditNotes(res.data.credit_notes || []);
    } catch {
      setCreditNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form) => {
    setSaving(true); setSaveError('');
    try {
      await creditNoteAPI.create(form);
      setShowModal(false);
      load();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to create credit note');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this credit note?')) return;
    try { await creditNoteAPI.delete(id); load(); } catch { alert('Failed to delete'); }
  };

  const handlePDF = async (id, num) => {
    try {
      const res = await creditNoteAPI.downloadPDF(id);
      downloadFile(res.data, `credit_note_${num}.pdf`);
    } catch { alert('Failed to download PDF'); }
  };

  const filtered = creditNotes.filter(cn =>
    (cn.credit_note_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (cn.customer_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <Header title="Credit Notes" subtitle="Manage credit notes issued to customers" />
      <div className="page-content">
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
              <Search size={18} />
              <input
                type="text"
                placeholder="Search credit notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <button className="btn btn-primary" onClick={() => { setShowModal(true); setSaveError(''); }}>
              <Plus size={18} /> New Credit Note
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Credit Note #</th>
                  <th>Customer</th>
                  <th>Related Invoice</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '48px' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                      <div style={{ color: '#64748b', fontWeight: 500 }}>No credit notes yet</div>
                      <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Click "New Credit Note" to create one</div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(cn => (
                    <tr key={cn.id}>
                      <td><span style={{ fontWeight: 600, color: '#4f46e5' }}>{cn.credit_note_number}</span></td>
                      <td>{cn.customer_name}</td>
                      <td>{cn.invoice_number || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                      <td>{cn.credit_date ? formatDate(cn.credit_date) : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(cn.total_amount)}</td>
                      <td><StatusBadge status={cn.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}
                            onClick={() => handlePDF(cn.id, cn.credit_note_number)} title="Download PDF">
                            <Download size={14} />
                          </button>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12, color: '#ef4444', borderColor: '#fca5a5' }}
                            onClick={() => handleDelete(cn.id)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', fontSize: 13, color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
              <span>{filtered.length} credit note{filtered.length !== 1 ? 's' : ''}</span>
              <span style={{ fontWeight: 600 }}>Total: {formatCurrency(filtered.reduce((s, cn) => s + (cn.total_amount || 0), 0))}</span>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreditNoteForm onSave={handleCreate} onCancel={() => setShowModal(false)} saving={saving} error={saveError} />
      )}
    </div>
  );
};

export default CreditNotes;
