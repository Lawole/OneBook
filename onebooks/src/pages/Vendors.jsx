import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import Header from '../components/Header';
import { vendorAPI } from '../services/api';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', company_name: '', phone: '', address: '' });

  const fetchVendors = useCallback(async () => {
    try {
      const response = await vendorAPI.getAll({ search });
      setVendors(response.data.vendors);
    } catch (err) {
      console.error('Error fetching vendors:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await vendorAPI.create(form);
      setShowModal(false);
      setForm({ name: '', email: '', company_name: '', phone: '', address: '' });
      fetchVendors();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vendor?')) return;
    try {
      await vendorAPI.delete(id);
      fetchVendors();
    } catch (err) {
      console.error('Error deleting vendor:', err);
    }
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} /> Add Vendor
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center">Loading...</td></tr>
                ) : vendors.length > 0 ? vendors.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.name}</td>
                    <td>{v.company_name || '-'}</td>
                    <td>{v.email}</td>
                    <td>{v.phone || '-'}</td>
                    <td className="text-right">
                      <button className="btn-icon text-danger" onClick={() => handleDelete(v.id)} title="Delete"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" className="text-center text-muted">No vendors yet. Add your first vendor!</td></tr>
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
              <h3 style={{ margin: 0 }}>Add Vendor</h3>
              <button onClick={() => setShowModal(false)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Full Name *</label>
                <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input className="form-control" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@supplier.com" />
              </div>
              <div className="form-group">
                <label>Company Name</label>
                <input className="form-control" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Supplier Co." />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 234 567 8900" />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea className="form-control" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Supplier St, City" />
              </div>
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Vendor'}</button>
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

export default Vendors;
