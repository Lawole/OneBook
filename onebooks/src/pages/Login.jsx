import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, ArrowRight, ArrowLeft, Zap,
  ShieldCheck, CheckCircle2, Sparkles,
} from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { WORLD_CURRENCIES } from '../utils/currencies';
import Logo from '../components/Logo';

/* ─── Currency Picker (compact, matches lv2 style) ─────────────── */
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
      <button
        type="button"
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="lv2-input"
        style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        {selected ? (
          <>
            <span style={{ fontSize: 18 }}>{selected.flag}</span>
            <span style={{ fontWeight: 600, color: '#0d0d0d' }}>{selected.code}</span>
            <span style={{ color: '#8a8a8a', flex: 1, fontSize: 14 }}>— {selected.label}</span>
            <span style={{ color: '#8a8a8a' }}>▾</span>
          </>
        ) : (
          <span style={{ color: '#a8a8a8' }}>Select currency ▾</span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'white', border: '1px solid #e6e6e6',
          borderRadius: 14, boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
          zIndex: 9999, overflow: 'hidden',
          animation: 'fadeUp 0.2s var(--ease-out)',
        }}>
          <div style={{ padding: '10px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search currency…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%', border: '1px solid #e6e6e6',
                borderRadius: 10, padding: '9px 12px', fontSize: 13,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                background: '#fafafa',
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.map((c) => (
              <div
                key={c.code}
                onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13,
                  background: c.code === value ? '#f5f5f5' : 'transparent',
                  borderLeft: c.code === value ? '3px solid #0d0d0d' : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (c.code !== value) e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={(e) => { if (c.code !== value) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span style={{ fontWeight: 600, minWidth: 38, color: '#0d0d0d' }}>{c.code}</span>
                <span style={{ color: '#4a4a4a', flex: 1 }}>{c.label}</span>
                <span style={{ color: '#8a8a8a', fontSize: 11 }}>{c.symbol}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Password strength helper ───────────────────────────────── */
const evaluatePassword = (pw) => {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const tier = Math.min(4, Math.max(1, Math.ceil(score * 0.8)));
  const labels = { 1: 'weak', 2: 'fair', 3: 'good', 4: 'strong' };
  return { score: tier, label: labels[tier] };
};

/* ─── Main Login Page ─────────────────────────────────────────── */
const Login = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [step, setStep] = useState(1);

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [rememberMe, setRememberMe] = useState(true);

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useDemoMode, setUseDemoMode] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const resetAll = () => {
    setError(''); setCompanyName(''); setEmail(''); setPassword('');
    setConfirmPassword(''); setCurrency('USD'); setStep(1); setUseDemoMode(false);
  };

  const switchMode = (m) => { resetAll(); setMode(m); };

  const validateStep1 = () => {
    if (!email.trim()) return 'Please enter your email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const validateStep2 = () => {
    if (!companyName.trim()) return 'Please enter your company name';
    return null;
  };

  const handleNext = () => {
    setError('');
    if (step === 1) { const err = validateStep1(); if (err) return setError(err); setStep(2); }
    else if (step === 2) { const err = validateStep2(); if (err) return setError(err); setStep(3); }
  };

  const handleBack = () => { setError(''); setStep(Math.max(1, step - 1)); };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
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

  const handleDemo = () => { setUseDemoMode(true); setTimeout(() => handleSubmit(), 50); };
  const handleForgot = () => alert('Password reset link will be sent to your email. (Coming soon)');

  const pwStrength = evaluatePassword(password);

  return (
    <div className="lv2">
      <div className="lv2-bg-fallback" />
      <div
        className="lv2-bg"
        style={{
          backgroundImage: [
            'linear-gradient(100deg, rgba(20,16,13,0.55) 0%, rgba(20,16,13,0.18) 45%, rgba(20,16,13,0) 62%)',
            "url('/login-hero.jpg')",
            "url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1800&q=85&auto=format&fit=crop')",
            "url('https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1800&q=85&auto=format&fit=crop')",
            "url('https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1800&q=85&auto=format&fit=crop')",
          ].join(', '),
        }}
      />
      <div className="lv2-grain" />
      <div className="lv2-vignette" />

      {/* ── Top Nav ── */}
      <nav className="lv2-nav">
        <div className="lv2-logo">
          <Logo size={32} variant="mark-white" />
          <span>OneBooks<span style={{ opacity: 0.85 }}>.</span></span>
        </div>

        <div className="lv2-nav-center">
          <button className="lv2-nav-link">Small business</button>
          <button className="lv2-nav-link">Accountants</button>
          <button className="lv2-nav-link">Enterprise</button>
        </div>

        <div className="lv2-nav-right">
          <button className="lv2-nav-link" onClick={() => switchMode('register')}>Open account</button>
          <button className="lv2-nav-link" onClick={() => switchMode('login')}>Sign in</button>
        </div>
      </nav>

      {/* ── Main grid ── */}
      <div className="lv2-main">
        {/* Left welcome */}
        <div className="lv2-welcome">
          <h1 className="lv2-welcome-title">
            Welcome<br />to OneBooks.
          </h1>
          <p className="lv2-welcome-sub">
            Find support for every stage of your financial journey — from invoicing and expenses to reports and double-entry bookkeeping.
          </p>
          <button className="lv2-cta-dark" onClick={() => switchMode('register')}>
            Explore OneBooks
            <ArrowRight size={17} className="lv2-cta-arrow" />
          </button>

          <div className="lv2-chips">
            <div className="lv2-chip"><span className="lv2-chip-dot" /> Invoicing</div>
            <div className="lv2-chip"><span className="lv2-chip-dot" /> Reports</div>
            <div className="lv2-chip"><span className="lv2-chip-dot" /> Banking</div>
          </div>
        </div>

        {/* Right card */}
        <div className="lv2-card">
          <div className="lv2-card-inner">
            {mode === 'login' ? (
              /* ─── SIGN IN ─── */
              <>
                <div className="lv2-card-header">
                  <h2 className="lv2-card-title">Hello again!</h2>
                  <p className="lv2-card-sub">Welcome back to OneBooks. Fill in your details to sign in.</p>
                </div>

                <form onSubmit={handleSubmit} className="lv2-form">
                  <div className="lv2-field">
                    <label>Account or e-mail ID</label>
                    <div className="lv2-input-wrap">
                      <input
                        className="lv2-input"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="lv2-field">
                    <label>Password</label>
                    <div className="lv2-input-wrap">
                      <input
                        className="lv2-input"
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="lv2-input-eye" aria-label="Toggle password">
                        {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <div className="lv2-row">
                    <label className="lv2-check">
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                      Remember me
                    </label>
                    <button type="button" className="lv2-forgot" onClick={handleForgot}>Forgot password?</button>
                  </div>

                  {error && <div className="lv2-alert">{error}</div>}

                  <div className="lv2-actions">
                    <button type="submit" className="lv2-btn-primary" disabled={loading}>
                      {loading ? <span className="lv2-spinner" /> : 'Sign in'}
                    </button>
                    <button type="button" className="lv2-btn-outline" onClick={() => switchMode('register')}>
                      Open a checking account
                    </button>
                  </div>
                </form>

                <div className="lv2-card-footer">
                  Don't a OneBooks user yet?{' '}
                  <button className="as-link" onClick={() => switchMode('register')}>
                    Click here and check out the special new joining account
                  </button>
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 11.5 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <ShieldCheck size={12} /> Encrypted
                    </span>
                    <span>·</span>
                    <button className="as-link" onClick={handleDemo} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <Zap size={12} /> Continue with demo
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ─── SIGN UP (3-step wizard, matching style) ─── */
              <>
                <div className="lv2-wizard-progress">
                  <div className={`lv2-wizard-dot ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`}>
                    {step > 1 ? <CheckCircle2 size={14} /> : '1'}
                  </div>
                  <div className={`lv2-wizard-bar ${step > 1 ? 'filled' : ''}`} />
                  <div className={`lv2-wizard-dot ${step >= 2 ? (step > 2 ? 'done' : 'active') : ''}`}>
                    {step > 2 ? <CheckCircle2 size={14} /> : '2'}
                  </div>
                  <div className={`lv2-wizard-bar ${step > 2 ? 'filled' : ''}`} />
                  <div className={`lv2-wizard-dot ${step >= 3 ? 'active' : ''}`}>3</div>
                </div>

                <form
                  onSubmit={(e) => { e.preventDefault(); if (step < 3) handleNext(); else handleSubmit(e); }}
                  className="lv2-form"
                >
                  {step === 1 && (
                    <div className="lv2-wizard-step" key="step-1">
                      <div className="lv2-card-header">
                        <h2 className="lv2-card-title">Open account.</h2>
                        <p className="lv2-card-sub">Step 1 of 3 — Your login details.</p>
                      </div>

                      <div className="lv2-field">
                        <label>Work email</label>
                        <input
                          className="lv2-input"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          autoComplete="email"
                          autoFocus
                          required
                        />
                      </div>

                      <div className="lv2-field">
                        <label>Password</label>
                        <div className="lv2-input-wrap">
                          <input
                            className="lv2-input"
                            type={showPass ? 'text' : 'password'}
                            placeholder="At least 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                          />
                          <button type="button" onClick={() => setShowPass(!showPass)} className="lv2-input-eye" aria-label="Toggle password">
                            {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                        {password && (
                          <>
                            <div className="lv2-pw-strength">
                              {[1, 2, 3, 4].map((i) => (
                                <div key={i} className={`lv2-pw-bar ${i <= pwStrength.score ? pwStrength.label : ''}`} />
                              ))}
                            </div>
                            <div className={`lv2-pw-label ${pwStrength.label}`}>
                              Password strength: <strong style={{ textTransform: 'capitalize' }}>{pwStrength.label}</strong>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="lv2-field">
                        <label>Confirm password</label>
                        <input
                          className="lv2-input"
                          type={showPass ? 'text' : 'password'}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          autoComplete="new-password"
                          required
                        />
                      </div>

                      {error && <div className="lv2-alert">{error}</div>}

                      <div className="lv2-actions">
                        <button type="submit" className="lv2-btn-primary">
                          Continue <ArrowRight size={17} />
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="lv2-wizard-step" key="step-2">
                      <div className="lv2-card-header">
                        <h2 className="lv2-card-title">Your business.</h2>
                        <p className="lv2-card-sub">Step 2 of 3 — Tell us what to put on your invoices.</p>
                      </div>

                      <div className="lv2-field">
                        <label>Company name</label>
                        <input
                          className="lv2-input"
                          type="text"
                          placeholder="Acme Ltd."
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          autoFocus
                          required
                        />
                      </div>

                      {error && <div className="lv2-alert">{error}</div>}

                      <div className="lv2-wizard-nav">
                        <button type="button" className="lv2-wizard-back" onClick={handleBack}>
                          <ArrowLeft size={15} /> Back
                        </button>
                        <button type="submit" className="lv2-btn-primary">
                          Continue <ArrowRight size={17} />
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="lv2-wizard-step" key="step-3">
                      <div className="lv2-card-header">
                        <h2 className="lv2-card-title">Base currency.</h2>
                        <p className="lv2-card-sub">Step 3 of 3 — You can change this later in settings.</p>
                      </div>

                      <div className="lv2-field">
                        <label>Currency</label>
                        <CurrencyPicker value={currency} onChange={setCurrency} />
                      </div>

                      {error && <div className="lv2-alert">{error}</div>}

                      <div className="lv2-wizard-nav">
                        <button type="button" className="lv2-wizard-back" onClick={handleBack} disabled={loading}>
                          <ArrowLeft size={15} /> Back
                        </button>
                        <button type="submit" className="lv2-btn-primary" disabled={loading}>
                          {loading ? <span className="lv2-spinner" /> : <>Create account <Sparkles size={16} /></>}
                        </button>
                      </div>
                    </div>
                  )}
                </form>

                <div className="lv2-card-footer">
                  Already a OneBooks user?{' '}
                  <button className="as-link" onClick={() => switchMode('login')}>Sign in instead</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
