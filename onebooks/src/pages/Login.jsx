import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { WORLD_CURRENCIES } from '../utils/currencies';

const CurrencyPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = WORLD_CURRENCIES.find((c) => c.code === value);
  const filtered = WORLD_CURRENCIES.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.label.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (code) => {
    onChange(code);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="form-input-modern"
        style={{
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-primary, #fff)',
        }}
      >
        {selected ? (
          <>
            <span>{selected.flag}</span>
            <span style={{ fontWeight: 500 }}>{selected.code}</span>
            <span style={{ color: '#6b7280' }}>— {selected.label}</span>
            <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>▾</span>
          </>
        ) : (
          <span style={{ color: '#9ca3af' }}>Select currency ▾</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {/* Search box */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search currency or country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>
                No currencies found
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.code}
                  onClick={() => handleSelect(c.code)}
                  style={{
                    padding: '9px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    background: c.code === value ? '#eff6ff' : 'transparent',
                    borderLeft: c.code === value ? '3px solid #3b82f6' : '3px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (c.code !== value) e.currentTarget.style.background = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    if (c.code !== value) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: 18 }}>{c.flag}</span>
                  <span style={{ fontWeight: 600, minWidth: 40, color: '#111827' }}>{c.code}</span>
                  <span style={{ color: '#374151', flex: 1 }}>{c.label}</span>
                  <span style={{ color: '#9ca3af', fontSize: 11 }}>{c.symbol}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Login = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useDemoMode, setUseDemoMode] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const resetForm = () => {
    setError('');
    setCompanyName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setCurrency('USD');
  };

  const switchMode = (newMode) => {
    resetForm();
    setUseDemoMode(false);
    setMode(newMode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Demo mode
    if (useDemoMode) {
      const mockCompany = {
        id: 1,
        name: 'Demo Company',
        email: 'demo@onebooks.com',
        phone: '',
        address: '',
        tax_rate: 0,
        base_currency: 'USD'
      };
      login(mockCompany, 'demo-token-' + Date.now(), true);
      setLoading(false);
      setTimeout(() => navigate('/dashboard', { replace: true }), 100);
      return;
    }

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        const response = await authAPI.register(companyName, email, password, currency);
        login(response.data.company, response.data.token, false);
      } else {
        const response = await authAPI.login(email, password);
        login(response.data.company, response.data.token, false);
      }
      setTimeout(() => navigate('/dashboard', { replace: true }), 100);
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) {
        setError(msg);
      } else {
        setError('Unable to connect to server. Try Demo Mode to explore the app.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modern-login-container">
      {/* Left Side */}
      <div className="login-left">
        <div className="logo-section">
          <div className="logo-icon-large">1B</div>
          <h1 className="brand-name">OneBooks</h1>
        </div>

        <div className="welcome-content">
          <h2 className="welcome-title">Welcome to OneBooks</h2>
          <p className="welcome-subtitle">
            Full support for every stage of your financial journey, from
            invoicing and expense tracking to comprehensive financial reporting.
          </p>

          <div className="features-list">
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div className="feature-text">
                <h4>Real-time Dashboard</h4>
                <p>Track your business metrics at a glance</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💰</div>
              <div className="feature-text">
                <h4>Invoice Management</h4>
                <p>Create and send professional invoices</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📈</div>
              <div className="feature-text">
                <h4>Financial Reports</h4>
                <p>Export P&L, Balance Sheet, and more</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="login-right">
        <div className="login-form-container">
          <div className="form-header">
            {mode === 'login' ? (
              <>
                <h2>Hello again!</h2>
                <p>Welcome back to OneBooks. It's great to see you!</p>
              </>
            ) : (
              <>
                <h2>Create your account</h2>
                <p>Get started with OneBooks for free.</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="login-form-modern">
            {mode === 'register' && (
              <>
                <div className="form-group-modern">
                  <label htmlFor="companyName">Company Name</label>
                  <input
                    type="text"
                    id="companyName"
                    className="form-input-modern"
                    placeholder="Your company name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required={!useDemoMode}
                  />
                </div>
                <div className="form-group-modern">
                  <label htmlFor="currency">Base Currency</label>
                  <CurrencyPicker value={currency} onChange={setCurrency} />
                  <small style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                    This will be used for all invoices, reports, and financial data.
                  </small>
                </div>
              </>
            )}

            <div className="form-group-modern">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                className="form-input-modern"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={!useDemoMode}
              />
            </div>

            <div className="form-group-modern">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                className="form-input-modern"
                placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!useDemoMode}
              />
            </div>

            {mode === 'register' && (
              <div className="form-group-modern">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  className="form-input-modern"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={!useDemoMode}
                />
              </div>
            )}

            {error && (
              <div className="alert-modern alert-info-modern">
                ⚠️ {error}
              </div>
            )}

            {useDemoMode && (
              <div className="alert-modern alert-demo-modern">
                🎯 <strong>Demo Mode:</strong> You'll see sample data without a database connection.
              </div>
            )}

            <button
              type="submit"
              className="btn-modern btn-primary-modern"
              disabled={loading}
            >
              {loading
                ? mode === 'register' ? 'Creating account...' : 'Signing in...'
                : useDemoMode
                  ? 'Continue in Demo Mode'
                  : mode === 'register' ? 'Create Account' : 'Sign In'}
            </button>

            <div className="divider-modern">
              <span>or</span>
            </div>

            <button
              type="button"
              className="btn-modern btn-demo-modern"
              onClick={() => setUseDemoMode(!useDemoMode)}
            >
              {useDemoMode ? '🔐 Use Live Account' : '🎮 Try Demo Mode'}
            </button>

            <div className="help-text-modern" style={{ textAlign: 'center', marginTop: '16px' }}>
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <span
                    onClick={() => switchMode('register')}
                    style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Create one
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span
                    onClick={() => switchMode('login')}
                    style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Sign in
                  </span>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
