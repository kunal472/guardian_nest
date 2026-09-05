import React from 'react';
import { AlertTriangle, Radio, ShieldAlert, Zap } from 'lucide-react';
import { Incident } from '../services/api';

interface LiveAlertBannerProps {
  activeIncidents: Incident[];
  selectedIncident: Incident | null;
  onSelect: (inc: Incident) => void;
}

export const LiveAlertBanner: React.FC<LiveAlertBannerProps> = ({
  activeIncidents,
  selectedIncident,
  onSelect,
}) => {
  const activeCount = activeIncidents.filter(
    (i) => i.status === 'ACTIVE' || i.status === 'DISPATCHED',
  ).length;

  return (
    <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              position: 'relative',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: activeCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: activeCount > 0 ? '#ef4444' : '#10b981',
            }}
          >
            {activeCount > 0 ? (
              <>
                <ShieldAlert size={24} />
                <span
                  className="animate-pulse-ring"
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '14px',
                    border: '2px solid #ef4444',
                    pointerEvents: 'none',
                  }}
                />
              </>
            ) : (
              <Radio size={24} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.02em' }}>
                Tactical Emergency Dispatch Feed
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: activeCount > 0 ? '#ef4444' : '#10b981',
                  color: '#fff',
                  textTransform: 'uppercase',
                }}
              >
                {activeCount > 0 ? `${activeCount} Live Threat${activeCount > 1 ? 's' : ''}` : 'All Sectors Nominal'}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Subscribed to Redis geospatial event stream: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>events.distress.broadcast_nearby</span>
            </p>
          </div>
        </div>

        {/* Live Ticker Pills */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '600px', padding: '4px' }}>
          {activeIncidents.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No active distress signals. Sentinel mesh standing by.
            </div>
          ) : (
            activeIncidents.slice(0, 4).map((inc) => {
              const isSelected = selectedIncident?.id === inc.id;
              return (
                <button
                  key={inc.id}
                  onClick={() => onSelect(inc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: isSelected ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <AlertTriangle size={15} color={inc.status === 'ACTIVE' ? '#ef4444' : '#f97316'} />
                  <span>{inc.user?.name || `Victim #${inc.id.slice(0, 6)}`}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(0,0,0,0.4)',
                      color: 'var(--text-secondary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {inc.triggerType.replace('_', ' ')}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
