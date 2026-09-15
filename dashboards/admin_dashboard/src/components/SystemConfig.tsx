import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Check,
  Cpu,
  Mic,
  Radio,
  Send,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { io } from 'socket.io-client';
import {
  GET_SYSTEM_CONFIG,
  UPDATE_SYSTEM_CONFIG,
  SystemConfigData,
  fetchGraphQL,
} from '../services/graphql';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const SystemConfig: React.FC = () => {
  const [screamThreshold, setScreamThreshold] = useState<number>(0.60);
  const [openWakeWordThreshold, setOpenWakeWordThreshold] = useState<number>(0.70);
  const [snatchThresholdG, setSnatchThresholdG] = useState<number>(3.2);
  const [batteryThreshold, setBatteryThreshold] = useState<number>(0.05);
  const [deadmanTimeoutMins, setDeadmanTimeoutMins] = useState<number>(15);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // Load Initial System Config from GraphQL
  useEffect(() => {
    const loadConfig = async () => {
      const data = await fetchGraphQL<{ systemConfig: SystemConfigData }>(GET_SYSTEM_CONFIG);
      if (data?.systemConfig) {
        setScreamThreshold(data.systemConfig.yamnetScreamThreshold);
        setOpenWakeWordThreshold(data.systemConfig.openWakeWordThreshold);
        setSnatchThresholdG(data.systemConfig.snatchThresholdG);
        setBatteryThreshold(data.systemConfig.batteryCriticalThreshold);
        setDeadmanTimeoutMins(data.systemConfig.deadmanTimeoutMins);
        setLastSyncTime(new Date(data.systemConfig.updatedAt).toLocaleTimeString());
      }
    };
    loadConfig();
  }, []);

  const handleBroadcast = async () => {
    setIsSaving(true);
    try {
      // 1. Persist via GraphQL Mutation
      const updated = await fetchGraphQL<{ updateSystemConfig: SystemConfigData }>(
        UPDATE_SYSTEM_CONFIG,
        {
          yamnetScreamThreshold: screamThreshold,
          openWakeWordThreshold: openWakeWordThreshold,
          snatchThresholdG: snatchThresholdG,
          batteryCriticalThreshold: batteryThreshold,
          deadmanTimeoutMins: deadmanTimeoutMins,
        },
      );

      // 2. Broadcast via Socket.IO Mesh to all active citizen devices in the field
      const socket = io(SOCKET_URL);
      const payload = {
        type: 'global_threshold_sync',
        yamnetScreamThreshold: screamThreshold,
        openWakeWordThreshold: openWakeWordThreshold,
        snatchThresholdG: snatchThresholdG,
        batteryCriticalThreshold: batteryThreshold,
        deadmanTimeoutMins: deadmanTimeoutMins,
        updatedAt: new Date().toISOString(),
      };

      socket.emit('system:config_update', payload);

      setLastSyncTime(new Date().toLocaleTimeString());
      setBroadcastStatus(
        `Dynamic Config deployed over WebSocket mesh & GraphQL. Field devices updated in real time.`,
      );
      setTimeout(() => setBroadcastStatus(null), 5000);
    } catch (err) {
      console.error('Broadcast error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--accent-indigo)',
            }}
          >
            <Cpu size={20} color="var(--accent-indigo)" />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '700', letterSpacing: '-0.01em' }}>
              Global Edge ML & Hardware Driver Threshold Tuning
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Broadcast live neural inference floors and sensor sensitivity limits to mobile clients over WebSocket Event Bus.
            </p>
          </div>
        </div>

        {lastSyncTime && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255,255,255,0.04)',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
            }}
          >
            Last Synchronized: {lastSyncTime}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '18px',
        }}
      >
        {/* 1. YAMNet Scream Model Floor */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mic size={15} color="var(--accent-cyan)" />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>YAMNet Scream Confidence</span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent-cyan)',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {(screamThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.95"
              step="0.01"
              value={screamThreshold}
              onChange={(e) => setScreamThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Universal AudioSet classifier floor (Scream index 11, Yell index 9, Crying index 12).
          </p>
        </div>

        {/* 2. openWakeWord Neural Keyword Sensitivity */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} color="#a855f7" />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>openWakeWord Neural Floor</span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: '#c084fc',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {(openWakeWordThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.50"
              max="0.95"
              step="0.01"
              value={openWakeWordThreshold}
              onChange={(e) => setOpenWakeWordThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7', cursor: 'pointer' }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Zero-key keyword spotter sensitivity for "Help Me", "Emergency", and "Hey Guardian".
          </p>
        </div>

        {/* 3. Device Snatch G-Force Vector Delta */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="#f97316" />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>Device Snatch Jerk Spike</span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: '#fb923c',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {snatchThresholdG.toFixed(1)} G
              </span>
            </div>
            <input
              type="range"
              min="1.8"
              max="4.8"
              step="0.1"
              value={snatchThresholdG}
              onChange={(e) => setSnatchThresholdG(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#f97316', cursor: 'pointer' }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Tri-axial accelerometer vector magnitude floor to trigger instant anti-theft SOS.
          </p>
        </div>

        {/* 4. Battery Critical "Last Gasp" Trigger */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BatteryCharging size={15} color="#ef4444" />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>Critical Power Last Gasp</span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: '#f87171',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {(batteryThreshold * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.03"
              max="0.15"
              step="0.01"
              value={batteryThreshold}
              onChange={(e) => setBatteryThreshold(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#ef4444', cursor: 'pointer' }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Depletion threshold to transmit final forensic coordinates and dispatch emergency SMS.
          </p>
        </div>

        {/* 5. Dead Man's Switch Max Expiry */}
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={15} color="#eab308" />
                <span style={{ fontSize: '13px', fontWeight: '700' }}>Dead-Man Expiry Ceiling</span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: '#facc15',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {deadmanTimeoutMins} mins
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={deadmanTimeoutMins}
              onChange={(e) => setDeadmanTimeoutMins(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: '#eab308', cursor: 'pointer' }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Maximum permissible safety timer duration before backend auto-escalates to SOS.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <button
          onClick={handleBroadcast}
          disabled={isSaving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '11px 22px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            border: 'none',
            color: '#fff',
            fontWeight: '700',
            fontSize: '13px',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Send size={15} />
          <span>{isSaving ? 'Broadcasting Over Mesh...' : 'Broadcast Dynamic Config to Field Mesh'}</span>
        </button>

        {broadcastStatus && (
          <div
            style={{
              color: '#34d399',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.12)',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <Check size={14} /> {broadcastStatus}
          </div>
        )}
      </div>
    </div>
  );
};
