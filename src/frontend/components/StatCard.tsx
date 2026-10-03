import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: string;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subtext, icon, accentColor = '#3b82f6' }) => {
  return (
    <div className="panel" style={{ borderLeft: `4px solid ${accentColor}`, flex: 1, minWidth: '160px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>{label}</span>
        {icon && <span style={{ fontSize: '16px' }}>{icon}</span>}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc' }}>{value}</div>
      {subtext && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{subtext}</div>}
    </div>
  );
};
