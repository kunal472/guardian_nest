import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsCards } from './AnalyticsCards';
import { AdminIncident, AdminUser } from '../services/graphql';

describe('AnalyticsCards Component', () => {
  const mockUsers: AdminUser[] = [
    {
      id: 'u1',
      name: 'User 1',
      phone: '+15551111',
      role: 'USER',
      isVolunteer: true,
      mlSensitivity: 'MEDIUM',
      createdAt: '2026-01-01',
      incidents: [],
    },
    {
      id: 'u2',
      name: 'Responder 1',
      phone: '+15552222',
      role: 'RESPONDER',
      isVolunteer: false,
      mlSensitivity: 'HIGH',
      createdAt: '2026-01-01',
      incidents: [],
    },
  ];

  const mockIncidents: AdminIncident[] = [
    {
      id: 'inc1',
      userId: 'u1',
      triggerType: 'MANUAL_SOS',
      status: 'ACTIVE',
      startedAt: '2026-01-01',
      locationLogs: [],
    },
    {
      id: 'inc2',
      userId: 'u1',
      triggerType: 'AUDIO_SCREAM',
      status: 'RESOLVED',
      startedAt: '2026-01-01',
      locationLogs: [],
    },
  ];

  it('should render metric values and status indicators for active threats', () => {
    render(<AnalyticsCards activeCount={1} users={mockUsers} incidents={mockIncidents} />);

    expect(screen.getByText('Active Distress Signals')).toBeInTheDocument();
    expect(screen.getByText('Threat Ongoing')).toBeInTheDocument();
    expect(screen.getByText('Active Sentinels (Volunteers)')).toBeInTheDocument();
    expect(screen.getByText('Emergency Responders')).toBeInTheDocument();
    expect(screen.getByText('Resolved Incidents')).toBeInTheDocument();
  });

  it('should display Nominal status when activeCount is 0', () => {
    render(<AnalyticsCards activeCount={0} users={[]} incidents={[]} />);
    expect(screen.getByText('Nominal')).toBeInTheDocument();
  });
});
