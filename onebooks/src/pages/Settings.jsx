import React, { useState, useEffect } from 'react';
import { Save, CheckCircle, Lock } from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { WORLD_CURRENCIES } from '../utils/currencies';

const Settings = () => {
  const { user, login, token } = useAuth();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', tax_rate: '', base_currency: 'USD',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/company')
      .then(res => {
        const d = res.data;
        setForm({
          name: d.name || '',
          email: d.email || '',
          phone: d.phone || '',
          address: d.address || '',
          tax_rate: d.tax_rate ?? '',
          base_currency: d.base_currency || 'USD',
        });
      })
      .catch(() => {
        setForm(f => ({ ...f, name: user?.name || '', email: user?.email || '' }));
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setSaved(false);
    setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      // Base currency is chosen at signup and intentionally omitted
      // here — changing it after transactions exist would corrupt reports.
      await api.put('/company', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        tax_rate: parseFloat(form.tax_rate) || 0,
      });
      // Update auth context so header shows new name
      const updatedUser = { ...(user || {}), name: form.name, email: form.email, tax_rate: parseFloat(form.tax_rate) || 0 };
      login(updatedUser, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  return (
    <div className="page">
      <Header title="Settings" subtitle="Manage your company and account preferences" />
      <div className="page-content" style={{ maxWidth: 680 }}>

        {saved && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            <CheckCircle size={18} /> Settings saved successfully.
          </div>
        )}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Company Info */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><h3>Company Information</h3></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Company Name</label>
                  <input name="name" className="form-control" value={form.name} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" className="form-control" value={form.phone} onChange={handleChange} placeholder="+1 234 567 8900" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input name="address" className="form-control" value={form.address} onChange={handleChange} placeholder="123 Main St, City" />
                </div>
              </div>
            </div>
          </div>

          {/* Financial Settings */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><h3>Financial Settings</h3></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Base Currency <Lock size={12} style={{ color: '#94a3b8' }} />
                  </label>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: '#f8fafc',
                    border: '1px solid #e2e8f0', borderRadius: 10,
                    color: '#334155', fontSize: 14, fontWeight: 600,
                  }}>
                    <span style={{ fontSize: 18 }}>
                      {WORLD_CURRENCIES.find(c => c.code === form.base_currency)?.flag || '🌐'}
                    </span>
                    <span>{form.base_currency}</span>
                    <span style={{ color: '#64748b', fontWeight: 500, fontSize: 13 }}>
                      — {WORLD_CURRENCIES.find(c => c.code === form.base_currency)?.label || form.base_currency}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, lineHeight: 1.5 }}>
                    Your OneBook account uses a single, uniform currency chosen when you registered. This keeps invoices, expenses, and reports consistent. Contact support if you need to change it.
                  </div>
                </div>
                <div className="form-group">
                  <label>Default VAT / Tax Rate (%)</label>
                  <input
                    name="tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="form-control"
                    value={form.tax_rate}
                    onChange={handleChange}
                    placeholder="e.g. 7.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
