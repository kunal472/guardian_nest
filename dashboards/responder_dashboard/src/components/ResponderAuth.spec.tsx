import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponderAuth } from './ResponderAuth';
import * as authService from '../services/auth';

describe('ResponderAuth Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default and allows switching to register form', () => {
    render(<ResponderAuth onAuthSuccess={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /RESPONDER/i })).toBeInTheDocument();
    expect(screen.getByText(/Connect to Dispatch Bus/i)).toBeInTheDocument();

    // Switch to Register
    fireEvent.click(screen.getByText(/Enlist Unit/i));
    expect(screen.getByText(/Unit Call-Sign \/ Full Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Register & Deploy Unit/i)).toBeInTheDocument();

    // Switch back to Login
    fireEvent.click(screen.getByText(/Responder Login/i));
    expect(screen.queryByText(/Unit Call-Sign \/ Full Name/i)).not.toBeInTheDocument();
  });

  it('prefills sample responder credentials when clicking pre-fill button', () => {
    render(<ResponderAuth onAuthSuccess={vi.fn()} />);

    const prefillBtn = screen.getByText(/Pre-fill Sample Responder/i);
    fireEvent.click(prefillBtn);

    const phoneInput = screen.getByPlaceholderText('+1 (999) 888-777') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('••••••••••••') as HTMLInputElement;

    expect(phoneInput.value).toBe('+1999888777');
    expect(passwordInput.value).toBe('password123');
  });

  it('validates empty phone or password submission', async () => {
    render(<ResponderAuth onAuthSuccess={vi.fn()} />);

    const form = screen.getByRole('button', { name: /Connect to Dispatch Bus/i }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(
        screen.getByText(/Please provide your registered phone number and credentials/i),
      ).toBeInTheDocument();
    });
  });

  it('validates empty name when registering', async () => {
    render(<ResponderAuth onAuthSuccess={vi.fn()} />);

    fireEvent.click(screen.getByText(/Enlist Unit/i));

    const phoneInput = screen.getByPlaceholderText('+1 (999) 888-777');
    const passwordInput = screen.getByPlaceholderText('••••••••••••');

    fireEvent.change(phoneInput, { target: { value: '+1999888777' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const form = screen.getByRole('button', { name: /Register & Deploy Unit/i }).closest('form');
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(
        screen.getByText(/Please specify responder call-sign or full identity/i),
      ).toBeInTheDocument();
    });
  });

  it('handles successful login and calls onAuthSuccess', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onAuthSuccessMock = vi.fn();
    const mockUser: authService.ResponderUser = {
      id: 'u-1',
      phone: '+1999888777',
      name: 'Alpha One',
      role: 'RESPONDER',
    };

    vi.spyOn(authService, 'loginResponder').mockResolvedValueOnce({
      token: 'jwt-alpha',
      user: mockUser,
    });

    render(<ResponderAuth onAuthSuccess={onAuthSuccessMock} />);

    fireEvent.click(screen.getByText(/Pre-fill Sample Responder/i));
    fireEvent.click(screen.getByRole('button', { name: /Connect to Dispatch Bus/i }));

    await waitFor(() => {
      expect(screen.getByText(/Dispatch Verified/i)).toBeInTheDocument();
    });

    vi.advanceTimersByTime(700);

    expect(onAuthSuccessMock).toHaveBeenCalledWith(mockUser, 'jwt-alpha');
    vi.useRealTimers();
  });

  it('handles successful registration and volunteer checkbox toggle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onAuthSuccessMock = vi.fn();
    const mockUser: authService.ResponderUser = {
      id: 'u-2',
      phone: '+1999888777',
      name: 'Bravo Two',
      role: 'RESPONDER',
      isVolunteer: false,
    };

    vi.spyOn(authService, 'registerResponder').mockResolvedValueOnce({
      token: 'jwt-bravo',
      user: mockUser,
    });

    render(<ResponderAuth onAuthSuccess={onAuthSuccessMock} />);

    fireEvent.click(screen.getByText(/Enlist Unit/i));
    fireEvent.click(screen.getByText(/Pre-fill Sample Responder/i));

    // Toggle volunteer checkbox container
    const volunteerContainer = screen.getByText(/Active Proximity Volunteer/i).closest('div');
    fireEvent.click(volunteerContainer!);

    fireEvent.click(screen.getByRole('button', { name: /Register & Deploy Unit/i }));

    await waitFor(() => {
      expect(screen.getByText(/enlisted in Emergency Response Matrix/i)).toBeInTheDocument();
    });

    vi.advanceTimersByTime(700);

    expect(onAuthSuccessMock).toHaveBeenCalledWith(mockUser, 'jwt-bravo');
    vi.useRealTimers();
  });

  it('displays error message when login fails', async () => {
    vi.spyOn(authService, 'loginResponder').mockRejectedValueOnce(
      new Error('Invalid dispatch credentials'),
    );

    render(<ResponderAuth onAuthSuccess={vi.fn()} />);

    fireEvent.click(screen.getByText(/Pre-fill Sample Responder/i));
    fireEvent.click(screen.getByRole('button', { name: /Connect to Dispatch Bus/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid dispatch credentials')).toBeInTheDocument();
    });
  });
});
