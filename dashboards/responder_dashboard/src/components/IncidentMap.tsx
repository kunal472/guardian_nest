import React, { useEffect, useRef } from 'react';
import { Crosshair, MapPin, Navigation, Radio, Shield, ZoomIn, ZoomOut } from 'lucide-react';
import { Incident } from '../services/api';

interface IncidentMapProps {
  incident: Incident | null;
  liveCoordinates: { lat: number; lng: number; batteryLevel?: number } | null;
  breadcrumbLogs: Array<{ lat: number; lng: number; loggedAt: string }>;
}

export const IncidentMap: React.FC<IncidentMapProps> = ({
  incident,
  liveCoordinates,
  breadcrumbLogs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentLat = liveCoordinates?.lat ?? incident?.locationLogs?.[incident.locationLogs.length - 1]?.lat ?? 40.7128;
  const currentLng = liveCoordinates?.lng ?? incident?.locationLogs?.[incident.locationLogs.length - 1]?.lng ?? -74.006;

  // Render tactical grid map canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#0b111e';
    ctx.fillRect(0, 0, width, height);

    // Draw tactical grid
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const centerX = width / 2;
    const centerY = height / 2;

    // Draw concentric radar range rings (500m volunteer geofence, 1km, 2km)
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
    ctx.setLineDash([4, 4]);
    [80, 160, 240].forEach((r, idx) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.font = '10px JetBrains Mono';
      ctx.fillText(`${(idx + 1) * 250}m Mesh`, centerX + r - 55, centerY - 8);
    });
    ctx.setLineDash([]);

    // Draw Breadcrumb Path if logs exist
    if (breadcrumbLogs.length > 1) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      breadcrumbLogs.forEach((log, idx) => {
        // Calculate offset relative to center
        const offsetX = (log.lng - currentLng) * 15000;
        const offsetY = -(log.lat - currentLat) * 15000;
        const ptX = centerX + offsetX;
        const ptY = centerY + offsetY;

        if (idx === 0) ctx.moveTo(ptX, ptY);
        else ctx.lineTo(ptX, ptY);

        // Draw intermediate breadcrumb dot
        ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.beginPath();
        ctx.arc(ptX, ptY, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.stroke();
    }

    // Draw Nearby Sentinels / Volunteer Icons (Simulated Mesh nodes)
    const meshNodes = [
      { x: centerX - 90, y: centerY + 60, name: 'Volunteer #402' },
      { x: centerX + 110, y: centerY - 70, name: 'Volunteer #119' },
      { x: centerX - 50, y: centerY - 100, name: 'Patrol Car #12' },
    ];

    meshNodes.forEach((node) => {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px Inter';
      ctx.fillText(node.name, node.x + 8, node.y + 3);
    });

    // Draw Victim Target Indicator at Center
    if (incident) {
      // Outer pulse glow
      const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 35);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 35, 0, Math.PI * 2);
      ctx.fill();

      // Center marker
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crosshairs
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 15, centerY);
      ctx.lineTo(centerX + 15, centerY);
      ctx.moveTo(centerX, centerY - 15);
      ctx.lineTo(centerX, centerY + 15);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 12px Inter';
      ctx.fillText(incident.user?.name || 'Victim', centerX + 16, centerY - 6);
    }
  }, [currentLat, currentLng, breadcrumbLogs, incident]);

  return (
    <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Map Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={18} color="var(--accent-cyan)" />
          <span style={{ fontWeight: '600', fontSize: '15px' }}>Geospatial Mesh Tracking Canvas</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            [EPSG:4326 | 500m Redis GEO Geofence]
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
            }}
          >
            <Crosshair size={14} />
            <span>LAT: {currentLat.toFixed(5)}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span>LNG: {currentLng.toFixed(5)}</span>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                padding: '6px 8px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              title="Recenter Map"
            >
              <Crosshair size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Tactical Canvas */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '380px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />

        {/* Floating Map Legend Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(10, 13, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
            <span>Target / Distress Signal (1 Ping/Sec Throttled)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
            <span>Active Community Sentinels (&lt; 500m Geofence)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '16px', height: '2px', background: '#ef4444' }} />
            <span>GPS Breadcrumb Stream (PostgreSQL Throttled 2s)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
