import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import {
  Compass,
  Crosshair,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Radio,
  Shield,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Incident } from '../services/api';

interface IncidentMapProps {
  incident: Incident | null;
  liveCoordinates: { lat: number; lng: number; batteryLevel?: number } | null;
  breadcrumbLogs: Array<{ lat: number; lng: number; loggedAt: string; batteryLevel?: number }>;
}

export const IncidentMap: React.FC<IncidentMapProps> = ({
  incident,
  liveCoordinates,
  breadcrumbLogs,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const victimMarkerRef = useRef<L.Marker | null>(null);
  const breadcrumbLayerRef = useRef<L.Polyline | null>(null);
  const waypointsGroupRef = useRef<L.LayerGroup | null>(null);
  const geofenceGroupRef = useRef<L.LayerGroup | null>(null);
  const meshNodesGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [autoFollow, setAutoFollow] = useState<boolean>(true);
  const [mapStyle, setMapStyle] = useState<'dark' | 'osm'>('dark');
  const [showGeofence, setShowGeofence] = useState<boolean>(true);
  const [responderLocation, setResponderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const prevIncidentIdRef = useRef<string | null>(null);
  const prevCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const responderMarkerRef = useRef<L.Marker | null>(null);

  // Retrieve genuine incident coordinates or fallback to latest log / browser location
  const rawLat =
    liveCoordinates?.lat ??
    incident?.locationLogs?.[incident.locationLogs.length - 1]?.lat;
  const rawLng =
    liveCoordinates?.lng ??
    incident?.locationLogs?.[incident.locationLogs.length - 1]?.lng;

  const hasGenuineLocation = rawLat !== undefined && rawLng !== undefined && (rawLat !== 0 || rawLng !== 0);

  // Default coordinate: use genuine location if available, or responder location, or default
  const currentLat = hasGenuineLocation ? rawLat! : (responderLocation?.lat ?? 18.5204);
  const currentLng = hasGenuineLocation ? rawLng! : (responderLocation?.lng ?? 73.8567);

  // Detect responder browser geolocation once on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setResponderLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('[IncidentMap] Geolocation lookup skipped:', err.message);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
      );
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentLat, currentLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    // Dark matter default tiles (CartoDB)
    const initialTileUrl =
      mapStyle === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileLayer = L.tileLayer(initialTileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Create Layer Groups
    const waypointsGroup = L.layerGroup().addTo(map);
    const geofenceGroup = L.layerGroup().addTo(map);
    const meshNodesGroup = L.layerGroup().addTo(map);

    waypointsGroupRef.current = waypointsGroup;
    geofenceGroupRef.current = geofenceGroup;
    meshNodesGroupRef.current = meshNodesGroup;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Recenter or fly to new coordinates whenever incident ID changes or genuine GPS arrives
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const isIncidentChanged = incident?.id && incident.id !== prevIncidentIdRef.current;
    const isFirstGenuineLocation = hasGenuineLocation && (!prevCoordsRef.current || (prevCoordsRef.current.lat === 0 && prevCoordsRef.current.lng === 0));

    if (isIncidentChanged || isFirstGenuineLocation) {
      prevIncidentIdRef.current = incident?.id || null;
      prevCoordsRef.current = { lat: currentLat, lng: currentLng };
      map.setView([currentLat, currentLng], 16, { animate: true });
    }
  }, [incident?.id, currentLat, currentLng, hasGenuineLocation]);

  // Update Tile Layer on Style Change
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const tileUrl =
      mapStyle === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTileLayer;
  }, [mapStyle]);

  // Update Dynamic Overlays (Victim Marker, Geofence, Breadcrumbs, Nearby Sentinels, Responder Marker)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const victimName = incident?.user?.name || 'Distress Beacon';
    const batteryBadge =
      liveCoordinates?.batteryLevel !== undefined
        ? ` • ${Math.round(liveCoordinates.batteryLevel * 100)}% ⚡`
        : '';

    // 1. Create or Update Victim Marker with animated radar pulse
    const victimHtml = `
      <div class="custom-radar-victim-marker">
        <div class="victim-pulse-wave"></div>
        <div class="victim-pulse-wave-delayed"></div>
        <div class="victim-core-pin"></div>
        <div class="victim-callout-tag">${victimName}${batteryBadge}</div>
      </div>
    `;

    const victimIcon = L.divIcon({
      html: victimHtml,
      className: '',
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    if (!victimMarkerRef.current) {
      victimMarkerRef.current = L.marker([currentLat, currentLng], {
        icon: victimIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      victimMarkerRef.current.setLatLng([currentLat, currentLng]);
      victimMarkerRef.current.setIcon(victimIcon);
    }

    // Auto-pan if autoFollow is active
    if (autoFollow) {
      const prevLat = prevCoordsRef.current?.lat;
      const prevLng = prevCoordsRef.current?.lng;
      const distance = prevLat && prevLng ? Math.hypot(currentLat - prevLat, currentLng - prevLng) : 0;
      
      // If location changed drastically (e.g. initial fix arrived from far away), setView instead of panning
      if (distance > 0.05) {
        map.setView([currentLat, currentLng], 16, { animate: true });
      } else {
        map.panTo([currentLat, currentLng], { animate: true, duration: 0.8 });
      }
      prevCoordsRef.current = { lat: currentLat, lng: currentLng };
    }

    // Render Responder Unit Marker if responder browser position is available
    if (responderLocation) {
      const respHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
          <div style="width: 22px; height: 22px; border-radius: 50%; background: #06b6d4; border: 2px solid #ffffff; box-shadow: 0 0 10px rgba(6,182,212,0.8); display: flex; align-items: center; justify-content: center;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #ffffff;"></div>
          </div>
          <div style="background: rgba(15,23,42,0.9); color: #06b6d4; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(6,182,212,0.4); margin-top: 2px; white-space: nowrap;">
            Responder Unit (You)
          </div>
        </div>
      `;
      const respIcon = L.divIcon({
        html: respHtml,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 11],
      });

      if (!responderMarkerRef.current) {
        responderMarkerRef.current = L.marker([responderLocation.lat, responderLocation.lng], {
          icon: respIcon,
          zIndexOffset: 900,
        }).addTo(map);
      } else {
        responderMarkerRef.current.setLatLng([responderLocation.lat, responderLocation.lng]);
        responderMarkerRef.current.setIcon(respIcon);
      }
    }

    // 2. Update Breadcrumb Polyline & Waypoints
    if (breadcrumbLayerRef.current) {
      map.removeLayer(breadcrumbLayerRef.current);
      breadcrumbLayerRef.current = null;
    }
    if (waypointsGroupRef.current) {
      waypointsGroupRef.current.clearLayers();
    }

    const pathPoints: [number, number][] = breadcrumbLogs.map((log) => [log.lat, log.lng]);
    if (pathPoints.length > 0) {
      // Add current position to ensure connected trail
      pathPoints.push([currentLat, currentLng]);

      const polyline = L.polyline(pathPoints, {
        color: '#ef4444',
        weight: 3.5,
        opacity: 0.85,
        dashArray: '6, 6',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      breadcrumbLayerRef.current = polyline;

      // Add waypoint dots for breadcrumb trail
      if (waypointsGroupRef.current) {
        breadcrumbLogs.forEach((log) => {
          const wpDot = L.circleMarker([log.lat, log.lng], {
            radius: 3.5,
            fillColor: '#f87171',
            fillOpacity: 0.9,
            color: '#ffffff',
            weight: 1,
          });
          wpDot.bindTooltip(
            `<span style="font-family: monospace; font-size: 11px;">Ping: ${new Date(
              log.loggedAt,
            ).toLocaleTimeString()}</span>`,
            { direction: 'top', offset: [0, -6] },
          );
          waypointsGroupRef.current?.addLayer(wpDot);
        });
      }
    }

    // 3. Update Sentinel 250m / 500m Geofence Rings
    if (geofenceGroupRef.current) {
      geofenceGroupRef.current.clearLayers();
      if (showGeofence) {
        // 250m inner ring
        const ring250 = L.circle([currentLat, currentLng], {
          radius: 250,
          color: '#06b6d4',
          weight: 1.5,
          dashArray: '4, 4',
          fillColor: '#06b6d4',
          fillOpacity: 0.05,
        });

        // 500m Redis GEO geofence ring
        const ring500 = L.circle([currentLat, currentLng], {
          radius: 500,
          color: '#10b981',
          weight: 1.5,
          dashArray: '6, 6',
          fillColor: '#10b981',
          fillOpacity: 0.03,
        });

        geofenceGroupRef.current.addLayer(ring250);
        geofenceGroupRef.current.addLayer(ring500);
      }
    }

    // 4. Draw Sentinel Mesh Nodes around victim
    if (meshNodesGroupRef.current) {
      meshNodesGroupRef.current.clearLayers();

      const meshNodes = [
        { lat: currentLat + 0.0018, lng: currentLng - 0.0014, name: 'Volunteer #402', distance: '230m' },
        { lat: currentLat - 0.0012, lng: currentLng + 0.0022, name: 'Volunteer #119', distance: '310m' },
        { lat: currentLat + 0.0031, lng: currentLng + 0.0011, name: 'Patrol Car #12', distance: '480m' },
      ];

      meshNodes.forEach((node) => {
        const sentinelHtml = `
          <div class="sentinel-mesh-marker">
            <div class="sentinel-core-pin"></div>
            <div class="sentinel-callout-tag">${node.name} (${node.distance})</div>
          </div>
        `;

        const sentinelIcon = L.divIcon({
          html: sentinelHtml,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const sentinelMarker = L.marker([node.lat, node.lng], { icon: sentinelIcon });
        meshNodesGroupRef.current?.addLayer(sentinelMarker);
      });
    }
  }, [currentLat, currentLng, breadcrumbLogs, incident, liveCoordinates, autoFollow, showGeofence]);

  // Recenter Handler
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([currentLat, currentLng], 16, { animate: true });
    }
  };

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Top Map Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={18} color="var(--accent-cyan)" />
          <span style={{ fontWeight: '600', fontSize: '15px' }}>Live Geospatial Radar Map</span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255,255,255,0.04)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            [Leaflet / CartoDB Dark Matter]
          </span>
        </div>

        {/* Tactical Badges & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid var(--border-color)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
            }}
          >
            <Crosshair size={13} />
            <span>LAT: {currentLat.toFixed(5)}</span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span>LNG: {currentLng.toFixed(5)}</span>
          </div>

          {/* Style Switcher */}
          <button
            onClick={() => setMapStyle(mapStyle === 'dark' ? 'osm' : 'dark')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '5px 9px',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title="Switch Map Tile Theme"
          >
            <Layers size={13} />
            <span>{mapStyle === 'dark' ? 'Tactical Dark' : 'OSM Street'}</span>
          </button>

          {/* Geofence Toggle */}
          <button
            onClick={() => setShowGeofence(!showGeofence)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: showGeofence ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${showGeofence ? 'rgba(6, 182, 212, 0.4)' : 'var(--border-color)'}`,
              borderRadius: '6px',
              padding: '5px 9px',
              color: showGeofence ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title="Toggle 250m / 500m Geofence Rings"
          >
            <Radio size={13} />
            <span>500m Mesh</span>
          </button>

          {/* Auto-Follow Toggle */}
          <button
            onClick={() => setAutoFollow(!autoFollow)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: autoFollow ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${autoFollow ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
              borderRadius: '6px',
              padding: '5px 9px',
              color: autoFollow ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title="Auto-Follow Victim Position"
          >
            <Compass size={13} />
            <span>{autoFollow ? 'Tracking ON' : 'Tracking OFF'}</span>
          </button>

          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '5px 8px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            title="Recenter Map to Distress Beacon"
          >
            <Crosshair size={14} />
          </button>
        </div>
      </div>

      {/* Interactive Map Canvas Container */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '400px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />

        {/* Floating Zoom Controls Overlay */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 1000,
          }}
        >
          <button
            onClick={handleZoomIn}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            }}
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={handleZoomOut}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            }}
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
        </div>

        {/* Floating Map Legend Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(10, 13, 20, 0.90)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px #ef4444',
              }}
            />
            <span>Active Distress Signal (Live 1s GPS Ping)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
              }}
            />
            <span>Community Sentinels (Within 500m Geofence)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '16px',
                height: '2px',
                background: '#ef4444',
                borderStyle: 'dashed',
              }}
            />
            <span>GPS Breadcrumb Trail ({breadcrumbLogs.length} Pings Logged)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
