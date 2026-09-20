import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserTable } from './UserTable';
import { AdminUser } from '../services/graphql';

describe('UserTable Component', () => {
  const mockUsers: AdminUser[] = [
    {
      id: 'u-1',
      name: 'Elena Rostova',
      phone: '+1555019888',
      role: 'ADMIN',
      isVolunteer: true,
      mlSensitivity: 'HIGH',
      createdAt: '2026-01-01',
      incidents: [{ id: 'inc-1', triggerType: 'MANUAL_SOS', status: 'RESOLVED', startedAt: '2026-01-01' }],
    },
    {
      id: 'u-2',
      name: 'Standard Citizen',
      phone: '+1555019999',
      role: 'USER',
      isVolunteer: false,
      mlSensitivity: 'MEDIUM',
      createdAt: '2026-01-01',
      incidents: [],
    },
  ];

  it('should render user list and trigger role change handler on select change', () => {
    const handleRoleChange = vi.fn();
    render(<UserTable users={mockUsers} onRoleChange={handleRoleChange} />);

    expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    expect(screen.getByText('+1555019888')).toBeInTheDocument();
    expect(screen.getByText('Active Sentinel')).toBeInTheDocument();
    expect(screen.getByText('Standard')).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);

    fireEvent.change(selects[0], { target: { value: 'RESPONDER' } });
    expect(handleRoleChange).toHaveBeenCalledWith('u-1', 'RESPONDER');
  });

  it('should display empty message when user list is empty', () => {
    render(<UserTable users={[]} onRoleChange={vi.fn()} />);
    expect(screen.getByText('No users found in database.')).toBeInTheDocument();
  });
});
