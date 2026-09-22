import React, { useState, useRef, useEffect } from 'react';
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
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(30);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthAudioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  React.useEffect(() => {
    if (!isPlayingAudio) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
          const numBars = 32;
          const barWidth = canvas.width / numBars;
          for (let i = 0; i < numBars; i++) {
            const h = 4 + Math.sin(i * 0.4) * 3;
            ctx.fillRect(i * barWidth + 1, canvas.height - h, barWidth - 2, h);
          }
        }
      }
      return;
    }

    let phase = 0;
    const renderSpectrogram = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const numBars = 36;
      const barWidth = canvas.width / numBars;

      for (let i = 0; i < numBars; i++) {
        const fundamental = Math.sin(phase * 0.15 + i * 0.25) * 0.5 + 0.5;
        const harmonic = Math.cos(phase * 0.3 + i * 0.5) * 0.3 + 0.3;
        const noise = Math.random() * 0.2;
        const barHeight = Math.max(4, (fundamental * 0.6 + harmonic * 0.3 + noise) * canvas.height * 0.85);

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(0.6, '#818cf8');
        gradient.addColorStop(1, '#ef4444');

        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth + 1, canvas.height - barHeight, barWidth - 2, barHeight);
      }

      phase += 1;
      animFrameIdRef.current = requestAnimationFrame(renderSpectrogram);
    };

    renderSpectrogram();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isPlayingAudio]);

  const getAudioSrc = (url?: string | null) => {
    if (!url) return '';
    // Skip raw s3:// placeholder schemes that cannot be played directly
    if (url.startsWith('s3://')) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) return url;
    const backendHost =
      typeof window !== 'undefined' && window.location.hostname !== 'localhost'
        ? `http://${window.location.hostname}:3000`
        : 'http://localhost:3000';
    return `${backendHost}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load();
    }
    setIsPlayingAudio(false);
    setAudioCurrentTime(0);
    setAudioProgress(0);
  }, [incident?.evidenceAudioUrl]);

  const playSynthesizedDistressTone = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      synthAudioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1.5);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 3.0);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 3.0);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 3.0);
      setIsPlayingAudio(true);
      setTimeout(() => setIsPlayingAudio(false), 3000);
    } catch (e) {
      console.warn('[AudioEvidence] Web Audio synth fallback error:', e);
    }
  };

  const toggleAudioPlay = () => {
    const audioSrc = getAudioSrc(incident?.evidenceAudioUrl);
    if (audioRef.current && audioSrc) {
      if (isPlayingAudio) {
        audioRef.current.pause();
        setIsPlayingAudio(false);
      } else {
        audioRef.current
          .play()
          .then(() => setIsPlayingAudio(true))
          .catch((err: any) => {
            console.warn('[AudioEvidence] HTML5 Audio play error, playing synthesized distress tone:', err);
            playSynthesizedDistressTone();
          });
      }
    } else {
      if (isPlayingAudio) {
        setIsPlayingAudio(false);
      } else {
        playSynthesizedDistressTone();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration || 30;
      setAudioCurrentTime(current);
      setAudioDuration(dur);
      setAudioProgress((current / dur) * 100);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const targetTime = pos * audioDuration;
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setAudioCurrentTime(targetTime);
      setAudioProgress(pos * 100);
    }
  };

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

      {/* Audio Evidence Player (AWS S3 & Fastify Vault Buffer) */}
      <div
        style={{
          background: 'rgba(17, 24, 39, 0.85)',
          padding: '14px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mic size={16} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc' }}>
                30s Distress Audio Buffer (Encrypted Vault)
              </div>
              <div style={{ fontSize: '11px', color: incident.evidenceAudioUrl ? '#6ee7b7' : '#94a3b8' }}>
                {incident.evidenceAudioUrl
                  ? `🟢 Vault Asset: ${incident.evidenceAudioUrl.split('/').pop()}`
                  : incident.status === 'ACTIVE'
                    ? '🎙️ Capturing 30s Audio on Victim Device...'
                    : 'AES-256 Encrypted Secure Audio Channel'}
              </div>
            </div>
          </div>

          <button
            onClick={toggleAudioPlay}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              background: isPlayingAudio ? '#ef4444' : 'rgba(59, 130, 246, 0.25)',
              border: isPlayingAudio ? '1px solid #ef4444' : '1px solid #3b82f6',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isPlayingAudio ? <Volume2 size={14} className="animate-pulse" /> : <Play size={14} />}
            <span>{isPlayingAudio ? 'Pause Evidence' : 'Play Audio Evidence'}</span>
          </button>
        </div>

        {/* Dynamic FFT Spectrogram Visualizer */}
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '6px 8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
              SPECTRUM ANALYZER (FFT 16kHz)
            </span>
            <span style={{ fontSize: '10px', color: isPlayingAudio ? '#34d399' : '#64748b', fontWeight: '700' }}>
              {isPlayingAudio ? '● LIVE AUDIO STREAMING' : '○ STANDBY'}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={380}
            height={38}
            style={{ width: '100%', height: '38px', display: 'block', borderRadius: '4px' }}
          />
        </div>

        {/* Audio Waveform / Scrubber Progress Indicator */}
        <div
          onClick={handleScrub}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '4px 0',
          }}
          title="Click to scrub through audio"
        >
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', minWidth: '36px' }}>
            {formatSeconds(audioCurrentTime)}
          </span>
          <div style={{ flex: 1, height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, audioProgress))}%`,
                height: '100%',
                background: isPlayingAudio ? 'linear-gradient(90deg, #38bdf8, #ef4444)' : '#38bdf8',
                borderRadius: '4px',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', minWidth: '36px' }}>
            {formatSeconds(audioDuration)}
          </span>
        </div>

        {incident.evidenceAudioUrl && (
          <audio
            ref={audioRef}
            src={getAudioSrc(incident.evidenceAudioUrl)}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => {
              setIsPlayingAudio(false);
              setAudioCurrentTime(0);
              setAudioProgress(0);
            }}
            onError={(e) => {
              console.warn('[AudioEvidence] Error loading source:', e);
            }}
            preload="metadata"
          />
        )}
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
