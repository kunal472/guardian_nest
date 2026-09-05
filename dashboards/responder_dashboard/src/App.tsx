import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Flame,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Incident,
  fetchIncidents,
  loginDemoResponder,
  updateIncidentStatus,
} from './services/api';
import { getSocket } from './services/socket';
import { LiveAlertBanner } from './components/LiveAlertBanner';
import { IncidentMap } from './components/IncidentMap';
import { IncidentDetail } from './components/IncidentDetail';
import { BreadcrumbLog } from './components/BreadcrumbLog';

export const App: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [liveCoordinates, setLiveCoordinates] = useState<{
    lat: number;
    lng: number;
    batteryLevel?: number;
  } | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ lat: number; lng: number; batteryLevel?: number; loggedAt: string }>
  >([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize Auth & Initial Data
  useEffect(() => {
    loginDemoResponder().then((res) => {
      if (res?.token) {
        setToken(res.token);
        loadIncidents(res.token);
      }
    });
  }, []);

  const loadIncidents = async (authToken?: string) => {
    const data = await fetchIncidents(authToken || token);
    if (data && data.length > 0) {
      setIncidents(data);
      if (!selectedIncident) {
        const active = data.find((i) => i.status === 'ACTIVE') || data[0];
        setSelectedIncident(active);
        if (active.locationLogs) {
          setBreadcrumbs(active.locationLogs);
        }
      }
    }
  };

  // Connect to Socket.io Real-Time Event Bus
  useEffect(() => {
    const socket = getSocket(token);

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Listen for new distress triggers
    socket.on('nearby:broadcast', (alert: any) => {
      console.log('🚨 New Distress Alert received via Socket.io:', alert);
      loadIncidents();
    });

    socket.on('incident:new', (newInc: Incident) => {
      setIncidents((prev) => [newInc, ...prev.filter((i) => i.id !== newInc.id)]);
      setSelectedIncident(newInc);
    });

    // Listen for live GPS coordinate updates (1 ping/sec throttled)
    socket.on('location:update', (loc: any) => {
      if (selectedIncident && loc.incidentId === selectedIncident.id) {
        setLiveCoordinates({
          lat: loc.lat,
          lng: loc.lng,
          batteryLevel: loc.batteryLevel,
        });
        setBreadcrumbs((prev) => [
          ...prev,
          {
            lat: loc.lat,
            lng: loc.lng,
            batteryLevel: loc.batteryLevel,
            loggedAt: loc.timestamp || new Date().toISOString(),
          },
        ]);
      }
    });

    // Listen for responder status updates
    socket.on('responder:status_changed', (payload: any) => {
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.id === payload.incidentId ? { ...inc, status: payload.status } : inc,
        ),
      );
      if (selectedIncident?.id === payload.incidentId) {
        setSelectedIncident((prev) => prev ? { ...prev, status: payload.status } : null);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('nearby:broadcast');
      socket.off('incident:new');
      socket.off('location:update');
      socket.off('responder:status_changed');
    };
  }, [token, selectedIncident]);

  const handleSelectIncident = (inc: Incident) => {
    setSelectedIncident(inc);
    if (inc.locationLogs) {
      setBreadcrumbs(inc.locationLogs);
    }
    const socket = getSocket(token);
    socket.emit('join:incident', { incidentId: inc.id });
  };

  const handleStatusChange = async (newStatus: 'DISPATCHED' | 'RESOLVED' | 'FALSE_ALARM') => {
    if (!selectedIncident) return;
    setIsLoading(true);

    const socket = getSocket(token);
    socket.emit('responder:status_change', {
      incidentId: selectedIncident.id,
      status: newStatus,
      estimatedArrivalMins: 4,
    });

    const updated = await updateIncidentStatus(selectedIncident.id, newStatus, token);
    if (updated) {
      setSelectedIncident(updated);
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    }
    setIsLoading(false);
  };

  // Mock Distress Trigger to simulate live SOS signal
  const simulateLiveDistress = () => {
    const socket = getSocket(token);
    const mockLat = 40.7128 + (Math.random() - 0.5) * 0.01;
    const mockLng = -74.006 + (Math.random() - 0.5) * 0.01;

    socket.emit('distress:triggered', {
      lat: mockLat,
      lng: mockLng,
      triggerType: 'AUDIO_SCREAM',
      batteryLevel: 88,
    });
  };

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter === 'ALL') return true;
    return inc.status === statusFilter;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Top Header Bar */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
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
              background: 'linear-gradient(135deg, #ef4444, #991b1b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
            }}
          >
            <Shield size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.02em' }}>
              GUARDIAN <span style={{ color: 'var(--accent-red)' }}>DISPATCH CENTRAL</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span>Responder Incident Stream</span>
              <span>•</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>Fastify NestJS + Redis GEO Mesh</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Connection Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: isConnected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: isConnected ? '1px solid #10b981' : '1px solid #ef4444',
              color: isConnected ? '#34d399' : '#f87171',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isConnected ? 'Event Bus Connected' : 'Connecting to Gateway...'}</span>
          </div>

          <button
            onClick={simulateLiveDistress}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: '#fff',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            }}
          >
            <Flame size={15} />
            <span>Simulate Incoming SOS</span>
          </button>

          <button
            onClick={() => loadIncidents()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      {/* Real-time Alert Banner Feed */}
      <LiveAlertBanner
        activeIncidents={incidents}
        selectedIncident={selectedIncident}
        onSelect={handleSelectIncident}
      />

      {/* Main Grid Layout: Map + Controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '20px' }}>
        {/* Left Column: Map + Breadcrumbs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <IncidentMap
            incident={selectedIncident}
            liveCoordinates={liveCoordinates}
            breadcrumbLogs={breadcrumbs}
          />

          <BreadcrumbLog logs={breadcrumbs} />
        </div>

        {/* Right Column: Incident Detail & Filtered Incident List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <IncidentDetail
            incident={selectedIncident}
            onStatusChange={handleStatusChange}
            isLoading={isLoading}
          />

          {/* Incident Queue List */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>Incident Roster</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['ALL', 'ACTIVE', 'DISPATCHED', 'RESOLVED'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      background: statusFilter === f ? 'var(--accent-red)' : 'rgba(255,255,255,0.05)',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '280px' }}>
              {filteredIncidents.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  No incidents in this queue.
                </div>
              ) : (
                filteredIncidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => handleSelectIncident(inc)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                        border: isSelected ? '1px solid #ef4444' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>
                          {inc.user?.name || `Victim #${inc.id.slice(0, 6)}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {inc.triggerType.replace('_', ' ')} • {new Date(inc.startedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '4px',
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
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
