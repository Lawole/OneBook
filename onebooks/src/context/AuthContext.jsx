import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';

const AuthContext = createContext();

const TIMEOUT_MS  = 5 * 60 * 1000;  // 5 minutes
const WARNING_MS  = 30 * 1000;       // warn 30 s before logout

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [token, setToken]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]   = useState(30);

  const logoutTimer   = useRef(null);
  const warningTimer  = useRef(null);
  const countdownRef  = useRef(null);

  // ── Logout ───────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setIsDemoMode(false);
    setShowWarning(false);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('demoMode');
    clearTimeout(logoutTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownRef.current);
  }, []);

  // ── Reset inactivity timers ───────────────────────────────────
  const resetTimers = useCallback(() => {
    if (!localStorage.getItem('authToken')) return; // not logged in

    clearTimeout(logoutTimer.current);
    clearTimeout(warningTimer.current);
    clearInterval(countdownRef.current);
    setShowWarning(false);

    // Show warning at TIMEOUT - WARNING
    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(30);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

    // Auto-logout at TIMEOUT
    logoutTimer.current = setTimeout(() => {
      logout();
    }, TIMEOUT_MS);
  }, [logout]);

  // ── Listen for user activity ──────────────────────────────────
  useEffect(() => {
    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

    const handleActivity = () => {
      if (showWarning) return; // don't reset while warning is visible
      resetTimers();
    };

    EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => EVENTS.forEach((e) => window.removeEventListener(e, handleActivity));
  }, [resetTimers, showWarning]);

  // ── Bootstrap from localStorage ──────────────────────────────
  useEffect(() => {
    const storedToken   = localStorage.getItem('authToken');
    const storedUser    = localStorage.getItem('user');
    const storedDemoMode = localStorage.getItem('demoMode');

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        setIsDemoMode(storedDemoMode === 'true');
        resetTimers();
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Login ─────────────────────────────────────────────────────
  const login = (userData, authToken, demoMode = false) => {
    setUser(userData);
    setToken(authToken);
    setIsDemoMode(demoMode);
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('demoMode', String(demoMode));
    resetTimers();
  };

  // ── "Stay logged in" handler ──────────────────────────────────
  const stayLoggedIn = () => {
    setShowWarning(false);
    clearInterval(countdownRef.current);
    resetTimers();
  };

  const value = {
    user, token, login, logout, stayLoggedIn,
    isAuthenticated: !!token, isDemoMode, loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* ── Inactivity warning modal ── */}
      {showWarning && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            padding: '36px 40px',
            maxWidth: 400,
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
            animation: 'slideUp 0.25s ease',
          }}>
            {/* Countdown ring */}
            <div style={{
              width: 72, height: 72,
              borderRadius: '50%',
              background: countdown <= 10 ? '#fee2e2' : '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 28, fontWeight: 800,
              color: countdown <= 10 ? '#dc2626' : '#d97706',
              border: `4px solid ${countdown <= 10 ? '#fca5a5' : '#fcd34d'}`,
            }}>
              {countdown}
            </div>

            <h3 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              Still there?
            </h3>
            <p style={{ margin: '0 0 28px', color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
              You've been inactive for a while. For your security, you'll be automatically signed out in <strong>{countdown} second{countdown !== 1 ? 's' : ''}</strong>.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={logout}
                style={{
                  flex: 1, padding: '12px', border: '1.5px solid #e2e8f0',
                  borderRadius: 10, background: 'transparent', color: '#374151',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}>
                Sign Out
              </button>
              <button
                onClick={stayLoggedIn}
                style={{
                  flex: 1, padding: '12px',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  border: 'none', borderRadius: 10, color: 'white',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                }}>
                Stay Logged In
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};
