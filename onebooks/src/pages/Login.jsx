import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Zap } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { WORLD_CURRENCIES } from '../utils/currencies';

/* ─── Currency Picker ─────────────────────────────────────────── */
const CurrencyPicker = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selected = WORLD_CURRENCIES.find((c) => c.code === value);
  const filtered = WORLD_CURRENCIES.filter((c) => {
    const q = search.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q) || c.country.toLowerCase().includes(q);
  });

  useEffect(() => {
    const h = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="login-input" style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
        {selected ? (<><span>{selected.flag}</span><span style={{ fontWeight: 600 }}>{selected.code}</span><span style={{ color: '#9ca3af', flex: 1 }}>— {selected.label}</span><span style={{ color: '#9ca3af' }}>▾</span></>)
          : <span style={{ color: '#9ca3af' }}>Select currency ▾</span>}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.15)', zIndex: 9999, overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
            <input ref={inputRef} type="text" placeholder="Search currency…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {filtered.map((c) => (
              <div key={c.code} onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: c.code === value ? '#eff6ff' : 'transparent', borderLeft: c.code === value ? '3px solid #6366f1' : '3px solid transparent' }}
                onMouseEnter={(e) => { if (c.code !== value) e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { if (c.code !== value) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ fontWeight: 600, minWidth: 38, color: '#111' }}>{c.code}</span>
                <span style={{ color: '#374151', flex: 1 }}>{c.label}</span>
                <span style={{ color: '#9ca3af', fontSize: 11 }}>{c.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main Login Page ─────────────────────────────────────────── */
const Login = () => {
  const [mode, setMode] = useState('login');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useDemoMode, setUseDemoMode] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const resetForm = () => { setError(''); setCompanyName(''); setEmail(''); setPassword(''); setConfirmPassword(''); setCurrency('USD'); };
  const switchMode = (m) => { resetForm(); setUseDemoMode(false); setMode(m); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (useDemoMode) {
      const mockCompany = { id: 1, name: 'Demo Company', email: 'demo@onebooks.com', phone: '', address: '', tax_rate: 0, base_currency: 'USD' };
      login(mockCompany, 'demo-token-' + Date.now(), true);
      setLoading(false);
      setTimeout(() => navigate('/dashboard', { replace: true }), 100);
      return;
    }

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) { setError('Passwords do not match'); setLoading(false); return; }
        const response = await authAPI.register(companyName, email, password, currency);
        login(response.data.company, response.data.token, false);
      } else {
        const response = await authAPI.login(email, password);
        login(response.data.company, response.data.token, false);
      }
      setTimeout(() => navigate('/dashboard', { replace: true }), 100);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || 'Unable to connect. Try Demo Mode to explore the app.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Animated background blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <div className="login-layout">
        {/* ── Left panel ── */}
        <div className="login-panel-left">
          <div className="login-brand">
            <div className="login-brand-icon">1B</div>
            <span className="login-brand-name">OneBooks</span>
          </div>

          <div className="login-hero-text">
            <h1 className="login-hero-title">Smart accounting<br />for modern teams.</h1>
            <p className="login-hero-sub">Invoicing, expenses, reports and double-entry bookkeeping — all in one beautifully simple platform.</p>
          </div>

          <div className="login-stats">
            <div className="login-stat">
              <span className="login-stat-num">10K+</span>
              <span className="login-stat-label">Invoices created</span>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <span className="login-stat-num">99%</span>
              <span className="login-stat-label">Uptime</span>
            </div>
            <div className="login-stat-divider" />
            <div className="login-stat">
              <span className="login-stat-num">50+</span>
              <span className="login-stat-label">Currencies</span>
            </div>
          </div>

          {/* Floating feature cards */}
          <div className="login-float-cards">
            <div className="login-float-card" style={{ animationDelay: '0s' }}>
              <span className="login-float-icon">📊</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Live Dashboard</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>Real-time metrics</div>
              </div>
            </div>
            <div className="login-float-card" style={{ animationDelay: '0.4s' }}>
              <span className="login-float-icon">💰</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Auto Invoicing</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>PDF export ready</div>
              </div>
            </div>
            <div className="login-float-card" style={{ animationDelay: '0.8s' }}>
              <span className="login-float-icon">🔐</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Bank-grade Security</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>JWT + Encryption</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="login-panel-right">
          <div className="login-form-box">
            {/* Tab switcher */}
            <div className="login-tabs">
              <button className={`login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Sign In</button>
              <button className={`login-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Create Account</button>
            </div>

            <div className="login-form-header">
              {mode === 'login' ? (
                <><h2>Welcome back 👋</h2><p>Sign in to your OneBooks account</p></>
              ) : (
                <><h2>Get started free</h2><p>No credit card required</p></>
              )}
            </div>

            <form onSubmit={handleSubmit} className="login-form-inner">
              {mode === 'register' && (
                <>
                  <div className="login-field">
                    <label>Company Name</label>
                    <input className="login-input" type="text" placeholder="Acme Ltd." value={companyName} onChange={(e) => setCompanyName(e.target.value)} required={!useDemoMode} />
                  </div>
                  <div className="login-field">
                    <label>Base Currency</label>
                    <CurrencyPicker value={currency} onChange={setCurrency} />
                  </div>
                </>
              )}

              <div className="login-field">
                <label>Email Address</label>
                <input className="login-input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required={!useDemoMode} />
              </div>

              <div className="login-field">
                <label>Password</label>
                <div style={{ position: 'relative' }}>
                  <input className="login-input" type={showPass ? 'text' : 'password'} placeholder={mode === 'register' ? 'Min. 6 characters' : '••••••••'} value={password} onChange={(e) => setPassword(e.target.value)} required={!useDemoMode} style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="login-field">
                  <label>Confirm Password</label>
                  <input className="login-input" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required={!useDemoMode} />
                </div>
              )}

              {error && <div className="login-alert login-alert-error">⚠️ {error}</div>}
              {useDemoMode && <div className="login-alert login-alert-demo">🎯 <strong>Demo Mode:</strong> You'll explore with sample data.</div>}

              <button type="submit" className="login-btn-primary" disabled={loading}>
                {loading ? <span className="login-spinner" /> : <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight size={18} /></>}
              </button>

              <div className="login-divider"><span>or</span></div>

              <button type="button" className="login-btn-demo" onClick={() => { setUseDemoMode(true); setTimeout(() => document.querySelector('.login-btn-primary')?.click(), 50); }}>
                <Zap size={16} /> Try Demo (no account needed)
              </button>
            </form>

            <p className="login-footer-note">
              {mode === 'login'
                ? <>Don't have an account? <button className="login-link" onClick={() => switchMode('register')}>Create one free</button></>
                : <>Already have an account? <button className="login-link" onClick={() => switchMode('login')}>Sign in</button></>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
