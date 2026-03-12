import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, X, Edit2 } from 'lucide-react';
import Header from '../components/Header';
import AvatarUpload from '../components/AvatarUpload';
import { vendorAPI } from '../services/api';

const blank = { name: '', email: '', company_name: '', phone: '', address: '', avatar_url: '' };

const avatarColors = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#ec4899'];
const avatarColor = (name) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length];
const initials = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

const VendorForm = ({ initial, onSave, onCancel, saving, error }) => {
  const [form, setForm] = useState(initial);
  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      {initial._id && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <AvatarUpload
            currentUrl={form.avatar_url}
            initials={initials(form.name)}
            bgColor={avatarColor(form.name)}
            type="vendor"
            entityId={initial._id}
            size={80}
            onUploaded={(url) => setForm(f => ({ ...f, avatar_url: url }))}
          />
        </div>
      )}

      <div className="form-group"><label>Full Name *</label><input className="form-control" required value={form.name} onChange={f('name')} placeholder="Jane Smith" /></div>
      <div className="form-group"><label>Email *</label><input className="form-control" type="email" required value={form.email} onChange={f('email')} placeholder="jane@supplier.com" /></div>
      <div className="form-group"><label>Company Name</label><input className="form-control" value={form.company_name} onChange={f('company_name')} placeholder="Supplier Co." /></div>
      <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone} onChange={f('phone')} placeholder="+1 234 567 8900" /></div>
      <div className="form-group"><label>Address</label><textarea className="form-control" rows={2} value={form.address} onChange={f('address')} placeholder="123 Supplier St, City" /></div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Vendor'}</button>
      </div>
    </form>
  );
};

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchVendors = useCallback(async () => {
    try {
      const response = await vendorAPI.getAll({ search });
      setVendors(response.data.vendors);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const closeModal = () => { setModal(null); setEditData(null); setError(''); };

  const handleCreate = async (form) => {
    setError(''); setSaving(true);
    try { await vendorAPI.create(form); closeModal(); fetchVendors(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setError(''); setSaving(true);
    try { await vendorAPI.update(form._id, form); closeModal(); fetchVendors(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const openEdit = (v) => {
    setError('');
    setEditData({ _id: v.id, name: v.name, email: v.email, company_name: v.company_name || '', phone: v.phone || '', address: v.address || '', avatar_url: v.avatar_url || '' });
    setModal('edit');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vendor?')) return;
    try { await vendorAPI.delete(id); fetchVendors(); } catch (err) { console.error(err); }
  };

  return (
    <div className="page">
      <Header title="Vendors" subtitle="Manage your supplier database" />
      <div className="page-content">
        <div className="page-actions">
          <div className="search-box">
            <Search size={20} />
            <input type="text" placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => { setError(''); setModal('create'); }}><Plus size={20} /> Add Vendor</button>
        </div>

        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th><th>Email</th><th>Phone</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading vendors...</td></tr>
                ) : vendors.length > 0 ? vendors.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: avatarColor(v.name), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {v.avatar_url
                            ? <img src={v.avatar_url} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{initials(v.name)}</span>
                          }
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{v.name}</div>
                          {v.company_name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{v.company_name}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#64748b' }}>{v.email}</td>
                    <td style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{v.phone || '—'}</td>
                    <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-icon" onClick={() => openEdit(v)} title="Edit"><Edit2 size={16} /></button>
                      <button className="btn-icon text-danger" onClick={() => handleDelete(v.id)} title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="4"><div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>No vendors yet</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Click "Add Vendor" to get started</div>
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          {vendors.length > 0 && (
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>{vendors.length} vendor{vendors.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>{modal === 'edit' ? 'Edit Vendor' : 'Add Vendor'}</h3>
              <button onClick={closeModal} style={closeBtn}><X size={20} /></button>
            </div>
            <VendorForm
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

export default Vendors;
