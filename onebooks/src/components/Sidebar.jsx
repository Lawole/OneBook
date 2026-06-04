import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, ChevronUp,
  HelpCircle, LogOut, ArrowRight, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import Logo from './Logo';

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { open, close } = useSidebar();
  const [salesOpen, setSalesOpen] = useState(true);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [accountantOpen, setAccountantOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const isActive = (path) => location.pathname === path;
  const isActiveSection = (paths) => paths.some((p) => location.pathname.startsWith(p));

  const onLinkClick = () => close();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard' },
    {
      label: 'Sales',
      submenu: [
        { path: '/customers', label: 'Customers' },
        { path: '/invoices', label: 'Invoices' },
        { path: '/credit-notes', label: 'Credit Notes' },
      ],
      isOpen: salesOpen,
      toggle: () => setSalesOpen(!salesOpen),
    },
    {
      label: 'Purchases',
      submenu: [
        { path: '/vendors', label: 'Vendors' },
        { path: '/expenses', label: 'Expenses' },
      ],
      isOpen: purchasesOpen,
      toggle: () => setPurchasesOpen(!purchasesOpen),
    },
    { path: '/items', label: 'Items' },
    { path: '/banking', label: 'Banking' },
    {
      label: 'Reports',
      submenu: [
        { path: '/reports/profit-loss',       label: 'Profit & Loss'      },
        { path: '/reports/balance-sheet',     label: 'Balance Sheet'      },
        { path: '/reports/cash-flow',         label: 'Cash Flow'          },
        { path: '/reports/sales-by-customer', label: 'Sales by Customer'  },
        { path: '/reports/sales-by-item',     label: 'Sales by Item'      },
        { path: '/reports/trial-balance',     label: 'Trial Balance'      },
      ],
      isOpen: reportsOpen,
      toggle: () => setReportsOpen(!reportsOpen),
    },
    {
      label: 'Accountant',
      submenu: [
        { path: '/accountant/chart-of-accounts', label: 'Chart of Accounts'   },
        { path: '/accountant/journals',          label: 'Manual Journals'     },
        { path: '/accountant/budgets',           label: 'Budgets'             },
        { path: '/accountant/currency',          label: 'Currency Adjustment' },
        { path: '/accountant/bulk-update',       label: 'Bulk Update'         },
      ],
      isOpen: accountantOpen,
      toggle: () => setAccountantOpen(!accountantOpen),
    },
    { path: '/files', label: 'Files' },
  ];

  return (
    <aside className={`sb ${open ? 'sb-open' : ''}`}>
      {/* Mobile close button */}
      <button className="sb-close-mobile" onClick={close} aria-label="Close menu">
        <X size={20} />
      </button>

      {/* Brand */}
      <div className="sb-brand">
        <Logo size={36} />
        <span className="sb-brand-text">OneBooks<span style={{ color: 'var(--primary)' }}>.</span></span>
      </div>

      {/* Workspace switcher */}
      <button className="sb-workspace" onClick={() => setWorkspaceOpen(!workspaceOpen)}>
        <div className="sb-workspace-icon">{(user?.name || 'C').charAt(0).toUpperCase()}</div>
        <div className="sb-workspace-text">
          <div className="sb-workspace-label">Workspace</div>
          <div className="sb-workspace-name">{user?.name || 'My Company'}</div>
        </div>
        {workspaceOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Nav */}
      <nav className="sb-nav">
        {menuItems.map((item, index) => (
          <div key={index}>
            {item.submenu ? (
              <>
                <button
                  className={`sb-item sb-item-toggle ${isActiveSection(item.submenu.map(s => s.path)) ? 'parent-active' : ''}`}
                  onClick={item.toggle}
                >
                  <span>{item.label}</span>
                  <span className="sb-chev">
                    {item.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
                <div className={`sb-submenu ${item.isOpen ? 'open' : ''}`}>
                  {item.submenu.map((subItem, subIndex) => (
                    <Link
                      key={subIndex}
                      to={subItem.path}
                      onClick={onLinkClick}
                      className={`sb-item sb-subitem ${isActive(subItem.path) ? 'active' : ''}`}
                    >
                      <span>{subItem.label}</span>
                    </Link>
                  ))}
                </div>
              </>
            ) : (
              <Link
                to={item.path}
                onClick={onLinkClick}
                className={`sb-item ${isActive(item.path) ? 'active' : ''}`}
              >
                <span>{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div className="sb-divider" />

      {/* Help / Logout */}
      <div className="sb-bottom-nav">
        <Link to="/profile" onClick={onLinkClick} className={`sb-item sb-item-icon ${isActive('/profile') ? 'active' : ''}`}>
          <HelpCircle size={16} />
          <span>Help</span>
        </Link>
        <button className="sb-item sb-item-icon" onClick={() => { close(); logout(); }}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>

      {/* Promo card */}
      <div className="sb-promo">
        <div className="sb-promo-glow" />
        <div className="sb-promo-avatar">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" />
            : <span>{(user?.name || 'U').charAt(0).toUpperCase()}</span>}
        </div>
        <div className="sb-promo-label">Free trial</div>
        <div className="sb-promo-num">14<span className="sb-promo-num-unit"> days left</span></div>
        <div className="sb-promo-copy">Upgrade to unlock all features.</div>
        <button className="sb-promo-btn">
          OneBooks Pro <ArrowRight size={13} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
