import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ title, value, change, changeType, icon: Icon, color }) => {
  const isPositive = changeType === 'positive';

  return (
    <div className="stat-card">
      <div className="stat-card-content">
        <div>
          <p className="stat-title">{title}</p>
          <h3 className="stat-value">{value}</h3>
          {change && (
            <div className={`stat-change ${changeType}`}>
              {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{change}</span>
            </div>
          )}
        </div>
        <div className="stat-icon" style={{ background: color }}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;