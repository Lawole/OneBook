import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import Header from '../components/Header';
import { itemAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';

const Items = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', sku: '', category: '', unit_price: '', quantity_on_hand: '', reorder_level: '' });

  const fetchItems = useCallback(async () => {
    try {
      const response = await itemAPI.getAll({ search });
      setItems(response.data.items);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await itemAPI.create(form);
      setShowModal(false);
      setForm({ name: '', description: '', sku: '', category: '', unit_price: '', quantity_on_hand: '', reorder_level: '' });
      fetchItems();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await itemAPI.delete(id);
      fetchItems();
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  return (
    <div className="page">
      <Header title="Items" subtitle="Manage your product and service catalog" />

      <div className="page-content">
        <div className="page-actions">
          <div className="search-box">
            <Search size={20} />
            <input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={20} /> Add Item
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>SKU</th><th>Category</th><th>Unit Price</th><th>Qty on Hand</th><th>Reorder Level</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center">Loading...</td></tr>
                ) : items.length > 0 ? items.map((item) => (
                  <tr key={item.id}>
                    <td className="font-medium">{item.name}</td>
                    <td>{item.sku || '-'}</td>
                    <td>{item.category || '-'}</td>
                    <td>{formatCurrency(item.unit_price)}</td>
                    <td>
                      <span className={item.quantity_on_hand <= item.reorder_level ? 'text-danger' : ''}>
                        {item.quantity_on_hand}
                      </span>
                    </td>
                    <td>{item.reorder_level}</td>
                    <td className="text-right">
                      <button className="btn-icon text-danger" onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="text-center text-muted">No items yet. Add your first item!</td></tr>
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
              <h3 style={{ margin: 0 }}>Add Item</h3>
              <button onClick={() => setShowModal(false)} style={closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label>Item Name *</label>
                <input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Web Design Service" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>SKU</label>
                  <input className="form-control" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU-001" />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Service" />
                </div>
                <div className="form-group">
                  <label>Unit Price *</label>
                  <input className="form-control" type="number" step="0.01" required value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} placeholder="0.00" />
                </div>
                <div className="form-group">
                  <label>Qty on Hand</label>
                  <input className="form-control" type="number" value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Reorder Level</label>
                  <input className="form-control" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder="0" />
                </div>
              </div>
              {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Add Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 };

export default Items;
