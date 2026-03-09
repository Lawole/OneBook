import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, X, Edit2, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import { itemAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';

const blank = { name: '', description: '', sku: '', category: '', unit_price: '', quantity_on_hand: '0', reorder_level: '0' };

const ItemForm = ({ initial, onSave, onCancel, saving, error }) => {
  const [form, setForm] = useState(initial);
  const f = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <div className="form-group"><label>Item Name *</label><input className="form-control" required value={form.name} onChange={f('name')} placeholder="Web Design Service" /></div>
      <div className="form-group"><label>Description</label><textarea className="form-control" rows={2} value={form.description} onChange={f('description')} placeholder="Short description..." /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="form-group"><label>SKU</label><input className="form-control" value={form.sku} onChange={f('sku')} placeholder="SKU-001" /></div>
        <div className="form-group"><label>Category</label><input className="form-control" value={form.category} onChange={f('category')} placeholder="Service" /></div>
        <div className="form-group"><label>Unit Price *</label><input className="form-control" type="number" step="0.01" required value={form.unit_price} onChange={f('unit_price')} placeholder="0.00" /></div>
        <div className="form-group"><label>Qty on Hand</label><input className="form-control" type="number" value={form.quantity_on_hand} onChange={f('quantity_on_hand')} placeholder="0" /></div>
        <div className="form-group"><label>Reorder Level</label><input className="form-control" type="number" value={form.reorder_level} onChange={f('reorder_level')} placeholder="0" /></div>
      </div>
      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Item'}</button>
      </div>
    </form>
  );
};

const Items = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = useCallback(async () => {
    try {
      const response = await itemAPI.getAll({ search });
      setItems(response.data.items);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const closeModal = () => { setModal(null); setEditData(null); setError(''); };

  const handleCreate = async (form) => {
    setError(''); setSaving(true);
    try { await itemAPI.create(form); closeModal(); fetchItems(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setError(''); setSaving(true);
    try { await itemAPI.update(form._id, form); closeModal(); fetchItems(); }
    catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const openEdit = (item) => {
    setError('');
    setEditData({ _id: item.id, name: item.name, description: item.description || '', sku: item.sku || '', category: item.category || '', unit_price: item.unit_price, quantity_on_hand: item.quantity_on_hand, reorder_level: item.reorder_level });
    setModal('edit');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    try { await itemAPI.delete(id); fetchItems(); } catch (err) { console.error(err); }
  };

  const lowStock = items.filter((i) => i.quantity_on_hand <= i.reorder_level).length;

  return (
    <div className="page">
      <Header title="Items" subtitle="Manage your product and service catalog" />
      <div className="page-content">
        {lowStock > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#92400e' }}>
            <AlertTriangle size={18} />
            <span><strong>{lowStock} item{lowStock > 1 ? 's' : ''}</strong> at or below reorder level</span>
          </div>
        )}
        <div className="page-actions">
          <div className="search-box">
            <Search size={20} />
            <input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => { setError(''); setModal('create'); }}><Plus size={20} /> Add Item</button>
        </div>

        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>SKU</th><th>Category</th><th>Unit Price</th><th>Stock</th><th>Reorder</th><th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading items...</td></tr>
                ) : items.length > 0 ? items.map((item) => {
                  const isLow = item.quantity_on_hand <= item.reorder_level;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{item.description}</div>}
                      </td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748b' }}>{item.sku || '—'}</span></td>
                      <td>{item.category ? <span className="badge badge-secondary">{item.category}</span> : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(item.unit_price)}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: isLow ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isLow && <AlertTriangle size={14} />}{item.quantity_on_hand}
                        </span>
                      </td>
                      <td style={{ color: '#64748b' }}>{item.reorder_level}</td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-icon" onClick={() => openEdit(item)} title="Edit"><Edit2 size={16} /></button>
                        <button className="btn-icon text-danger" onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan="7"><div style={{ textAlign: 'center', padding: '50px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>No items yet</div>
                    <div style={{ color: '#94a3b8', fontSize: 14 }}>Click "Add Item" to add your first product or service</div>
                  </div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          {items.length > 0 && (
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>{modal === 'edit' ? 'Edit Item' : 'Add Item'}</h3>
              <button onClick={closeModal} style={closeBtn}><X size={20} /></button>
            </div>
            <ItemForm initial={modal === 'edit' ? editData : blank} onSave={modal === 'edit' ? handleEdit : handleCreate} onCancel={closeModal} saving={saving} error={error} />
          </div>
        </div>
      )}
    </div>
  );
};

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalStyle = { background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#666', padding: 4 };

export default Items;
