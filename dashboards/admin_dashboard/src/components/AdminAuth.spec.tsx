import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminAuth } from './AdminAuth';
import * as authService from '../services/auth';

describe('AdminAuth Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should render login form, allow demo prefill, and call onAuthSuccess on submit', async () => {
    const onAuthSuccess = vi.fn();
    const mockUser: authService.AdminAuthUser = {
      id: 'u-1',
      name: 'Admin Chief',
      phone: '+18005550199',
      role: 'ADMIN',
    };

    vi.spyOn(authService, 'loginAdmin').mockResolvedValue({
      token: 'jwt_123',
      user: mockUser,
    });

    render(<AdminAuth onAuthSuccess={onAuthSuccess} />);

    expect(screen.getByText('GUARDIAN')).toBeInTheDocument();
    expect(screen.getByText('COMMAND')).toBeInTheDocument();

    // Type in phone and password manually
    const phoneInput = screen.getByPlaceholderText('+1 (555) 000-0000');
    const passInput = screen.getByPlaceholderText('••••••••••••');

    fireEvent.change(phoneInput, { target: { value: '+18005550199' } });
    fireEvent.change(passInput, { target: { value: 'admin_root_secure' } });

    const submitBtn = screen.getByText('Authorize Session');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalledWith(mockUser, 'jwt_123');
    });
  });

  it('should validate registration passcode before calling registerAdmin', async () => {
    const onAuthSuccess = vi.fn();
    vi.spyOn(authService, 'registerAdmin').mockResolvedValue({
      token: 'jwt_reg_123',
      user: {
        id: 'u-2',
        name: 'Commander Jane',
        phone: '+1555123456',
        role: 'ADMIN',
      },
    });

    render(<AdminAuth onAuthSuccess={onAuthSuccess} />);

    const registerTab = screen.getByText('Register Admin');
    fireEvent.click(registerTab);

    expect(screen.getByText('Master Clearance Key')).toBeInTheDocument();

    // Type in registration inputs manually
    const nameInput = screen.getByPlaceholderText('e.g. Commander Sarah Jenkins');
    const phoneInput = screen.getByPlaceholderText('+1 (555) 000-0000');
    const passInput = screen.getByPlaceholderText('••••••••••••');
    const codeInput = screen.getByPlaceholderText('Enter GUARDIAN_ROOT_2026');

    fireEvent.change(nameInput, { target: { value: 'Commander Jane' } });
    fireEvent.change(phoneInput, { target: { value: '+1555123456' } });
    fireEvent.change(passInput, { target: { value: 'Password123!' } });
    fireEvent.change(codeInput, { target: { value: 'GUARDIAN_ROOT_2026' } });

    const submitBtn = screen.getByText('Create Admin Clearance');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onAuthSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ADMIN' }),
        'jwt_reg_123',
      );
    });
  });

  it('should display error message if login fails', async () => {
    vi.spyOn(authService, 'loginAdmin').mockRejectedValue(new Error('Invalid credentials provided'));

    render(<AdminAuth onAuthSuccess={vi.fn()} />);

    const prefillBtn = screen.getByText('Pre-fill Sample Credentials');
    fireEvent.click(prefillBtn);

    const submitBtn = screen.getByText('Authorize Session');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials provided')).toBeInTheDocument();
    });
  });

  it('should switch between sign in and register tabs clearing errors', () => {
    render(<AdminAuth onAuthSuccess={vi.fn()} />);
    const registerTab = screen.getByText('Register Admin');
    fireEvent.click(registerTab);

    const signInTab = screen.getByText('Admin Sign In');
    fireEvent.click(signInTab);
    expect(screen.getByText('Admin Sign In')).toBeInTheDocument();
  });
});
