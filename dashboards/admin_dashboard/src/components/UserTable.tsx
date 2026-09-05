import React from 'react';
import { Shield, User, UserCheck, ShieldAlert } from 'lucide-react';
import { AdminUser } from '../services/graphql';

interface UserTableProps {
  users: AdminUser[];
  onRoleChange: (userId: string, newRole: 'USER' | 'RESPONDER' | 'ADMIN') => void;
}

export const UserTable: React.FC<UserTableProps> = ({ users, onRoleChange }) => {
  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>User & Volunteer Identity Governance</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            GraphQL Query: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)' }}>users &#123; id, role, isVolunteer, mlSensitivity &#125;</span>
          </p>
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {users.length} Users Registered
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Name & Contact</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Role Access</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Sentinel Mesh</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>ML Sensitivity</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Incidents</th>
              <th style={{ padding: '10px 12px', fontWeight: '600' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No users found in database.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{u.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {u.phone}
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
                          u.role === 'ADMIN'
                            ? 'rgba(99, 102, 241, 0.2)'
                            : u.role === 'RESPONDER'
                            ? 'rgba(249, 115, 22, 0.2)'
                            : 'rgba(148, 163, 184, 0.15)',
                        color:
                          u.role === 'ADMIN'
                            ? '#818cf8'
                            : u.role === 'RESPONDER'
                            ? '#fb923c'
                            : '#94a3b8',
                      }}
                    >
                      {u.role}
                    </span>
                  </td>

                  <td style={{ padding: '12px' }}>
                    {u.isVolunteer ? (
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        <UserCheck size={14} /> Active Sentinel
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Standard</span>
                    )}
                  </td>

                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'var(--font-mono)',
                        background: 'rgba(255,255,255,0.05)',
                        color: u.mlSensitivity === 'HIGH' ? '#f43f5e' : '#f8fafc',
                      }}
                    >
                      {u.mlSensitivity}
                    </span>
                  </td>

                  <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                    {u.incidents?.length || 0}
                  </td>

                  <td style={{ padding: '12px' }}>
                    <select
                      value={u.role}
                      onChange={(e) => onRoleChange(u.id, e.target.value as any)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-color)',
                        color: '#f8fafc',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="USER" style={{ background: '#111722' }}>Set USER</option>
                      <option value="RESPONDER" style={{ background: '#111722' }}>Set RESPONDER</option>
                      <option value="ADMIN" style={{ background: '#111722' }}>Set ADMIN</option>
                    </select>
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
