import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle,
  Database,
  Layers,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import {
  AdminIncident,
  AdminUser,
  GET_DASHBOARD_DATA,
  RESOLVE_INCIDENT,
  UPDATE_USER_ROLE,
  fetchGraphQL,
} from './services/graphql';
import { AnalyticsCards } from './components/AnalyticsCards';
import { UserTable } from './components/UserTable';
import { IncidentHistory } from './components/IncidentHistory';
import { SystemConfig } from './components/SystemConfig';

export const App: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [incidents, setIncidents] = useState<AdminIncident[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'incidents' | 'config'>('overview');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = async () => {
    setIsRefreshing(true);
    const data = await fetchGraphQL<{
      activeIncidentsCount: number;
      users: AdminUser[];
      incidents: AdminIncident[];
    }>(GET_DASHBOARD_DATA);

    if (data) {
      setActiveCount(data.activeIncidentsCount || 0);
      setUsers(data.users || []);
      setIncidents(data.incidents || []);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s GraphQL poll for admin analytics
    return () => clearInterval(interval);
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'USER' | 'RESPONDER' | 'ADMIN') => {
    await fetchGraphQL(UPDATE_USER_ROLE, { userId, role: newRole });
    loadData();
  };

  const handleResolveIncident = async (incidentId: string, status: 'RESOLVED' | 'FALSE_ALARM') => {
    await fetchGraphQL(RESOLVE_INCIDENT, { incidentId, status });
    loadData();
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Admin Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #312e81)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Shield size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em' }}>
              GUARDIAN <span style={{ color: 'var(--accent-indigo)' }}>ADMIN INTELLIGENCE</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>GraphQL Analytics Portal</span>
              <span>•</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Fastify NestJS + Apollo / Mercurius Engine</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => loadData()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Query GraphQL</span>
          </button>
        </div>
      </header>

      {/* Analytics KPI Metric Cards */}
      <AnalyticsCards activeCount={activeCount} users={users} incidents={incidents} />

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        {[
          { id: 'overview', label: 'Executive Overview', icon: Layers },
          { id: 'users', label: 'User & Volunteer Directory', icon: Users },
          { id: 'incidents', label: 'Incident Audit Trail', icon: Activity },
          { id: 'config', label: 'Edge ML Thresholds', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: isActive ? '1px solid var(--accent-indigo)' : '1px solid transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SystemConfig />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            <IncidentHistory incidents={incidents} onResolve={handleResolveIncident} />
            <UserTable users={users} onRoleChange={handleRoleChange} />
          </div>
        </div>
      )}

      {activeTab === 'users' && <UserTable users={users} onRoleChange={handleRoleChange} />}
      {activeTab === 'incidents' && <IncidentHistory incidents={incidents} onResolve={handleResolveIncident} />}
      {activeTab === 'config' && <SystemConfig />}
    </div>
  );
};

export default App;
