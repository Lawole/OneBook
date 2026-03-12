import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  ShoppingCart,
  Package,
  TrendingUp,
  LogOut,
  ChevronDown,
  ChevronRight,
  Landmark,
  Calculator,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [salesOpen, setSalesOpen] = useState(true);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [accountantOpen, setAccountantOpen] = useState(false);

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    {
      label: 'Sales',
      icon: TrendingUp,
      submenu: [
        { path: '/customers', icon: Users, label: 'Customers' },
        { path: '/invoices', icon: FileText, label: 'Invoices' },
        { path: '/credit-notes', icon: CreditCard, label: 'Credit Notes' },
      ],
      isOpen: salesOpen,
      toggle: () => setSalesOpen(!salesOpen),
    },
    {
      label: 'Purchases',
      icon: ShoppingCart,
      submenu: [
        { path: '/vendors', icon: Users, label: 'Vendors' },
        { path: '/expenses', icon: CreditCard, label: 'Expenses' },
      ],
      isOpen: purchasesOpen,
      toggle: () => setPurchasesOpen(!purchasesOpen),
    },
    { path: '/items', icon: Package, label: 'Items' },
    { path: '/banking', icon: Landmark, label: 'Banking' },
    {
      label: 'Reports',
      icon: FileText,
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
      icon: Calculator,
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
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">1B</div>
          <div>
            <div className="logo-text">OneBooks</div>
            <div className="company-name">{user?.name}</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item, index) => (
          <div key={index}>
            {item.submenu ? (
              <>
                <div className="nav-item has-submenu" onClick={item.toggle}>
                  <item.icon size={20} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                {item.isOpen && (
                  <div className="submenu">
                    {item.submenu.map((subItem, subIndex) => (
                      <Link
                        key={subIndex}
                        to={subItem.path}
                        className={`nav-item submenu-item ${isActive(subItem.path) ? 'active' : ''}`}
                      >
                        {subItem.icon && <subItem.icon size={18} />}
                        <span>{subItem.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link to={item.path} className={`nav-item ${isActive(item.path) ? 'active' : ''}`}>
                <item.icon size={20} />
                <span>{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item" onClick={logout}>
          <LogOut size={20} />
          <span>Logout</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;