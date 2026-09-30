import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SafeCircleTab, SafeCircleTabProps } from '../../src/components/SafeCircleTab';

describe('SafeCircleTab Component Tests', () => {
  const mockUser = {
    id: 'usr_789',
    phone: '+15559876543',
    name: 'Sarah Connor',
    role: 'USER' as const,
    bloodGroup: 'O+',
    isVolunteer: false,
    mlSensitivity: 'MEDIUM' as const,
    emergencyContacts: [
      {
        id: 'c_1',
        contactName: 'John Connor',
        phoneNumber: '+1555111222',
        priorityOrder: 1,
      },
      {
        id: 'c_2',
        contactName: 'Uncle Bob',
        phoneNumber: '+1555333444',
        priorityOrder: 2,
      },
    ],
  };

  const defaultProps: SafeCircleTabProps = {
    currentUser: mockUser,
    isVolunteer: false,
    onToggleVolunteer: jest.fn(),
    coords: { lat: 34.0522, lng: -118.2437 },
    batteryLevel: 92,
    batteryState: 'UNPLUGGED',
    isLowPowerMode: false,
    isConnected: true,
    backendUrl: 'http://localhost:3000',
    pingCount: 14,
    onRefreshBattery: jest.fn(),
    onLogout: jest.fn(),
    onTriggerSmsFallback: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render citizen profile information including name, phone, and blood group', () => {
    const { getByText } = render(<SafeCircleTab {...defaultProps} />);

    expect(getByText('Sarah Connor')).toBeTruthy();
    expect(getByText('+15559876543')).toBeTruthy();
    expect(getByText('O+')).toBeTruthy();
    expect(getByText('🛡️ PROTECTED CITIZEN')).toBeTruthy();
  });

  it('should render volunteer toggle and invoke onToggleVolunteer', () => {
    const { getByText } = render(<SafeCircleTab {...defaultProps} />);

    const toggleBtn = getByText('OFF');
    fireEvent.press(toggleBtn);

    expect(defaultProps.onToggleVolunteer).toHaveBeenCalledTimes(1);
  });

  it('should render emergency contacts roster and trigger direct SMS dispatch per contact', () => {
    const { getByText, getAllByText } = render(
      <SafeCircleTab {...defaultProps} />
    );

    expect(getByText('2 Contacts')).toBeTruthy();
    expect(getByText('John Connor')).toBeTruthy();
    expect(getByText('+1555111222')).toBeTruthy();
    expect(getByText('Uncle Bob')).toBeTruthy();

    const directSmsBtns = getAllByText('📲 SOS SMS');
    expect(directSmsBtns.length).toBe(2);

    fireEvent.press(directSmsBtns[0]);
    expect(defaultProps.onTriggerSmsFallback).toHaveBeenCalledWith(
      34.0522,
      -118.2437,
      92
    );
  });

  it('should display empty state placeholder when no emergency contacts exist', () => {
    const { getByText } = render(
      <SafeCircleTab
        {...defaultProps}
        currentUser={{ ...mockUser, emergencyContacts: [] }}
      />
    );

    expect(getByText('No Emergency Contacts Added')).toBeTruthy();
    expect(
      getByText(
        /Add primary contacts to automatically relay SOS coordinates/i
      )
    ).toBeTruthy();
  });

  it('should display gateway connection health and battery snapshot', () => {
    const { getByText } = render(<SafeCircleTab {...defaultProps} />);

    expect(getByText('🟢 ONLINE')).toBeTruthy();
    expect(getByText('http://localhost:3000')).toBeTruthy();
    expect(getByText('14 updates')).toBeTruthy();
    expect(getByText('92% (UNPLUGGED)')).toBeTruthy();

    const refreshBtn = getByText('🔄 Refresh Hardware Battery Snapshot');
    fireEvent.press(refreshBtn);
    expect(defaultProps.onRefreshBattery).toHaveBeenCalledTimes(1);
  });

  it('should display low power mode advisory when OS battery saver is active', () => {
    const { getByText } = render(
      <SafeCircleTab {...defaultProps} isLowPowerMode={true} />
    );

    expect(
      getByText(/OS Low Power Mode Detected • Polling throttled/i)
    ).toBeTruthy();
  });

  it('should invoke onLogout when Sign Out button is clicked', () => {
    const { getByText } = render(<SafeCircleTab {...defaultProps} />);

    const logoutBtn = getByText('🚪 Sign Out of Guardian Nest');
    fireEvent.press(logoutBtn);

    expect(defaultProps.onLogout).toHaveBeenCalledTimes(1);
  });
});
