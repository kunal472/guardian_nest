import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentMap } from './IncidentMap';
import { Incident } from '../services/api';

describe('IncidentMap Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockIncident: Incident = {
    id: 'inc-map-1',
    userId: 'u-1',
    triggerType: 'MANUAL_SOS',
    status: 'ACTIVE',
    startedAt: '2026-09-20T10:00:00Z',
    locationLogs: [
      {
        id: 'log-1',
        lat: 18.5204,
        lng: 73.8567,
        batteryLevel: 95,
        loggedAt: '2026-09-20T10:00:00Z',
      },
    ],
    user: {
      id: 'u-1',
      name: 'Jane Doe',
      phone: '+1555000111',
    },
  };

  it('renders map container, tactical coordinates, and default toolbar controls', () => {
    render(
      <IncidentMap
        incident={mockIncident}
        liveCoordinates={{ lat: 18.5204, lng: 73.8567, batteryLevel: 0.95 }}
        breadcrumbLogs={mockIncident.locationLogs}
      />,
    );

    expect(screen.getByText(/Live Geospatial Radar Map/i)).toBeInTheDocument();
    expect(screen.getByText(/LAT: 18.52040/i)).toBeInTheDocument();
    expect(screen.getByText(/LNG: 73.85670/i)).toBeInTheDocument();
    expect(screen.getByText('Tactical Dark')).toBeInTheDocument();
    expect(screen.getByText('500m Mesh')).toBeInTheDocument();
    expect(screen.getByText('Tracking ON')).toBeInTheDocument();
  });

  it('toggles map style between dark and osm', () => {
    render(
      <IncidentMap
        incident={mockIncident}
        liveCoordinates={null}
        breadcrumbLogs={[]}
      />,
    );

    const styleBtn = screen.getByTitle(/Switch Map Tile Theme/i);
    expect(screen.getByText('Tactical Dark')).toBeInTheDocument();

    fireEvent.click(styleBtn);
    expect(screen.getByText('OSM Street')).toBeInTheDocument();

    fireEvent.click(styleBtn);
    expect(screen.getByText('Tactical Dark')).toBeInTheDocument();
  });

  it('toggles geofence rings and tracking auto-follow', () => {
    render(
      <IncidentMap
        incident={mockIncident}
        liveCoordinates={null}
        breadcrumbLogs={[]}
      />,
    );

    const geofenceBtn = screen.getByTitle(/Toggle 250m \/ 500m Geofence Rings/i);
    fireEvent.click(geofenceBtn);

    const autoFollowBtn = screen.getByTitle(/Auto-Follow Victim Position/i);
    expect(screen.getByText('Tracking ON')).toBeInTheDocument();
    fireEvent.click(autoFollowBtn);
    expect(screen.getByText('Tracking OFF')).toBeInTheDocument();
  });

  it('handles zoom in, zoom out, and recenter button clicks', () => {
    render(
      <IncidentMap
        incident={mockIncident}
        liveCoordinates={{ lat: 18.5204, lng: 73.8567 }}
        breadcrumbLogs={mockIncident.locationLogs}
      />,
    );

    const zoomInBtn = screen.getByTitle('Zoom In');
    const zoomOutBtn = screen.getByTitle('Zoom Out');
    const recenterBtn = screen.getByTitle('Recenter Map to Distress Beacon');

    fireEvent.click(zoomInBtn);
    fireEvent.click(zoomOutBtn);
    fireEvent.click(recenterBtn);
  });
});
