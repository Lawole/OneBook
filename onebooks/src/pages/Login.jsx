import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useDemoMode, setUseDemoMode] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (useDemoMode) {
      const mockCompany = {
        id: 1,
        name: companyName || 'Demo Company',
        email: 'demo@onebooks.com',
        phone: '',
        address: '',
        tax_rate: 0,
        base_currency: 'USD'
      };
      const mockToken = 'demo-token-' + Date.now();
      
      login(mockCompany, mockToken, true);
      setLoading(false);
      
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 100);
      
      return;
    }

    try {
      const response = await authAPI.login(companyName);
      login(response.data.company, response.data.token, false);
      
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 100);
    } catch (err) {
      setError('Unable to connect to server. Try Demo Mode to explore the app.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modern-login-container">
      {/* Left Side - Welcome Section */}
      <div className="login-left">
        <div className="logo-section">
          <div className="logo-icon-large">1B</div>
          <h1 className="brand-name">OneBooks</h1>
        </div>
        
        <div className="welcome-content">
          <h2 className="welcome-title">Welcome to OneBooks</h2>
          <p className="welcome-subtitle">
            First support for every stage of your financial journey, from 
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

      {/* Right Side - Login Form */}
      <div className="login-right">
        <div className="login-form-container">
          <div className="form-header">
            <h2>Hello again!</h2>
            <p>Welcome back to OneBooks. It's great to see you!</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form-modern">
            <div className="form-group-modern">
              <label htmlFor="companyName">Company Name or User ID</label>
              <input
                type="text"
                id="companyName"
                className="form-input-modern"
                placeholder="Enter your company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required={!useDemoMode}
              />
            </div>

            {error && (
              <div className="alert-modern alert-info-modern">
                ℹ️ {error}
              </div>
            )}

            {useDemoMode && (
              <div className="alert-modern alert-demo-modern">
                🎯 <strong>Demo Mode:</strong> You'll see sample data without database connection.
              </div>
            )}

            <button 
              type="submit" 
              className="btn-modern btn-primary-modern" 
              disabled={loading}
            >
              {loading ? 'Signing in...' : useDemoMode ? 'Continue in Demo Mode' : 'Sign in'}
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

            {!useDemoMode && (
              <div className="help-text-modern">
                Don't have an account? Just enter your company name to get started.
              </div>
            )}
          </form>
        </div>

        <div className="login-footer">
          <p>Earn $250+ with every checking account signup!</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
