import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LiveAlertBanner } from './LiveAlertBanner';
import { Incident } from '../services/api';

describe('LiveAlertBanner Component', () => {
  const mockIncidents: Incident[] = [
    {
      id: 'inc-1',
      userId: 'u-1',
      triggerType: 'MANUAL_SOS',
      status: 'ACTIVE',
      startedAt: '2026-09-20T10:00:00Z',
      locationLogs: [],
      user: { id: 'u-1', name: 'Alice Smith', phone: '+123456789' },
    },
    {
      id: 'inc-2',
      userId: 'u-2',
      triggerType: 'AUDIO_SCREAM',
      status: 'DISPATCHED',
      startedAt: '2026-09-20T10:05:00Z',
      locationLogs: [],
    },
    {
      id: 'inc-3',
      userId: 'u-3',
      triggerType: 'DEAD_MAN_SWITCH',
      status: 'RESOLVED',
      startedAt: '2026-09-20T09:00:00Z',
      locationLogs: [],
    },
  ];

  it('renders nominal state when there are no active incidents', () => {
    render(
      <LiveAlertBanner
        activeIncidents={[]}
        selectedIncident={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/All Sectors Nominal/i)).toBeInTheDocument();
    expect(screen.getByText(/No active distress signals/i)).toBeInTheDocument();
  });

  it('renders live threat count and triggers onSelect callback on click', () => {
    const onSelectMock = vi.fn();
    render(
      <LiveAlertBanner
        activeIncidents={mockIncidents}
        selectedIncident={mockIncidents[0]}
        onSelect={onSelectMock}
      />,
    );

    expect(screen.getByText(/2 Live Threats/i)).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText(/Victim #inc-2/i)).toBeInTheDocument();

    const victimButton = screen.getByText('Alice Smith').closest('button');
    fireEvent.click(victimButton!);
    expect(onSelectMock).toHaveBeenCalledWith(mockIncidents[0]);
  });
});
