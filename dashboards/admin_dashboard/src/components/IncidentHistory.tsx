import React from 'react';
import { AlertOctagon, CheckCircle2, Clock, MapPin } from 'lucide-react';
import { AdminIncident } from '../services/graphql';

interface IncidentHistoryProps {
  incidents: AdminIncident[];
  onResolve: (incidentId: string, status: 'RESOLVED' | 'FALSE_ALARM') => void;
}

export const IncidentHistory: React.FC<IncidentHistoryProps> = ({ incidents, onResolve }) => {
  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Incident Audit Log & Resolution Ledger</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            GraphQL Query: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>incidents &#123; id, triggerType, status, locationLogs &#125;</span>
          </p>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {incidents.length} Records
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Incident ID</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Trigger Type</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Status</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>GPS Pings</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Started At</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Resolution</th>
            </tr>
          </thead>
          <tbody>
            {incidents.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No incident logs recorded.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => (
                <tr
                  key={inc.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-indigo)' }}>
                    #{inc.id.slice(0, 8)}
                  </td>

                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                      <AlertOctagon size={14} color="#f97316" />
                      <span>{inc.triggerType.replace('_', ' ')}</span>
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '600',
                        background:
                          inc.status === 'ACTIVE'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : inc.status === 'DISPATCHED'
                            ? 'rgba(249, 115, 22, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)',
                        color:
                          inc.status === 'ACTIVE'
                            ? '#f87171'
                            : inc.status === 'DISPATCHED'
                            ? '#fb923c'
                            : '#34d399',
                      }}
                    >
                      {inc.status}
                    </span>
                  </td>

                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      <MapPin size={13} color="var(--accent-cyan)" />
                      <span>{inc.locationLogs?.length || 0} pings</span>
                    </div>
                  </td>

                  <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>{new Date(inc.startedAt).toLocaleString()}</span>
                    </div>
                  </td>

                  <td style={{ padding: '12px' }}>
                    {inc.status === 'ACTIVE' || inc.status === 'DISPATCHED' ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => onResolve(inc.id, 'RESOLVED')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid #10b981',
                            color: '#34d399',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => onResolve(inc.id, 'FALSE_ALARM')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'rgba(148, 163, 184, 0.1)',
                            border: '1px solid rgba(148, 163, 184, 0.3)',
                            color: '#94a3b8',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Resolved: {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString() : 'N/A'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
