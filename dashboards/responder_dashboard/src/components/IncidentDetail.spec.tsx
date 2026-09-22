import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncidentDetail } from './IncidentDetail';
import { Incident } from '../services/api';

describe('IncidentDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseIncident: Incident = {
    id: 'inc-detail-123',
    userId: 'u-1',
    triggerType: 'MANUAL_SOS',
    status: 'ACTIVE',
    startedAt: '2026-09-20T10:00:00Z',
    evidenceAudioUrl: '/vault/evidence_123.mp3',
    locationLogs: [
      {
        id: 'log-1',
        lat: 18.5204,
        lng: 73.8567,
        batteryLevel: 8, // Critical battery <= 10%
        loggedAt: '2026-09-20T10:00:00Z',
      },
    ],
    user: {
      id: 'u-1',
      name: 'John Doe',
      phone: '+1 (555) 123-4567',
    },
  };

  it('renders fallback prompt when no incident is selected', () => {
    render(
      <IncidentDetail
        incident={null}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByText(/Select an Active Incident/i)).toBeInTheDocument();
  });

  it('renders full incident profile, critical battery banner, and victim info', () => {
    render(
      <IncidentDetail
        incident={baseIncident}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText(/INCIDENT ID: inc-detail-123/i)).toBeInTheDocument();
    expect(screen.getByText('+1 (555) 123-4567')).toBeInTheDocument();
    expect(screen.getByText('MANUAL SOS')).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL BATTERY "LAST GASP" \(8%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE SOS/i)).toBeInTheDocument();
  });

  it('handles status changes when clicking action buttons', () => {
    const onStatusChangeMock = vi.fn();
    const { rerender } = render(
      <IncidentDetail
        incident={baseIncident}
        onStatusChange={onStatusChangeMock}
        isLoading={false}
      />,
    );

    // Active status -> Dispatch button
    const dispatchBtn = screen.getByText(/Dispatch Emergency Response Unit/i);
    fireEvent.click(dispatchBtn);
    expect(onStatusChangeMock).toHaveBeenCalledWith('DISPATCHED');

    // Dispatched status -> Mark resolved button
    const dispatchedIncident: Incident = { ...baseIncident, status: 'DISPATCHED' };
    rerender(
      <IncidentDetail
        incident={dispatchedIncident}
        onStatusChange={onStatusChangeMock}
        isLoading={false}
      />,
    );

    const resolveDispatchBtn = screen.getByText(/Mark Threat Resolved & Safe/i);
    fireEvent.click(resolveDispatchBtn);
    expect(onStatusChangeMock).toHaveBeenCalledWith('RESOLVED');

    // False alarm button
    const falseAlarmBtn = screen.getByText('False Alarm');
    fireEvent.click(falseAlarmBtn);
    expect(onStatusChangeMock).toHaveBeenCalledWith('FALSE_ALARM');
  });

  it('handles audio playback toggle with HTML5 audio', async () => {
    render(
      <IncidentDetail
        incident={baseIncident}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    const playBtn = screen.getByRole('button', { name: /Play Audio Evidence/i });
    fireEvent.click(playBtn);

    await waitFor(() => {
      expect(screen.getByText(/Pause Evidence/i)).toBeInTheDocument();
    });

    // Clicking again pauses
    const pauseBtn = screen.getByRole('button', { name: /Pause Evidence/i });
    fireEvent.click(pauseBtn);

    await waitFor(() => {
      expect(screen.getByText(/Play Audio Evidence/i)).toBeInTheDocument();
    });
  });

  it('handles audio playback gracefully when no audio URL is present', () => {
    const noAudioIncident: Incident = {
      ...baseIncident,
      evidenceAudioUrl: undefined,
      locationLogs: [],
    };

    render(
      <IncidentDetail
        incident={noAudioIncident}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    const playBtn = screen.getByRole('button', { name: /Play Audio Evidence/i });
    fireEvent.click(playBtn);

    expect(screen.getByText(/Play Audio Evidence/i)).toBeInTheDocument();
  });

  it('handles audio scrubber click', () => {
    render(
      <IncidentDetail
        incident={baseIncident}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    const scrubber = screen.getByTitle(/Click to scrub through audio/i);
    vi.spyOn(scrubber, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 200,
      bottom: 20,
      width: 200,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    fireEvent.click(scrubber, { clientX: 100 });
  });

  it('handles audio element onTimeUpdate, onEnded, and onError events', () => {
    const { container } = render(
      <IncidentDetail
        incident={baseIncident}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    const audioElement = container.querySelector('audio');
    expect(audioElement).toBeInTheDocument();

    // Trigger timeupdate
    Object.defineProperty(audioElement, 'currentTime', { value: 15, writable: true });
    Object.defineProperty(audioElement, 'duration', { value: 30, writable: true });
    fireEvent.timeUpdate(audioElement!);

    expect(screen.getByText('00:15')).toBeInTheDocument();

    // Trigger ended
    fireEvent.ended(audioElement!);
    expect(screen.getByText('00:00')).toBeInTheDocument();

    // Trigger error
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fireEvent.error(audioElement!);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles various audio URL formats (http, blob, data, relative)', () => {
    const { rerender, container } = render(
      <IncidentDetail
        incident={{ ...baseIncident, evidenceAudioUrl: 'https://example.com/audio.mp3' }}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    expect(container.querySelector('audio')?.getAttribute('src')).toBe(
      'https://example.com/audio.mp3',
    );

    rerender(
      <IncidentDetail
        incident={{ ...baseIncident, evidenceAudioUrl: 'blob:http://localhost/123' }}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    expect(container.querySelector('audio')?.getAttribute('src')).toBe(
      'blob:http://localhost/123',
    );

    rerender(
      <IncidentDetail
        incident={{ ...baseIncident, evidenceAudioUrl: 'data:audio/mp3;base64,...' }}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    expect(container.querySelector('audio')?.getAttribute('src')).toBe(
      'data:audio/mp3;base64,...',
    );

    rerender(
      <IncidentDetail
        incident={{ ...baseIncident, evidenceAudioUrl: 'evidence_relative.mp3' }}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );

    expect(container.querySelector('audio')?.getAttribute('src')).toBe(
      'http://localhost:3000/evidence_relative.mp3',
    );
  });

  it('renders different status badges appropriately (RESOLVED, FALSE_ALARM)', () => {
    const { rerender } = render(
      <IncidentDetail
        incident={{ ...baseIncident, status: 'RESOLVED' }}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );
    expect(screen.getByText('RESOLVED')).toBeInTheDocument();

    rerender(
      <IncidentDetail
        incident={{ ...baseIncident, status: 'FALSE_ALARM' }}
        onStatusChange={vi.fn()}
        isLoading={false}
      />,
    );
    expect(screen.getByText('FALSE ALARM')).toBeInTheDocument();
  });
});
