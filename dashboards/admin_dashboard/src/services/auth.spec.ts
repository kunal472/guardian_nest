import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loginAdmin,
  registerAdmin,
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  AdminAuthUser,
} from './auth';

describe('Admin auth service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockAdminUser: AdminAuthUser = {
    id: 'u-admin-1',
    name: 'Chief Commander',
    phone: '+1555000999',
    role: 'ADMIN',
  };

  describe('loginAdmin', () => {
    it('should successfully log in admin user and store auth token', async () => {
      const mockResponse = { token: 'jwt_admin_token_123', user: mockAdminUser };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      );

      const result = await loginAdmin('+1555000999', 'Password123!');
      expect(result).toEqual(mockResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('guardian_admin_token', 'jwt_admin_token_123');
    });

    it('should reject login if user role is not ADMIN', async () => {
      const nonAdminUser = { ...mockAdminUser, role: 'USER' };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ token: 'jwt_token', user: nonAdminUser }),
        }),
      );

      await expect(loginAdmin('+1555000999', 'Password123!')).rejects.toThrow('Access denied');
    });

    it('should throw server error message when login fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ message: 'Invalid credentials' }),
        }),
      );

      await expect(loginAdmin('+1555000999', 'WrongPassword')).rejects.toThrow('Invalid credentials');
    });
  });

  describe('registerAdmin', () => {
    it('should register admin user and store token', async () => {
      const mockResponse = { token: 'jwt_new_admin_token', user: mockAdminUser };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      );

      const result = await registerAdmin('+1555000999', 'Password123!', 'Chief Commander');
      expect(result).toEqual(mockResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('guardian_admin_token', 'jwt_new_admin_token');
    });

    it('should throw error when registration fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ message: 'Phone taken' }),
        }),
      );

      await expect(registerAdmin('+1555000999', 'Password123!', 'Name')).rejects.toThrow('Phone taken');
    });
  });

  describe('storage helpers', () => {
    it('getStoredAuth should return null if not stored or corrupt', () => {
      expect(getStoredAuth()).toBeNull();

      localStorage.setItem('guardian_admin_token', 'tok');
      localStorage.setItem('guardian_admin_user', 'invalid-json');
      expect(getStoredAuth()).toBeNull();
    });

    it('setStoredAuth, getStoredAuth, and clearStoredAuth should work properly', () => {
      setStoredAuth('tok-1', mockAdminUser);
      const auth = getStoredAuth();
      expect(auth?.token).toBe('tok-1');
      expect(auth?.user.name).toBe('Chief Commander');

      clearStoredAuth();
      expect(localStorage.removeItem).toHaveBeenCalledWith('guardian_admin_token');
    });
  });
});
