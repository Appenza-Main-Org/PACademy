import type { ReactNode } from 'react';
import { num } from '@/shared/lib/format';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconBg?: string;
  iconColor?: string;
  trend?: { label: string; direction?: 'up' | 'down' };
}

export function StatCard({ label, value, icon, iconBg, iconColor, trend }: StatCardProps): JSX.Element {
  return (
    <div className="stat">
      <div className="stat-header">
        <span className="stat-label">{label}</span>
        <span className="stat-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </span>
      </div>
      <div className="stat-value">{typeof value === 'number' ? num(value) : value}</div>
      {trend && (
        <div className={`stat-trend ${trend.direction ?? 'up'}`}>
          {trend.direction === 'down' ? '↓' : '↑'} {trend.label}
        </div>
      )}
    </div>
  );
}
