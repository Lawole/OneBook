import React, { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';
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
      await api.put('/company', {
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        tax_rate: parseFloat(form.tax_rate) || 0,
        base_currency: form.base_currency,
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
                  <label>Base Currency</label>
                  <select name="base_currency" className="form-control" value={form.base_currency} onChange={handleChange}>
                    {WORLD_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
                    ))}
                  </select>
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
