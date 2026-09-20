import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from './App';
import * as authService from './services/auth';
import * as graphqlService from './services/graphql';

const socketListeners: Record<string, Function> = {};

vi.mock('./services/socket', () => {
  return {
    getSocket: vi.fn().mockReturnValue({
      on: vi.fn((event, cb) => {
        socketListeners[event] = cb;
      }),
      off: vi.fn(),
      emit: vi.fn(),
    }),
  };
});

describe('Admin Dashboard App Component', () => {
  const mockAdminUser: authService.AdminAuthUser = {
    id: 'admin-1',
    name: 'Sarah Connor',
    phone: '+18005550199',
    role: 'ADMIN',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render AdminAuth when no user is logged in', () => {
    vi.spyOn(authService, 'getStoredAuth').mockReturnValue(null);

    render(<App />);
    expect(screen.getByText('GUARDIAN')).toBeInTheDocument();
    expect(screen.getByText('Admin Sign In')).toBeInTheDocument();
  });

  it('should render executive dashboard tabs and allow switching when authenticated', async () => {
    vi.spyOn(authService, 'getStoredAuth').mockReturnValue({
      token: 'jwt_admin_123',
      user: mockAdminUser,
    });

    const mockFetchGraphQL = vi.spyOn(graphqlService, 'fetchGraphQL').mockResolvedValue({
      activeIncidentsCount: 2,
      users: [
        {
          id: 'u-1',
          name: 'Elena Citizen',
          phone: '+1555111222',
          role: 'USER',
          isVolunteer: true,
          mlSensitivity: 'MEDIUM',
          createdAt: '2026-01-01',
          incidents: [],
        },
      ],
      incidents: [
        {
          id: '12345678-1234-1234-1234-123456789012',
          userId: 'u-1',
          triggerType: 'MANUAL_SOS',
          status: 'ACTIVE',
          startedAt: '2026-01-01',
          locationLogs: [],
        },
      ],
    } as any);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Sarah Connor')).toBeInTheDocument();
      expect(screen.getByText('Executive Overview')).toBeInTheDocument();
    });

    // Test Query GraphQL button
    const refreshBtn = screen.getByText('Query GraphQL');
    fireEvent.click(refreshBtn);
    expect(mockFetchGraphQL).toHaveBeenCalled();

    // Test socket real-time update
    if (socketListeners['incident:status_changed']) {
      socketListeners['incident:status_changed']({ incidentId: 'inc-1' });
    }

    // Test tab navigation
    const usersTab = screen.getByText('User & Volunteer Directory');
    fireEvent.click(usersTab);
    expect(screen.getByText('User & Volunteer Identity Governance')).toBeInTheDocument();

    // Change role in UserTable
    const roleSelect = screen.getByRole('combobox');
    fireEvent.change(roleSelect, { target: { value: 'RESPONDER' } });
    expect(mockFetchGraphQL).toHaveBeenCalledWith(graphqlService.UPDATE_USER_ROLE, {
      userId: 'u-1',
      role: 'RESPONDER',
    });

    const incidentsTab = screen.getByText('Incident Audit Trail');
    fireEvent.click(incidentsTab);
    expect(screen.getByText('Incident Audit Log & Resolution Ledger')).toBeInTheDocument();

    // Resolve incident in IncidentHistory
    const resolveBtn = screen.getByText('Resolve');
    fireEvent.click(resolveBtn);
    expect(mockFetchGraphQL).toHaveBeenCalledWith(graphqlService.RESOLVE_INCIDENT, {
      incidentId: '12345678-1234-1234-1234-123456789012',
      status: 'RESOLVED',
    });

    const configTab = screen.getByText('Edge ML Thresholds');
    fireEvent.click(configTab);
    expect(screen.getByText('Global Edge ML & Hardware Driver Threshold Tuning')).toBeInTheDocument();

    // Test sign out
    const signOutBtn = screen.getByText('Sign Out');
    fireEvent.click(signOutBtn);
    expect(screen.getByText('Admin Sign In')).toBeInTheDocument();
  });
});
