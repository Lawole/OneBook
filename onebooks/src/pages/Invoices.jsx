import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Download, Trash2, X, Edit2, Send, CheckCircle, Palette } from 'lucide-react';
import Header from '../components/Header';
import { invoiceAPI, customerAPI, itemAPI } from '../services/api';
import { formatDate, downloadFile } from '../utils/helpers';
import useCurrency from '../hooks/useCurrency';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUSES = [
  { value: 'draft',   label: 'Draft',   color: '#6b7280' },
  { value: 'sent',    label: 'Sent',    color: '#3b82f6' },
  { value: 'unpaid',  label: 'Unpaid',  color: '#f59e0b' },
  { value: 'paid',    label: 'Paid',    color: '#10b981' },
  { value: 'overdue', label: 'Overdue', color: '#ef4444' },
];

const TEMPLATES = [
  { value: 'classic',  label: 'Classic',  desc: 'Clean & professional', accent: '#3b82f6' },
  { value: 'modern',   label: 'Modern',   desc: 'Dark header with purple', accent: '#6366f1' },
  { value: 'minimal',  label: 'Minimal',  desc: 'Simple & lightweight', accent: '#111827' },
  { value: 'bold',     label: 'Bold',     desc: 'Strong amber accents', accent: '#f59e0b' },
  { value: 'elegant',  label: 'Elegant',  desc: 'Gold & warm tones', accent: '#b45309' },
];

const emptyLine = { description: '', quantity: 1, unit_price: '' };

const TotalsPanel = ({ subtotal, discountPercent, vatRate, fmt }) => {
  const discountAmt = subtotal * (parseFloat(discountPercent) || 0) / 100;
  const afterDiscount = subtotal - discountAmt;
  const vatAmt = afterDiscount * (parseFloat(vatRate) || 0) / 100;
  const total = afterDiscount + vatAmt;

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
        <span>Subtotal</span><span>{fmt(subtotal)}</span>
      </div>
      {discountPercent > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ef4444', marginBottom: 4 }}>
          <span>Discount ({discountPercent}%)</span><span>− {fmt(discountAmt)}</span>
        </div>
      )}
      {vatRate > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
          <span>VAT ({vatRate}%)</span><span>+ {fmt(vatAmt)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
        <span>Total</span><span>{fmt(total)}</span>
      </div>
    </div>
  );
};

const StatusBadge = ({ status, invoiceId, onChanged }) => {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [updating, setUpdating] = useState(false);
  const badgeRef = useRef(null);
  const current = STATUSES.find((s) => s.value === status) || STATUSES[0];

  const handleOpen = () => {
    if (badgeRef.current) {
      const rect = badgeRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen(!open);
  };

  const update = async (newStatus) => {
    setOpen(false);
    setUpdating(true);
    try {
      await invoiceAPI.update(invoiceId, { status: newStatus });
      onChanged();
    } catch (err) {
      console.error('Status update failed', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <span
        ref={badgeRef}
        onClick={handleOpen}
        style={{ background: current.color + '20', color: current.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${current.color}40`, whiteSpace: 'nowrap' }}
        title="Click to change status"
      >
        {updating ? '...' : current.label} ▾
      </span>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 1000, minWidth: 130, overflow: 'hidden' }}>
            {STATUSES.map((s) => (
              <div
                key={s.value}
                onClick={() => update(s.value)}
                style={{ padding: '9px 16px', cursor: 'pointer', fontSize: 13, color: s.color, fontWeight: 600, background: s.value === status ? s.color + '18' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = s.color + '18'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = s.value === status ? s.color + '18' : 'transparent'; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                {s.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const InvoiceForm = ({ initial, customers, items, fmt, defaultVatRate, onSave, onCancel, saving, error }) => {
  const [form, setForm] = useState(initial);
  const [discountPercent, setDiscountPercent] = useState(initial.discount_percent ?? 0);
  const [vatRate, setVatRate] = useState(initial.vat_rate ?? defaultVatRate ?? 0);

  const subtotal = form.lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unit_price) || 0), 0);

  const updateLine = (idx, field, value) => {
    const lines = [...form.lines];
    lines[idx] = { ...lines[idx], [field]: value };
    if (field === 'description') {
      const matched = items.find((i) => i.name === value);
      if (matched) lines[idx].unit_price = matched.unit_price;
    }
    setForm({ ...form, lines });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, discount_percent: parseFloat(discountPercent) || 0, vat_rate: parseFloat(vatRate) || 0 });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Customer *</label>
        <select className="form-control" required value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
          <option value="">Select customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` (${c.company_name})` : ''}</option>)}
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
            <input className="form-control" placeholder="Description" required value={line.description}
              onChange={(e) => updateLine(idx, 'description', e.target.value)} list={`items-list-${idx}`} />
            <datalist id={`items-list-${idx}`}>{items.map((i) => <option key={i.id} value={i.name} />)}</datalist>
            <input className="form-control" type="number" min="1" placeholder="Qty" required value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', e.target.value)} />
            <input className="form-control" type="number" step="0.01" placeholder="Price" required value={line.unit_price} onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} />
            {form.lines.length > 1 && (
              <button type="button" onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) })} style={closeBtn}><X size={16} /></button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn-outline" style={{ marginTop: 4 }} onClick={() => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] })}>+ Add Line</button>
      </div>

      {/* Discount & VAT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 13 }}>Discount (%)</label>
          <input className="form-control" type="number" min="0" max="100" step="0.1" placeholder="0" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 13 }}>VAT / Tax Rate (%)</label>
          <input className="form-control" type="number" min="0" step="0.1" placeholder="0" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
        </div>
      </div>

      <TotalsPanel subtotal={subtotal} discountPercent={discountPercent} vatRate={vatRate} fmt={fmt} />

      <div className="form-group">
        <label>Notes</label>
        <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Payment terms, thank you note..." />
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Invoice'}</button>
      </div>
    </form>
  );
};

// ── Template Preview Thumbnail ────────────────────────────────
const TemplatePreview = ({ template }) => {
  const t = template;
  const styles = {
    classic: {
      header: { background: '#fff', borderBottom: '2px solid #3b82f6', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
      title: { color: '#3b82f6', fontSize: 11, fontWeight: 800 },
      company: { fontSize: 7, color: '#1e293b', fontWeight: 700 },
      tableHead: { background: '#f8fafc' },
      total: { background: '#1e293b', color: '#fff' },
    },
    modern: {
      header: { background: '#0f172a', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderTop: '3px solid #6366f1' },
      title: { color: '#818cf8', fontSize: 9, fontWeight: 800 },
      company: { fontSize: 7, color: '#fff', fontWeight: 700 },
      tableHead: { background: '#6366f1' },
      total: { background: '#0f172a', color: '#fff' },
    },
    minimal: {
      header: { background: '#fff', borderBottom: '2px solid #111827', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
      title: { color: '#9ca3af', fontSize: 7, fontWeight: 700, letterSpacing: 1 },
      company: { fontSize: 9, color: '#111827', fontWeight: 800 },
      tableHead: { background: '#fff', borderBottom: '1px solid #d1d5db' },
      total: { background: '#fff', color: '#111827', borderTop: '2px solid #111827' },
    },
    bold: {
      header: { background: '#fff', padding: '8px 10px 8px 14px', borderLeft: '4px solid #f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
      title: { color: '#1c1917', fontSize: 11, fontWeight: 900, letterSpacing: -0.5 },
      company: { fontSize: 7, color: '#78716c' },
      tableHead: { background: '#1c1917' },
      total: { background: '#f59e0b', color: '#1c1917' },
    },
    elegant: {
      header: { background: '#fff', borderTop: '3px solid #b45309', borderBottom: '1px solid #fde68a', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
      title: { color: '#b45309', fontSize: 11, fontWeight: 800 },
      company: { fontSize: 7, color: '#1c1917', fontWeight: 700 },
      tableHead: { background: '#fff', borderBottom: '1px solid #fde68a' },
      total: { background: '#b45309', color: '#fef3c7' },
    },
  };
  const s = styles[t.value] || styles.classic;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden', fontSize: 7, fontFamily: 'Arial, sans-serif', height: 130, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.company}>ACME Corp</div>
          <div style={{ fontSize: 6, color: '#94a3b8', marginTop: 1 }}>123 Business St</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={s.title}>INVOICE</div>
          <div style={{ fontSize: 6, color: '#94a3b8' }}>#INV-0001</div>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '5px 8px', flex: 1 }}>
        <div style={{ fontSize: 6, color: '#94a3b8', marginBottom: 2 }}>BILL TO</div>
        <div style={{ fontSize: 7, color: '#1e293b', fontWeight: 600, marginBottom: 6 }}>John Smith</div>
        {/* Table */}
        <div style={{ ...s.tableHead, display: 'flex', justifyContent: 'space-between', padding: '3px 4px', marginBottom: 1 }}>
          <span style={{ fontSize: 6, color: t.value === 'modern' ? '#fff' : t.value === 'bold' ? '#fef3c7' : '#94a3b8', fontWeight: 700 }}>DESCRIPTION</span>
          <span style={{ fontSize: 6, color: t.value === 'modern' ? '#fff' : t.value === 'bold' ? '#fef3c7' : '#94a3b8', fontWeight: 700 }}>TOTAL</span>
        </div>
        {[['Web Design', '$800'], ['Hosting', '$120']].map(([desc, amt]) => (
          <div key={desc} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px', borderBottom: '0.5px solid #f1f5f9' }}>
            <span style={{ fontSize: 6, color: '#374151' }}>{desc}</span>
            <span style={{ fontSize: 6, color: '#374151' }}>{amt}</span>
          </div>
        ))}
      </div>
      {/* Total bar */}
      <div style={{ ...s.total, display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
        <span style={{ fontSize: 7, fontWeight: 700 }}>TOTAL</span>
        <span style={{ fontSize: 7, fontWeight: 800 }}>$920.00</span>
      </div>
    </div>
  );
};

// ── Template Picker Modal ─────────────────────────────────────
const TemplatePicker = ({ current, onSelect, onClose }) => (
  <div style={overlayStyle}>
    <div style={{ ...modalStyle, maxWidth: 620 }}>
      <div style={modalHeader}>
        <h3 style={{ margin: 0 }}>Choose Invoice Template</h3>
        <button onClick={onClose} style={closeBtn}><X size={20} /></button>
      </div>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, marginTop: -8 }}>
        Preview each template below. Your selection is saved and used for all PDF downloads and email attachments.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {TEMPLATES.map((t) => (
          <div
            key={t.value}
            onClick={() => onSelect(t.value)}
            style={{
              border: `2px solid ${current === t.value ? t.accent : '#e5e7eb'}`,
              borderRadius: 10,
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: current === t.value ? `0 0 0 3px ${t.accent}30` : 'none',
            }}
          >
            <TemplatePreview template={t} />
            <div style={{ padding: '10px 12px', background: current === t.value ? t.accent + '0d' : '#fafafa', borderTop: `1px solid ${current === t.value ? t.accent + '30' : '#f1f5f9'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{t.label}</span>
                {current === t.value && (
                  <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, background: t.accent + '18', padding: '2px 8px', borderRadius: 20 }}>✓ Active</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const Invoices = () => {
  const { fmt } = useCurrency();
  const { user } = useAuth();
  const defaultVatRate = user?.tax_rate ?? 0;
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sendMsg, setSendMsg] = useState('');
  const [currentTemplate, setCurrentTemplate] = useState(user?.invoice_template || 'classic');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // modal: null | 'create' | 'edit'
  const [modal, setModal] = useState(null);
  const [editInvoice, setEditInvoice] = useState(null);

  const blankForm = { customer_id: '', invoice_date: new Date().toISOString().split('T')[0], due_date: '', notes: '', lines: [{ ...emptyLine }], discount_percent: 0, vat_rate: defaultVatRate };

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

  const loadCustomersAndItems = async () => {
    try {
      const [custRes, itemRes] = await Promise.all([customerAPI.getAll({ per_page: 100 }), itemAPI.getAll({ per_page: 100 })]);
      setCustomers(custRes.data.customers || []);
      setItems(itemRes.data.items || []);
    } catch (err) { console.error(err); }
  };

  const openCreate = async () => {
    await loadCustomersAndItems();
    setError('');
    setModal('create');
  };

  const openEdit = async (inv) => {
    await loadCustomersAndItems();
    setError('');
    setEditInvoice({
      customer_id: String(inv.customer_id),
      invoice_date: inv.invoice_date?.split('T')[0] || '',
      due_date: inv.due_date?.split('T')[0] || '',
      notes: inv.notes || '',
      lines: inv.items?.length
        ? inv.items.map((i) => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price }))
        : [{ ...emptyLine }],
      discount_percent: inv.discount_percent ?? 0,
      vat_rate: inv.vat_rate ?? defaultVatRate,
      _id: inv.id,
    });
    setModal('edit');
  };

  const handleCreate = async (form) => {
    setError('');
    setSaving(true);
    try {
      await invoiceAPI.create({ customer_id: form.customer_id, invoice_date: form.invoice_date, due_date: form.due_date, notes: form.notes, discount_percent: form.discount_percent, vat_rate: form.vat_rate, items: form.lines.map((l) => ({ description: l.description, quantity: parseInt(l.quantity), unit_price: parseFloat(l.unit_price) })) });
      setModal(null);
      fetchInvoices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form) => {
    setError('');
    setSaving(true);
    try {
      await invoiceAPI.update(form._id, { customer_id: form.customer_id, invoice_date: form.invoice_date, due_date: form.due_date, notes: form.notes, discount_percent: form.discount_percent, vat_rate: form.vat_rate, items: form.lines.map((l) => ({ description: l.description, quantity: parseInt(l.quantity), unit_price: parseFloat(l.unit_price) })) });
      setModal(null);
      fetchInvoices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async (id, invoiceNumber) => {
    try {
      const response = await invoiceAPI.downloadPDF(id);
      downloadFile(response.data, `invoice_${invoiceNumber}.pdf`);
    } catch (err) { console.error(err); }
  };

  const handleSendEmail = async (inv) => {
    if (!window.confirm(`Send invoice ${inv.invoice_number} to ${inv.customer_name} via email?`)) return;
    setSendingId(inv.id);
    setSendMsg('');
    try {
      await invoiceAPI.sendEmail(inv.id);
      setSendMsg(`Invoice ${inv.invoice_number} sent successfully!`);
      fetchInvoices();
    } catch (err) {
      setSendMsg(err.response?.data?.message || 'Failed to send invoice');
    } finally {
      setSendingId(null);
      setTimeout(() => setSendMsg(''), 4000);
    }
  };

  const handleMarkPaid = async (inv) => {
    if (!window.confirm(`Mark invoice ${inv.invoice_number} as paid?`)) return;
    try {
      await invoiceAPI.update(inv.id, { status: 'paid' });
      fetchInvoices();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try { await invoiceAPI.delete(id); fetchInvoices(); } catch (err) { console.error(err); }
  };

  const handleSelectTemplate = async (tpl) => {
    setCurrentTemplate(tpl);
    setShowTemplatePicker(false);
    try {
      await api.put('/company', { invoice_template: tpl });
    } catch (err) { console.error('Could not save template preference', err); }
  };

  const closeModal = () => { setModal(null); setEditInvoice(null); setError(''); };

  return (
    <div className="page">
      <Header title="Invoices" subtitle="Manage your sales invoices" />

      <div className="page-content">
        {sendMsg && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 12,
            background: sendMsg.includes('success') ? '#d1fae5' : '#fee2e2',
            color: sendMsg.includes('success') ? '#065f46' : '#991b1b',
            fontSize: 13, fontWeight: 600,
          }}>
            {sendMsg}
          </div>
        )}

        <div className="page-actions">
          <div className="filters">
            <div className="search-box">
              <Search size={20} />
              <input type="text" placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 150 }}>
              <option value="">All Status</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-outline"
              onClick={() => setShowTemplatePicker(true)}
              title="Choose invoice template"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Palette size={16} />
              Template: <strong style={{ textTransform: 'capitalize' }}>{currentTemplate}</strong>
            </button>
            <button className="btn btn-primary" onClick={openCreate}><Plus size={20} /> New Invoice</button>
          </div>
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
                    <td>{fmt(inv.total_amount)}</td>
                    <td>
                      <StatusBadge status={inv.status} invoiceId={inv.id} onChanged={fetchInvoices} />
                    </td>
                    <td className="text-right">
                      <button className="btn-icon" onClick={() => openEdit(inv)} title="Edit"><Edit2 size={18} /></button>
                      <button className="btn-icon" onClick={() => handleDownloadPDF(inv.id, inv.invoice_number)} title="Download PDF"><Download size={18} /></button>
                      {inv.status !== 'paid' && (
                        <button
                          className="btn-icon"
                          onClick={() => handleSendEmail(inv)}
                          disabled={sendingId === inv.id}
                          title="Send via email"
                          style={{ color: '#3b82f6' }}
                        >
                          {sendingId === inv.id ? <span style={{ fontSize: 11 }}>...</span> : <Send size={18} />}
                        </button>
                      )}
                      {inv.status !== 'paid' && (
                        <button
                          className="btn-icon"
                          onClick={() => handleMarkPaid(inv)}
                          title="Mark as paid"
                          style={{ color: '#10b981' }}
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}
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

      {/* Template Picker */}
      {showTemplatePicker && (
        <TemplatePicker
          current={currentTemplate}
          onSelect={handleSelectTemplate}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}

      {/* Create Modal */}
      {modal === 'create' && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 640 }}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>New Invoice</h3>
              <button onClick={closeModal} style={closeBtn}><X size={20} /></button>
            </div>
            <InvoiceForm initial={blankForm} customers={customers} items={items} fmt={fmt} defaultVatRate={defaultVatRate} onSave={handleCreate} onCancel={closeModal} saving={saving} error={error} />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {modal === 'edit' && editInvoice && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, maxWidth: 640 }}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>Edit Invoice</h3>
              <button onClick={closeModal} style={closeBtn}><X size={20} /></button>
            </div>
            <InvoiceForm initial={editInvoice} customers={customers} items={items} fmt={fmt} defaultVatRate={defaultVatRate} onSave={handleEdit} onCancel={closeModal} saving={saving} error={error} />
          </div>
        </div>
      )}
    </div>
  );
};

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 };

export default Invoices;
