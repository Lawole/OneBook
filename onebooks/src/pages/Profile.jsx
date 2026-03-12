import React, { useState, useEffect } from 'react';
import { User, Mail, Building, DollarSign, Calendar, Phone, MapPin } from 'lucide-react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Profile = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/company')
      .then(res => setCompany(res.data))
      .catch(() => setCompany(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading profile...</div>;

  const data = company || {};

  return (
    <div className="page">
      <Header title="Profile" subtitle="Your account and company information" />
      <div className="page-content" style={{ maxWidth: 800 }}>

        {/* Avatar + Name */}
        <div className="profile-hero">
          <div className="profile-avatar-large">
            {(data.name || user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="profile-name">{data.name || user?.name}</h2>
            <p className="profile-role">Account Owner</p>
          </div>
        </div>

        {/* Company Details */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3>Company Information</h3>
          </div>
          <div className="card-body">
            <div className="profile-info-grid">
              <ProfileField icon={Building} label="Company Name" value={data.name || '—'} />
              <ProfileField icon={Mail} label="Email" value={data.email || '—'} />
              <ProfileField icon={Phone} label="Phone" value={data.phone || '—'} />
              <ProfileField icon={DollarSign} label="Base Currency" value={data.base_currency || '—'} />
              <ProfileField icon={User} label="Tax Rate" value={data.tax_rate != null ? `${data.tax_rate}%` : '—'} />
              <ProfileField icon={MapPin} label="Address" value={data.address || '—'} />
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="/settings" className="btn btn-outline" style={{ textDecoration: 'none' }}>
              <Calendar size={16} /> Edit Company Settings
            </a>
            <a href="/invoices" className="btn btn-outline" style={{ textDecoration: 'none' }}>
              <DollarSign size={16} /> View Invoices
            </a>
            <a href="/reports/profit-loss" className="btn btn-outline" style={{ textDecoration: 'none' }}>
              View Reports
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};

const ProfileField = ({ icon: Icon, label, value }) => (
  <div className="profile-field">
    <div className="profile-field-icon">
      <Icon size={16} />
    </div>
    <div>
      <div className="profile-field-label">{label}</div>
      <div className="profile-field-value">{value}</div>
    </div>
  </div>
);

export default Profile;
