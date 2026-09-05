import React, { useState } from 'react';
import { Broadcast, Check, Cpu, Radio, Send, Settings, Sliders } from 'lucide-react';
import { io } from 'socket.io-client';

export const SystemConfig: React.FC = () => {
  const [screamThreshold, setScreamThreshold] = useState<number>(0.85);
  const [snatchSensitivity, setSnatchSensitivity] = useState<number>(0.75);
  const [deadmanTimeoutMins, setDeadmanTimeoutMins] = useState<number>(15);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const handleBroadcast = () => {
    try {
      const socket = io('http://localhost:3000');
      socket.emit('system:config_update', {
        type: 'ml_threshold_update',
        newWeights: {
          scream_confidence: screamThreshold,
          snatch_sensitivity: snatchSensitivity,
          deadman_timeout_minutes: deadmanTimeoutMins,
        },
      });
      setBroadcastStatus('Config broadcasted globally via Event Bus (events.system.configuration_update)');
      setTimeout(() => setBroadcastStatus(null), 4000);
    } catch (err) {
      console.error('Broadcast error:', err);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <Cpu size={18} color="var(--accent-indigo)" />
        <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Global Edge Intelligence & Threshold Tuning</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Scream Detection Threshold */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Acoustic Scream Model (YAMNet)</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '13px' }}>
              {(screamThreshold * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="0.99"
            step="0.01"
            value={screamThreshold}
            onChange={(e) => setScreamThreshold(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Dual-thread AudioWorklet inference confidence floor for scream trigger.
          </p>
        </div>

        {/* Device Snatch Accelerometry */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Device Snatch Velocity Delta</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '13px' }}>
              {(snatchSensitivity * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.3"
            max="0.95"
            step="0.01"
            value={snatchSensitivity}
            onChange={(e) => setSnatchSensitivity(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Tri-axial accelerometer peak jerk vector threshold to trigger zero-touch alert.
          </p>
        </div>

        {/* Dead Man's Switch Max Timeout */}
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600' }}>Dead Man's Switch Max Expiry</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '13px' }}>
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
            style={{ width: '100%', accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Maximum allowable countdown timer before backend cron triggers automatic SOS.
          </p>
        </div>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={handleBroadcast}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            border: 'none',
            color: '#fff',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Send size={15} />
          <span>Broadcast Config Over WebSocket Mesh</span>
        </button>

        {broadcastStatus && (
          <span style={{ color: '#34d399', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Check size={14} /> {broadcastStatus}
          </span>
        )}
      </div>
    </div>
  );
};
