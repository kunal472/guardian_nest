import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loginResponder,
  registerResponder,
  getStoredResponderAuth,
  setStoredResponderAuth,
  clearStoredResponderAuth,
  ResponderUser,
} from './auth';

describe('auth service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('loginResponder', () => {
    it('authenticates responder successfully and stores auth in localStorage', async () => {
      const mockUser: ResponderUser = {
        id: 'u-resp-1',
        phone: '+1999888777',
        name: 'Unit 4-Echo',
        role: 'RESPONDER',
        isVolunteer: true,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-123', user: mockUser }),
      });

      const res = await loginResponder('+1999888777', 'password123');
      expect(res.token).toBe('jwt-123');
      expect(res.user.role).toBe('RESPONDER');
      expect(localStorage.setItem).toHaveBeenCalledWith('guardian_responder_token', 'jwt-123');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'guardian_responder_user',
        JSON.stringify(mockUser),
      );
    });

    it('authenticates admin role successfully', async () => {
      const mockAdmin: ResponderUser = {
        id: 'u-admin-1',
        phone: '+1999000111',
        name: 'Admin Boss',
        role: 'ADMIN',
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-admin', user: mockAdmin }),
      });

      const res = await loginResponder('+1999000111', 'secret');
      expect(res.user.role).toBe('ADMIN');
    });

    it('throws error if response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid phone or password' }),
      });

      await expect(loginResponder('+1999888777', 'wrong')).rejects.toThrow(
        'Invalid phone or password',
      );
    });

    it('throws default error if response is not ok and json fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('parse error');
        },
      });

      await expect(loginResponder('+1999888777', 'wrong')).rejects.toThrow(
        'Responder authentication failed.',
      );
    });

    it('throws error if user role is neither RESPONDER nor ADMIN', async () => {
      const mockCitizen: ResponderUser = {
        id: 'u-citizen',
        phone: '+123456789',
        name: 'Citizen Jane',
        role: 'USER',
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-citizen', user: mockCitizen }),
      });

      await expect(loginResponder('+123456789', 'pass')).rejects.toThrow(
        'Access denied: You must have a RESPONDER or ADMIN clearance.',
      );
    });
  });

  describe('registerResponder', () => {
    it('registers new responder and saves token in localStorage', async () => {
      const mockUser: ResponderUser = {
        id: 'u-new',
        phone: '+1999111222',
        name: 'Unit 9-Foxtrot',
        role: 'RESPONDER',
        isVolunteer: true,
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-new', user: mockUser }),
      });

      const res = await registerResponder('+1999111222', 'pass123', 'Unit 9-Foxtrot', true);
      expect(res.token).toBe('jwt-new');
      expect(res.user.name).toBe('Unit 9-Foxtrot');
      expect(localStorage.setItem).toHaveBeenCalledWith('guardian_responder_token', 'jwt-new');
    });

    it('throws error if registration fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Phone already registered' }),
      });

      await expect(
        registerResponder('+1999111222', 'pass123', 'Unit 9-Foxtrot'),
      ).rejects.toThrow('Phone already registered');
    });

    it('throws default error if registration fails with non-json body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => {
          throw new Error('parse error');
        },
      });

      await expect(
        registerResponder('+1999111222', 'pass123', 'Unit 9-Foxtrot'),
      ).rejects.toThrow('Responder registration failed.');
    });
  });

  describe('Storage Helpers', () => {
    it('returns null if token or user is missing in localStorage', () => {
      expect(getStoredResponderAuth()).toBeNull();
    });

    it('returns parsed auth if valid token and user exist in localStorage', () => {
      const mockUser: ResponderUser = {
        id: 'u-stored',
        phone: '+1555444333',
        name: 'Stored Responder',
        role: 'RESPONDER',
      };

      setStoredResponderAuth('stored-jwt', mockUser);
      // Mock getItem responses
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'guardian_responder_token') return 'stored-jwt';
        if (key === 'guardian_responder_user') return JSON.stringify(mockUser);
        return null;
      });

      const auth = getStoredResponderAuth();
      expect(auth).toEqual({ token: 'stored-jwt', user: mockUser });
    });

    it('returns null if userJson in localStorage is corrupted JSON', () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
        if (key === 'guardian_responder_token') return 'stored-jwt';
        if (key === 'guardian_responder_user') return 'invalid-json-{';
        return null;
      });

      expect(getStoredResponderAuth()).toBeNull();
    });

    it('clears stored responder auth from localStorage', () => {
      clearStoredResponderAuth();
      expect(localStorage.removeItem).toHaveBeenCalledWith('guardian_responder_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('guardian_responder_user');
    });
  });
});
