import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, X, Edit2 } from 'lucide-react';
import Header from '../components/Header';
import { customerAPI } from '../services/api';
import useCurrency from '../hooks/useCurrency';

const blank = { name: '', email: '', company_name: '', phone: '', address: '' };

const CustomerForm = ({ initial, onSave, onCancel, saving, error }) => {
  const [form, setForm] = useState(initial);
  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Full Name *</label><input className="form-control" required value={form.name} onChange={f('name')} placeholder="John Doe" /></div>
      <div className="form-group"><label>Email *</label><input className="form-control" type="email" required value={form.email} onChange={f('email')} placeholder="john@example.com" /></div>
      <div className="form-group"><label>Company Name</label><input className="form-control" value={form.company_name} onChange={f('company_name')} placeholder="Acme Ltd" /></div>
      <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone} onChange={f('phone')} placeholder="+1 234 567 8900" /></div>
      <div className="form-group"><label>Address</label><textarea className="form-control" rows={2} value={form.address} onChange={f('address')} placeholder="123 Main St, City" /></div>
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Customer'}</button>
      </div>
    </form>
  );
};

const Customers = () => {
  const { fmt } = useCurrency();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await customerAPI.getAll({ search });
      setCustomers(response.data.customers);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const closeModal = () => { setModal(null); setEditData(null); setError(''); };

  const handleCreate = async (form) => {
    setError(''); setSaving(true);
    try { await customerAPI.create(form); closeModal(); fetchCustomers(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setError(''); setSaving(true);
    try { await customerAPI.update(form._id, form); closeModal(); fetchCustomers(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const openEdit = (c) => {
    setError('');
    setEditData({ _id: c.id, name: c.name, email: c.email, company_name: c.company_name || '', phone: c.phone || '', address: c.address || '' });
    setModal('edit');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    try { await customerAPI.delete(id); fetchCustomers(); } catch (err) { console.error(err); }
  };

  const initials = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  const avatarColor = (name) => { const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899']; return colors[name?.charCodeAt(0) % colors.length] || '#3b82f6'; };

  return (
    <div className="page">
      <Header title="Customers" subtitle="Manage your customer database" />
      <div className="page-content">
        <div className="page-actions">
          <div className="search-box">
            <Search size={20} />
            <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => { setError(''); setModal('create'); }}><Plus size={20} /> Add Customer</button>
        </div>

        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th><th>Email</th><th>Phone</th><th>Total Invoiced</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading customers...</td></tr>
                ) : customers.length > 0 ? customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(c.name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{initials(c.name)}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.name}</div>
                          {c.company_name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{c.company_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#64748b' }}>{c.email}</td>
                    <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{c.phone || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(c.total_invoiced || 0)}</td>
                    <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon" onClick={() => openEdit(c)} title="Edit"><Edit2 size={16} /></button>
                      <button className="btn-icon text-danger" onClick={() => handleDelete(c.id)} title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5"><div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>No customers yet</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Click "Add Customer" to add your first customer</div>
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          {customers.length > 0 && (
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>{customers.length} customer{customers.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>{modal === 'edit' ? 'Edit Customer' : 'Add Customer'}</h3>
              <button onClick={closeModal} style={closeBtn}><X size={20} /></button>
            </div>
            <CustomerForm initial={modal === 'edit' ? editData : blank} onSave={modal === 'edit' ? handleEdit : handleCreate} onCancel={closeModal} saving={saving} error={error} />
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

export default Customers;
