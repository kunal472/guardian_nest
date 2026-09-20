import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IncidentHistory } from './IncidentHistory';
import { AdminIncident } from '../services/graphql';

describe('IncidentHistory Component', () => {
  const mockIncidents: AdminIncident[] = [
    {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      userId: 'u1',
      triggerType: 'MANUAL_SOS',
      status: 'ACTIVE',
      startedAt: '2026-01-01T10:00:00Z',
      locationLogs: [{ id: 'loc1', lat: 40.71, lng: -74.0, loggedAt: '2026-01-01T10:01:00Z' }],
    },
    {
      id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
      userId: 'u2',
      triggerType: 'DEVICE_SNATCH',
      status: 'RESOLVED',
      startedAt: '2026-01-01T09:00:00Z',
      resolvedAt: '2026-01-01T09:30:00Z',
      locationLogs: [],
    },
  ];

  it('should render incidents table and trigger resolve actions', () => {
    const handleResolve = vi.fn();
    render(<IncidentHistory incidents={mockIncidents} onResolve={handleResolve} />);

    expect(screen.getByText('#a1b2c3d4')).toBeInTheDocument();
    expect(screen.getByText('MANUAL SOS')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('1 pings')).toBeInTheDocument();

    const resolveBtn = screen.getByText('Resolve');
    const dismissBtn = screen.getByText('Dismiss');

    fireEvent.click(resolveBtn);
    expect(handleResolve).toHaveBeenCalledWith('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'RESOLVED');

    fireEvent.click(dismissBtn);
    expect(handleResolve).toHaveBeenCalledWith('a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'FALSE_ALARM');
  });

  it('should show empty message when incident list is empty', () => {
    render(<IncidentHistory incidents={[]} onResolve={vi.fn()} />);
    expect(screen.getByText('No incident logs recorded.')).toBeInTheDocument();
  });
});
