import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from './App';
import * as authService from './services/auth';
import * as apiService from './services/api';
import * as socketService from './services/socket';

describe('App Component', () => {
  const socketHandlers: Record<string, Function> = {};
  const mockSocket = {
    id: 'mock-socket-cad',
    on: vi.fn((event: string, cb: Function) => {
      socketHandlers[event] = cb;
    }),
    off: vi.fn((event: string) => {
      delete socketHandlers[event];
    }),
    emit: vi.fn(),
  };

  const mockUser: authService.ResponderUser = {
    id: 'u-field-1',
    phone: '+1999888777',
    name: 'Unit 4-Echo',
    role: 'RESPONDER',
    isVolunteer: true,
  };

  const mockIncidents: apiService.Incident[] = [
    {
      id: 'inc-101',
      userId: 'u-1',
      triggerType: 'MANUAL_SOS',
      status: 'ACTIVE',
      startedAt: '2026-09-20T10:00:00Z',
      locationLogs: [
        {
          id: 'log-1',
          lat: 18.5204,
          lng: 73.8567,
          batteryLevel: 90,
          loggedAt: '2026-09-20T10:00:00Z',
        },
      ],
      user: {
        id: 'u-1',
        name: 'Sarah Connor',
        phone: '+1 (555) 000-1111',
      },
    },
    {
      id: 'inc-102',
      userId: 'u-2',
      triggerType: 'DEVICE_SNATCH',
      status: 'DISPATCHED',
      startedAt: '2026-09-20T10:05:00Z',
      locationLogs: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(socketService, 'getSocket').mockReturnValue(mockSocket as any);
  });

  it('renders ResponderAuth when no user is authenticated', () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue(null);

    render(<App />);
    expect(screen.getByRole('heading', { name: /RESPONDER/i })).toBeInTheDocument();
    expect(screen.getByText(/Connect to Dispatch Bus/i)).toBeInTheDocument();
  });

  it('renders dashboard layout with user profile when authenticated', async () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue({
      token: 'valid-jwt',
      user: mockUser,
    });
    vi.spyOn(apiService, 'fetchIncidents').mockResolvedValue(mockIncidents);

    render(<App />);

    expect(screen.getByText(/DISPATCH CENTRAL/i)).toBeInTheDocument();
    expect(screen.getByText('Unit 4-Echo')).toBeInTheDocument();
    expect(screen.getByText(/\+1999888777 • VOLUNTEER/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThan(0);
    });
  });

  it('handles socket real-time events (connect, disconnect, broadcast, location:update, status change, incident:new)', async () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue({
      token: 'valid-jwt',
      user: mockUser,
    });
    vi.spyOn(apiService, 'fetchIncidents').mockResolvedValue(mockIncidents);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThan(0);
    });

    // 1. Socket Connect & Disconnect
    expect(socketHandlers['connect']).toBeDefined();
    await waitFor(() => {
      socketHandlers['connect']();
      expect(screen.getByText(/Event Bus Connected/i)).toBeInTheDocument();
    });

    socketHandlers['disconnect']();
    await waitFor(() => {
      expect(screen.getByText(/Connecting to Gateway.../i)).toBeInTheDocument();
    });

    // 2. Incident New Event
    const newIncident: apiService.Incident = {
      id: 'inc-999',
      userId: 'u-99',
      triggerType: 'AUDIO_SCREAM',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      locationLogs: [],
      user: { id: 'u-99', name: 'Kyle Reese', phone: '+1999000222' },
    };
    socketHandlers['incident:new'](newIncident);

    await waitFor(() => {
      expect(screen.getAllByText('Kyle Reese').length).toBeGreaterThan(0);
    });

    // 3. Location Update Event
    socketHandlers['location:update']({
      incidentId: 'inc-999',
      lat: 18.53,
      lng: 73.86,
      batteryLevel: 75,
      timestamp: new Date().toISOString(),
    });

    // 4. Incident Status Changed Event
    socketHandlers['incident:status_changed']({
      incidentId: 'inc-999',
      status: 'RESOLVED',
    });

    await waitFor(() => {
      expect(screen.getAllByText('RESOLVED').length).toBeGreaterThan(0);
    });

    // 5. Incident Updated Full Payload Event
    socketHandlers['incident:updated']({
      ...newIncident,
      status: 'FALSE_ALARM',
    });

    await waitFor(() => {
      expect(screen.getAllByText('FALSE ALARM').length).toBeGreaterThan(0);
    });

    // 6. Nearby Broadcast Event
    socketHandlers['nearby:broadcast']({ distressId: 'dist-1' });
  });

  it('filters incident roster by status buttons', async () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue({
      token: 'valid-jwt',
      user: mockUser,
    });
    vi.spyOn(apiService, 'fetchIncidents').mockResolvedValue(mockIncidents);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThan(0);
    });

    // Filter DISPATCHED
    fireEvent.click(screen.getByRole('button', { name: 'DISPATCHED' }));
    expect(screen.getAllByText(/Victim #inc-10/i).length).toBeGreaterThan(0);

    // Filter ALL
    fireEvent.click(screen.getByRole('button', { name: 'ALL' }));
    expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThan(0);
  });

  it('handles simulate distress button click and socket emit', async () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue({
      token: 'valid-jwt',
      user: mockUser,
    });
    vi.spyOn(apiService, 'fetchIncidents').mockResolvedValue(mockIncidents);

    render(<App />);

    const simBtn = screen.getByRole('button', { name: /Simulate Distress/i });
    fireEvent.click(simBtn);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'distress:triggered',
      expect.objectContaining({
        triggerType: 'AUDIO_SCREAM',
        batteryLevel: 88,
      }),
    );
  });

  it('handles sign out click', async () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue({
      token: 'valid-jwt',
      user: mockUser,
    });
    vi.spyOn(apiService, 'fetchIncidents').mockResolvedValue(mockIncidents);

    render(<App />);

    const logoutBtn = screen.getByRole('button', { name: /Sign Out/i });
    fireEvent.click(logoutBtn);

    expect(screen.getByText(/Connect to Dispatch Bus/i)).toBeInTheDocument();
  });

  it('handles responder status change action', async () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue({
      token: 'valid-jwt',
      user: mockUser,
    });
    vi.spyOn(apiService, 'fetchIncidents').mockResolvedValue(mockIncidents);
    vi.spyOn(apiService, 'updateIncidentStatus').mockResolvedValue({
      ...mockIncidents[0],
      status: 'DISPATCHED',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Dispatch Emergency Response Unit/i)).toBeInTheDocument();
    });

    const dispatchBtn = screen.getByText(/Dispatch Emergency Response Unit/i);
    fireEvent.click(dispatchBtn);

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'responder:status_change',
      expect.objectContaining({
        incidentId: 'inc-101',
        status: 'DISPATCHED',
      }),
    );
  });

  it('handles selecting an incident from the roster list', async () => {
    vi.spyOn(authService, 'getStoredResponderAuth').mockReturnValue({
      token: 'valid-jwt',
      user: mockUser,
    });
    vi.spyOn(apiService, 'fetchIncidents').mockResolvedValue(mockIncidents);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText('Sarah Connor').length).toBeGreaterThan(0);
    });

    const secondIncidentItem = screen.getAllByText(/Victim #inc-10/i)[1].closest('div');
    fireEvent.click(secondIncidentItem!);

    expect(mockSocket.emit).toHaveBeenCalledWith('join:incident', { incidentId: 'inc-102' });
  });
});
