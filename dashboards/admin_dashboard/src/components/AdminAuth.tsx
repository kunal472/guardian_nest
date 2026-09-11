import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Phone,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { loginAdmin, registerAdmin, AdminAuthUser } from '../services/auth';

interface AdminAuthProps {
  onAuthSuccess: (user: AdminAuthUser, token: string) => void;
}

export const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [adminPasscode, setAdminPasscode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!phone.trim() || !password.trim()) {
      setErrorMsg('Please enter both phone number and password.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMsg('Please provide the full administrator name.');
        return;
      }
      if (adminPasscode.trim() !== 'GUARDIAN_ROOT_2026') {
        setErrorMsg('Invalid Admin Clearance Key. Contact system supervisor for root authorization.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginAdmin(phone.trim(), password);
        setSuccessMsg(`Welcome back, Commander ${res.user.name || 'Admin'}!`);
        setTimeout(() => onAuthSuccess(res.user, res.token), 600);
      } else {
        const res = await registerAdmin(phone.trim(), password, name.trim());
        setSuccessMsg(`Administrator ${res.user.name} provisioned with Level-3 Clearance.`);
        setTimeout(() => onAuthSuccess(res.user, res.token), 600);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setPhone('+18005550199');
    setPassword('admin_root_secure');
    if (mode === 'register') {
      setName('Chief Security Officer');
      setAdminPasscode('GUARDIAN_ROOT_2026');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, #111827 0%, #030712 100%)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Cyber Grid Lines */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            'linear-gradient(rgba(99, 102, 241, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-panel-indigo"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px',
          borderRadius: '16px',
          background: 'rgba(15, 23, 42, 0.85)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(99, 102, 241, 0.25)',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Header Badge */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1, #312e81)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: '0 0 25px rgba(99, 102, 241, 0.5)',
            }}
          >
            <Shield size={30} color="#fff" />
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              color: '#f8fafc',
            }}
          >
            GUARDIAN <span style={{ color: 'var(--accent-indigo)' }}>COMMAND</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {mode === 'login'
              ? 'Enter administrator credentials to access command hub'
              : 'Provision a new high-clearance administrator profile'}
          </p>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(30, 41, 59, 0.6)',
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
              background: mode === 'login' ? 'var(--accent-indigo)' : 'transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'login' ? '0 2px 10px rgba(99, 102, 241, 0.4)' : 'none',
            }}
          >
            Admin Sign In
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
              background: mode === 'register' ? 'var(--accent-indigo)' : 'transparent',
              color: mode === 'register' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: mode === 'register' ? '0 2px 10px rgba(99, 102, 241, 0.4)' : 'none',
            }}
          >
            Register Admin
          </button>
        </div>

        {/* Error / Success Feedback */}
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
                Administrator Full Name
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0 12px',
                }}
              >
                <User size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="e.g. Commander Sarah Jenkins"
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
              Registered Phone Identifier
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0 12px',
              }}
            >
              <Phone size={16} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="+1 (555) 000-0000"
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
              Security Password
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
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
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--accent-indigo)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <KeyRound size={13} />
                  Master Clearance Key
                </label>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Required for Role: ADMIN</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid var(--border-active)',
                  borderRadius: '8px',
                  padding: '0 12px',
                }}
              >
                <ShieldCheck size={16} color="var(--accent-indigo)" />
                <input
                  type="text"
                  placeholder="Enter GUARDIAN_ROOT_2026"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 10px',
                    background: 'transparent',
                    border: 'none',
                    color: '#a5b4fc',
                    fontSize: '13px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                  required={mode === 'register'}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '10px',
              padding: '13px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
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
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
          >
            {isLoading ? (
              <span>Authenticating Clearance...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Authorize Session' : 'Create Admin Clearance'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Pre-fill */}
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
            onClick={fillDemoAdmin}
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
              transition: 'background 0.2s',
            }}
          >
            <Zap size={13} color="var(--accent-amber)" />
            <span>Pre-fill Sample Credentials</span>
          </button>

          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Guardian Nest v1.0
          </span>
        </div>
      </div>
    </div>
  );
};
