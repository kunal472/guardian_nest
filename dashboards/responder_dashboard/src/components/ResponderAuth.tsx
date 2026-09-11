import React, { useState } from 'react';
import {
  Radio,
  Lock,
  Phone,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Shield,
  HeartHandshake,
  Zap,
  Activity,
} from 'lucide-react';
import { loginResponder, registerResponder, ResponderUser } from '../services/auth';

interface ResponderAuthProps {
  onAuthSuccess: (user: ResponderUser, token: string) => void;
}

export const ResponderAuth: React.FC<ResponderAuthProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [isVolunteer, setIsVolunteer] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!phone.trim() || !password.trim()) {
      setErrorMsg('Please provide your registered phone number and credentials.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setErrorMsg('Please specify responder call-sign or full identity.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginResponder(phone.trim(), password);
        setSuccessMsg(`Dispatch Verified: Unit ${res.user.name || res.user.phone} active.`);
        setTimeout(() => onAuthSuccess(res.user, res.token), 600);
      } else {
        const res = await registerResponder(phone.trim(), password, name.trim(), isVolunteer);
        setSuccessMsg(`Unit ${res.user.name} enlisted in Emergency Response Matrix.`);
        setTimeout(() => onAuthSuccess(res.user, res.token), 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please check dispatch registry.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoResponder = () => {
    setPhone('+1999888777');
    setPassword('password123');
    if (mode === 'register') {
      setName('Dispatch Central Alpha');
      setIsVolunteer(true);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at top, #18090d 0%, #080305 60%, #000000 100%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radar Pulse Background Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(244, 63, 94, 0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '36px',
          borderRadius: '16px',
          background: 'rgba(19, 13, 17, 0.88)',
          border: '1px solid rgba(244, 63, 94, 0.35)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px rgba(244, 63, 94, 0.2)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Tactical Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #f43f5e, #9f1239)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 0 30px rgba(244, 63, 94, 0.6)',
            }}
          >
            <Radio size={28} color="#fff" />
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fda4af',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: '10px',
            }}
          >
            <Activity size={12} className="animate-pulse" />
            <span>DISPATCH CAD // TACTICAL HUD</span>
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              color: '#f8fafc',
            }}
          >
            RESPONDER <span style={{ color: '#f43f5e' }}>TERMINAL</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {mode === 'login'
              ? 'Authenticate unit call-sign to monitor live emergency beacons'
              : 'Enlist certified emergency responder or community volunteer'}
          </p>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(30, 20, 24, 0.7)',
            borderRadius: '10px',
            padding: '4px',
            marginBottom: '24px',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mode === 'login' ? '#f43f5e' : 'transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'login' ? '0 2px 12px rgba(244, 63, 94, 0.45)' : 'none',
            }}
          >
            Responder Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px 0',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mode === 'register' ? '#f43f5e' : 'transparent',
              color: mode === 'register' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'register' ? '0 2px 12px rgba(244, 63, 94, 0.45)' : 'none',
            }}
          >
            Enlist Unit
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fca5a5',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '18px',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#86efac',
              padding: '12px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '18px',
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'register' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '6px',
                }}
              >
                Unit Call-Sign / Full Name
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(20, 15, 20, 0.6)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0 12px',
                }}
              >
                <User size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="e.g. Unit 4-Echo / Sarah Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  required={mode === 'register'}
                />
              </div>
            </div>
          )}

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              Comms Phone Number
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(20, 15, 20, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0 12px',
              }}
            >
              <Phone size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="+1 (999) 888-777"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 10px',
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '14px',
                  outline: 'none',
                }}
                required
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '6px',
              }}
            >
              Security Passkey
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(20, 15, 20, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0 12px',
              }}
            >
              <Lock size={16} color="var(--text-muted)" />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 10px',
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '14px',
                  outline: 'none',
                }}
                required
              />
            </div>
          </div>

          {mode === 'register' && (
            <div
              onClick={() => setIsVolunteer(!isVolunteer)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={isVolunteer}
                onChange={() => {}}
                style={{ accentColor: '#f43f5e', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fda4af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HeartHandshake size={14} /> Active Proximity Volunteer
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Eligible for auto-dispatch within 500m geofence radius
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '8px',
              padding: '13px',
              background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(244, 63, 94, 0.5)',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
          >
            {isLoading ? (
              <span>Authenticating Unit...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Connect to Dispatch Bus' : 'Register & Deploy Unit'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Pre-fill */}
        <div
          style={{
            marginTop: '24px',
            paddingTop: '18px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={fillDemoResponder}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={13} color="#f59e0b" />
            <span>Pre-fill Sample Responder</span>
          </button>

          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            CAD Matrix v1.0
          </span>
        </div>
      </div>
    </div>
  );
};
