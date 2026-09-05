import React from 'react';
import { AlertCircle, CheckCircle2, Radio, Shield, Users, Zap } from 'lucide-react';
import { AdminIncident, AdminUser } from '../services/graphql';

interface AnalyticsCardsProps {
  activeCount: number;
  users: AdminUser[];
  incidents: AdminIncident[];
}

export const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({
  activeCount,
  users,
  incidents,
}) => {
  const volunteerCount = users.filter((u) => u.isVolunteer).length;
  const responderCount = users.filter((u) => u.role === 'RESPONDER').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  const cards = [
    {
      title: 'Active Distress Signals',
      value: activeCount,
      change: activeCount > 0 ? 'Threat Ongoing' : 'Nominal',
      icon: AlertCircle,
      color: activeCount > 0 ? '#ef4444' : '#10b981',
      bgColor: activeCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
    },
    {
      title: 'Active Sentinels (Volunteers)',
      value: volunteerCount,
      change: `${Math.round((volunteerCount / (users.length || 1)) * 100)}% Community Coverage`,
      icon: Radio,
      color: '#06b6d4',
      bgColor: 'rgba(6, 182, 212, 0.12)',
    },
    {
      title: 'Emergency Responders',
      value: responderCount,
      change: 'Active Dispatch Units',
      icon: Shield,
      color: '#6366f1',
      bgColor: 'rgba(99, 102, 241, 0.12)',
    },
    {
      title: 'Resolved Incidents',
      value: resolvedCount,
      change: '100% Audit Logged',
      icon: CheckCircle2,
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.12)',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div key={idx} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                {card.title}
              </span>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: card.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: card.color,
                }}
              >
                <Icon size={20} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-mono)' }}>
                {card.value}
              </span>
              <span style={{ fontSize: '12px', color: card.color, fontWeight: '600' }}>
                {card.change}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
