import React, { useState } from 'react';
import {
  AlertOctagon,
  BatteryWarning,
  CheckCircle,
  Clock,
  Mic,
  Phone,
  Play,
  Send,
  Shield,
  UserCheck,
  Volume2,
  WifiOff,
  XCircle,
} from 'lucide-react';
import { Incident } from '../services/api';

interface IncidentDetailProps {
  incident: Incident | null;
  onStatusChange: (status: 'DISPATCHED' | 'RESOLVED' | 'FALSE_ALARM') => void;
  isLoading: boolean;
}

export const IncidentDetail: React.FC<IncidentDetailProps> = ({
  incident,
  onStatusChange,
  isLoading,
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  if (!incident) {
    return (
      <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Shield size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
        <h3>Select an Active Incident</h3>
        <p style={{ fontSize: '13px', marginTop: '4px' }}>
          Select any distress signal from the top feed to inspect details and dispatch responders.
        </p>
      </div>
    );
  }

  const latestBattery = incident.locationLogs?.[incident.locationLogs.length - 1]?.batteryLevel;
  const isCriticalBattery = latestBattery !== undefined && latestBattery <= 10;

  const triggerColorMap: Record<string, string> = {
    MANUAL_SOS: '#ef4444',
    AUDIO_SCREAM: '#f97316',
    DEVICE_SNATCH: '#eab308',
    DEAD_MAN_SWITCH: '#a855f7',
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="badge-active" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>ACTIVE SOS</span>;
      case 'DISPATCHED':
        return <span className="badge-dispatched" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>UNIT DISPATCHED</span>;
      case 'RESOLVED':
        return <span className="badge-resolved" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>RESOLVED</span>;
      default:
        return <span className="badge-false-alarm" style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>FALSE ALARM</span>;
    }
  };

  return (
    <div className="glass-panel-glow" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Critical Battery Last Gasp Notice */}
      {isCriticalBattery && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.25)',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <BatteryWarning size={20} color="#f87171" className="animate-pulse" />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#fca5a5' }}>
              CRITICAL BATTERY &quot;LAST GASP&quot; ({latestBattery}%)
            </div>
            <div style={{ fontSize: '11px', color: '#fecaca' }}>
              Victim&apos;s device power is depleting. Last known coordinates are pinned as highest-confidence beacon.
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{incident.user?.name || 'Victim Profile'}</h3>
            {getStatusBadge(incident.status)}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            INCIDENT ID: {incident.id}
          </p>
        </div>

        <div
          style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Clock size={13} color="var(--accent-cyan)" />
          <span>{new Date(incident.startedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Victim & Contact Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Contact Number
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '14px', fontWeight: '600' }}>
            <Phone size={14} color="#10b981" />
            <span>{incident.user?.phone || '+1 (555) 234-5678'}</span>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
            Edge ML Trigger Origin
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '13px', fontWeight: '700', color: triggerColorMap[incident.triggerType] || '#ef4444' }}>
            <AlertOctagon size={15} />
            <span>{incident.triggerType.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Audio Evidence Player (AWS S3 Presigned URL Vault) */}
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.7)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mic size={16} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600' }}>30s Encrypted Audio Buffer</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>S3 Vault Presigned Key (AES-256)</div>
          </div>
        </div>

        <button
          onClick={() => setIsPlayingAudio(!isPlayingAudio)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '6px',
            background: isPlayingAudio ? '#ef4444' : 'rgba(59, 130, 246, 0.2)',
            border: isPlayingAudio ? '1px solid #ef4444' : '1px solid #3b82f6',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {isPlayingAudio ? <Volume2 size={14} className="animate-pulse" /> : <Play size={14} />}
          <span>{isPlayingAudio ? 'Listening...' : 'Play Audio'}</span>
        </button>
      </div>

      {/* Dispatch Action Controls */}
      <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
          Responder Status Actions
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {incident.status === 'ACTIVE' && (
            <button
              disabled={isLoading}
              onClick={() => onStatusChange('DISPATCHED')}
              style={{
                gridColumn: 'span 2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(249, 115, 22, 0.4)',
              }}
            >
              <Send size={16} />
              <span>Dispatch Emergency Response Unit</span>
            </button>
          )}

          {incident.status === 'DISPATCHED' && (
            <button
              disabled={isLoading}
              onClick={() => onStatusChange('RESOLVED')}
              style={{
                gridColumn: 'span 2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              }}
            >
              <CheckCircle size={16} />
              <span>Mark Threat Resolved & Safe</span>
            </button>
          )}

          <button
            disabled={isLoading || incident.status === 'RESOLVED'}
            onClick={() => onStatusChange('RESOLVED')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <UserCheck size={15} />
            <span>Resolve</span>
          </button>

          <button
            disabled={isLoading || incident.status === 'FALSE_ALARM'}
            onClick={() => onStatusChange('FALSE_ALARM')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              borderRadius: '8px',
              background: 'rgba(148, 163, 184, 0.1)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              color: '#94a3b8',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            <XCircle size={15} />
            <span>False Alarm</span>
          </button>
        </div>
      </div>
    </div>
  );
};
