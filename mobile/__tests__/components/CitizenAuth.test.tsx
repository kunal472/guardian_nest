import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { CitizenAuth } from '../../src/components/CitizenAuth';
import * as authService from '../../src/services/authService';

describe('CitizenAuth Component Tests', () => {
  const mockOnAuthSuccess = jest.fn();
  const mockOnBypassGuestMode = jest.fn();
  const mockOnUpdateBackendUrl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render login form by default with phone and password fields', () => {
    const { getByPlaceholderText, getByText } = render(
      <CitizenAuth
        backendUrl="http://localhost:3000"
        onAuthSuccess={mockOnAuthSuccess}
        onBypassGuestMode={mockOnBypassGuestMode}
        onUpdateBackendUrl={mockOnUpdateBackendUrl}
      />
    );

    expect(getByPlaceholderText('+1 (555) 019-888')).toBeTruthy();
    expect(getByPlaceholderText('••••••••••••')).toBeTruthy();
    expect(getByText('Citizen Sign In')).toBeTruthy();
    expect(getByText('Arm & Enter Safety HUD')).toBeTruthy();
  });

  it('should switch between Login and Register tabs', () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(
      <CitizenAuth
        backendUrl="http://localhost:3000"
        onAuthSuccess={mockOnAuthSuccess}
        onBypassGuestMode={mockOnBypassGuestMode}
      />
    );

    // Click on New Onboarding (Register) tab
    fireEvent.press(getByText('New Onboarding'));

    // In Register mode, full name and emergency contact fields are visible
    expect(getByPlaceholderText('e.g. Maya Lin')).toBeTruthy();
    expect(getByText('Complete Citizen Registration')).toBeTruthy();

    // Click back to Citizen Sign In tab
    fireEvent.press(getByText('Citizen Sign In'));
    expect(queryByPlaceholderText('e.g. Maya Lin')).toBeNull();
  });

  it('should invoke onBypassGuestMode when Guest Mode button is clicked', () => {
    const { getByText } = render(
      <CitizenAuth
        backendUrl="http://localhost:3000"
        onAuthSuccess={mockOnAuthSuccess}
        onBypassGuestMode={mockOnBypassGuestMode}
      />
    );

    fireEvent.press(getByText('Test SOS (Guest)'));
    expect(mockOnBypassGuestMode).toHaveBeenCalledTimes(1);
  });

  it('should validate inputs and submit successful login', async () => {
    const mockUser = {
      id: 'usr_123',
      phone: '+1555019999',
      name: 'Jane Doe',
      role: 'USER' as const,
      isVolunteer: false,
      mlSensitivity: 'MEDIUM' as const,
    };

    jest.spyOn(authService, 'loginCitizen').mockResolvedValueOnce({
      token: 'jwt_valid_123',
      user: mockUser,
    });

    const { getByPlaceholderText, getByText } = render(
      <CitizenAuth
        backendUrl="http://localhost:3000"
        onAuthSuccess={mockOnAuthSuccess}
        onBypassGuestMode={mockOnBypassGuestMode}
      />
    );

    fireEvent.changeText(getByPlaceholderText('+1 (555) 019-888'), '+1555019999');
    fireEvent.changeText(getByPlaceholderText('••••••••••••'), 'Password123!');
    fireEvent.press(getByText('Arm & Enter Safety HUD'));

    await waitFor(() => {
      expect(authService.loginCitizen).toHaveBeenCalledWith(
        '+1555019999',
        'Password123!',
        'http://localhost:3000'
      );
      expect(mockOnAuthSuccess).toHaveBeenCalledWith(mockUser, 'jwt_valid_123');
    });
  });

  it('should display error message when login fails', async () => {
    jest.spyOn(authService, 'loginCitizen').mockRejectedValueOnce(
      new Error('Invalid phone or password')
    );

    const { getByPlaceholderText, getByText, findByText } = render(
      <CitizenAuth
        backendUrl="http://localhost:3000"
        onAuthSuccess={mockOnAuthSuccess}
        onBypassGuestMode={mockOnBypassGuestMode}
      />
    );

    fireEvent.changeText(getByPlaceholderText('+1 (555) 019-888'), '+1555019999');
    fireEvent.changeText(getByPlaceholderText('••••••••••••'), 'WrongPassword');
    fireEvent.press(getByText('Arm & Enter Safety HUD'));

    const errorElement = await findByText(/Invalid phone or password/i);
    expect(errorElement).toBeTruthy();
    expect(mockOnAuthSuccess).not.toHaveBeenCalled();
  });
});
