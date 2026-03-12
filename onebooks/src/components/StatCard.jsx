import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, change, changeType, icon: Icon, color }) => {
  const isPositive = changeType === 'positive';

  return (
    <div className="stat-card">
      {/* Coloured icon badge — floats top-right, never competes with text */}
      <div className="stat-icon" style={{ background: color }}>
        <Icon size={22} />
      </div>

      <p className="stat-title">{title}</p>
      <h3 className="stat-value">{value}</h3>

      {change && (
        <div className={`stat-change ${changeType}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
