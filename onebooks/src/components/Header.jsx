import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, User, Settings, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SEARCH_INDEX = [
  { label: 'Dashboard', path: '/dashboard', section: 'Navigation' },
  { label: 'Customers', path: '/customers', section: 'Sales' },
  { label: 'Invoices', path: '/invoices', section: 'Sales' },
  { label: 'Credit Notes', path: '/credit-notes', section: 'Sales' },
  { label: 'Vendors', path: '/vendors', section: 'Purchases' },
  { label: 'Expenses', path: '/expenses', section: 'Purchases' },
  { label: 'Items', path: '/items', section: 'Navigation' },
  { label: 'Banking', path: '/banking', section: 'Navigation' },
  { label: 'Profit & Loss', path: '/reports/profit-loss', section: 'Reports' },
  { label: 'Balance Sheet', path: '/reports/balance-sheet', section: 'Reports' },
  { label: 'Cash Flow', path: '/reports/cash-flow', section: 'Reports' },
  { label: 'Sales by Customer', path: '/reports/sales-by-customer', section: 'Reports' },
  { label: 'Sales by Item', path: '/reports/sales-by-item', section: 'Reports' },
  { label: 'Trial Balance', path: '/reports/trial-balance', section: 'Reports' },
  { label: 'Chart of Accounts', path: '/accountant/chart-of-accounts', section: 'Accountant' },
  { label: 'Manual Journals', path: '/accountant/journals', section: 'Accountant' },
  { label: 'Budgets', path: '/accountant/budgets', section: 'Accountant' },
  { label: 'Currency Adjustment', path: '/accountant/currency', section: 'Accountant' },
  { label: 'Bulk Update', path: '/accountant/bulk-update', section: 'Accountant' },
  { label: 'Profile', path: '/profile', section: 'Account' },
  { label: 'Settings', path: '/settings', section: 'Account' },
];

const Header = ({ title, subtitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef(null);
  const profileRef = useRef(null);

  const results = query.trim().length > 0
    ? SEARCH_INDEX.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.section.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
        setQuery('');
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchSelect = (path) => {
    navigate(path);
    setQuery('');
    setSearchOpen(false);
  };

  const handleSearchChange = (e) => {
    setQuery(e.target.value);
    setSearchOpen(true);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') { setQuery(''); setSearchOpen(false); }
    if (e.key === 'Enter' && results.length > 0) handleSearchSelect(results[0].path);
  };

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        {/* Global Search */}
        <div className="search-wrapper" ref={searchRef}>
          <div className="search-box">
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search pages, reports, settings..."
              value={query}
              onChange={handleSearchChange}
              onFocus={() => query && setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          {searchOpen && results.length > 0 && (
            <div className="search-results">
              {results.map((item, i) => (
                <div
                  key={i}
                  className="search-result-item"
                  onMouseDown={() => handleSearchSelect(item.path)}
                >
                  <span className="search-result-label">{item.label}</span>
                  <span className="search-result-section">{item.section}</span>
                  <ChevronRight size={14} color="#cbd5e1" />
                </div>
              ))}
            </div>
          )}
          {searchOpen && query.trim().length > 0 && results.length === 0 && (
            <div className="search-results">
              <div className="search-no-results">No results for "{query}"</div>
            </div>
          )}
        </div>

        <button className="icon-button">
          <Bell size={20} />
        </button>

        {/* Profile Avatar + Dropdown */}
        <div className="profile-menu" ref={profileRef}>
          <div className="avatar" onClick={() => setProfileOpen(!profileOpen)}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          {profileOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="profile-dropdown-name">{user?.name}</div>
                  <div className="profile-dropdown-email">{user?.email}</div>
                </div>
              </div>
              <div className="profile-dropdown-divider" />
              <Link
                to="/profile"
                className="profile-dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <User size={16} />
                <span>View Profile</span>
              </Link>
              <Link
                to="/settings"
                className="profile-dropdown-item"
                onClick={() => setProfileOpen(false)}
              >
                <Settings size={16} />
                <span>Settings</span>
              </Link>
              <div className="profile-dropdown-divider" />
              <button
                className="profile-dropdown-item profile-dropdown-logout"
                onClick={() => { setProfileOpen(false); logout(); }}
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
