import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Header = ({ title, subtitle }) => {
  const { user } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <h1 className="header-title">{title}</h1>
          {subtitle && <p className="header-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-right">
        <div className="search-box">
          <Search size={20} />
          <input type="text" placeholder="Search..." />
        </div>

        <button className="icon-button">
          <Bell size={20} />
        </button>

        <div className="user-menu">
          <div className="avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;