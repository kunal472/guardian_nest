import React from 'react';
import { BatteryCharging, Clock, History, MapPin } from 'lucide-react';
import { LocationLog } from '../services/api';

interface BreadcrumbLogProps {
  logs: Array<{ lat: number; lng: number; batteryLevel?: number; loggedAt: string }>;
}

export const BreadcrumbLog: React.FC<BreadcrumbLogProps> = ({ logs }) => {
  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={16} color="var(--accent-blue)" />
          <span style={{ fontWeight: '600', fontSize: '14px' }}>GPS Breadcrumbs (PostgreSQL Log)</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {logs.length} Pings Cached
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px' }}>
        {logs.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No GPS trail recorded yet.
          </div>
        ) : (
          logs.slice().reverse().map((log, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                background: index === 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                border: index === 0 ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} color={index === 0 ? '#3b82f6' : '#64748b'} />
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                {log.batteryLevel !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <BatteryCharging size={13} color={log.batteryLevel < 20 ? '#ef4444' : '#10b981'} />
                    <span>{log.batteryLevel}%</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                  <Clock size={12} />
                  <span>{new Date(log.loggedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
