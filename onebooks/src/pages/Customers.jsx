import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Search, Trash2, X, Edit2, Camera } from 'lucide-react';
import Header from '../components/Header';
import AvatarUpload from '../components/AvatarUpload';
import { customerAPI, uploadAPI } from '../services/api';
import useCurrency from '../hooks/useCurrency';

const blank = { name: '', email: '', company_name: '', phone: '', address: '', avatar_url: '' };

const avatarColors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const avatarColor  = (name) => avatarColors[(name?.charCodeAt(0) || 0) % avatarColors.length];
const initials     = (name) => name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';

/* Avatar picker for the CREATE form (no entity ID yet) */
const NewAvatarPicker = ({ name, onFileSelected, preview }) => {
  const inputRef = useRef(null);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={(e) => onFileSelected(e.target.files?.[0] || null)} />
        <div style={{
          width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
          background: preview ? 'transparent' : avatarColor(name),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px dashed #cbd5e1',
          transition: 'filter 0.2s',
        }}>
          {preview
            ? <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: '#fff', fontWeight: 700, fontSize: 24 }}>{initials(name) || '+'}</span>
          }
        </div>
        <div style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 24, height: 24, borderRadius: '50%',
          background: '#3b82f6', border: '2px solid white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Camera size={12} color="white" />
        </div>
      </div>
    </div>
  );
};

const CustomerForm = ({ initial, onSave, onCancel, saving, error, isEdit }) => {
  const [form, setForm]         = useState(initial);
  const [avatarFile, setAvatarFile] = useState(null);
  const [preview, setPreview]   = useState(null);
  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleFileSelected = (file) => {
    setAvatarFile(file);
    if (file) setPreview(URL.createObjectURL(file));
    else setPreview(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form, avatarFile);
  };

  return (
    <form onSubmit={handleSubmit}>
      {isEdit ? (
        /* Edit mode — upload goes directly to DB via AvatarUpload */
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <AvatarUpload
            currentUrl={form.avatar_url}
            initials={initials(form.name)}
            bgColor={avatarColor(form.name)}
            type="customer"
            entityId={initial._id}
            size={80}
            onUploaded={(url) => setForm(f => ({ ...f, avatar_url: url }))}
          />
        </div>
      ) : (
        /* Create mode — collect file, upload after creation */
        <NewAvatarPicker name={form.name} onFileSelected={handleFileSelected} preview={preview} />
      )}

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
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null);
  const [editData, setEditData]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await customerAPI.getAll({ search });
      setCustomers(res.data.customers);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const closeModal = () => { setModal(null); setEditData(null); setError(''); };

  const handleCreate = async (form, avatarFile) => {
    setError(''); setSaving(true);
    try {
      const res = await customerAPI.create(form);
      // Upload avatar after we have the ID
      if (avatarFile) {
        const newId = res.data.customer?.id;
        if (newId) await uploadAPI.avatar(avatarFile, 'customer', newId);
      }
      closeModal(); fetchCustomers();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (form, _avatarFile) => {
    setError(''); setSaving(true);
    try { await customerAPI.update(form._id, form); closeModal(); fetchCustomers(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const openEdit = (c) => {
    setError('');
    setEditData({ _id: c.id, name: c.name, email: c.email, company_name: c.company_name || '', phone: c.phone || '', address: c.address || '', avatar_url: c.avatar_url || '' });
    setModal('edit');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    try { await customerAPI.delete(id); fetchCustomers(); } catch (err) { console.error(err); }
  };

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
              <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Total Invoiced</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</td></tr>
                ) : customers.length > 0 ? customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: avatarColor(c.name), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.avatar_url
                            ? <img src={c.avatar_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{initials(c.name)}</span>}
                        </div>
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
                      <button className="btn-icon" onClick={() => openEdit(c)}><Edit2 size={16} /></button>
                      <button className="btn-icon text-danger" onClick={() => handleDelete(c.id)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5"><div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>No customers yet</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Click "Add Customer" to get started</div>
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
            <CustomerForm
              initial={modal === 'edit' ? editData : blank}
              isEdit={modal === 'edit'}
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
const modalStyle   = { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
const closeBtn     = { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 };

export default Customers;
