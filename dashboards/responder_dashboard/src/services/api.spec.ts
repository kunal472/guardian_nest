import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loginDemoResponder,
  fetchIncidents,
  updateIncidentStatus,
  getCachedIncidents,
  saveCachedIncidents,
} from './api';

describe('api service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    localStorage.clear();
  });

  describe('loginDemoResponder', () => {
    it('returns login data if login endpoint responds ok', async () => {
      const mockResponse = {
        token: 'jwt_token_123',
        user: {
          id: 'u1',
          phone: '+1999888777',
          name: 'Central Alpha',
          role: 'RESPONDER',
          isVolunteer: true,
          mlSensitivity: 'HIGH',
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await loginDemoResponder();
      expect(result).toEqual(mockResponse);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ phone: '+1999888777', password: 'password123' }),
        }),
      );
    });

    it('falls back to register endpoint if login returns not ok', async () => {
      const mockRegistered = {
        token: 'registered_token',
        user: {
          id: 'u2',
          phone: '+1999888777',
          name: 'Dispatch Central Alpha',
          role: 'RESPONDER',
          isVolunteer: true,
          mlSensitivity: 'HIGH',
        },
      };

      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegistered,
        });

      const result = await loginDemoResponder();
      expect(result).toEqual(mockRegistered);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('returns fallback demo token and user if fetch throws network error', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await loginDemoResponder();
      expect(result.token).toBe('demo_token');
      expect(result.user.name).toBe('Dispatch Central Alpha');
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('fetchIncidents', () => {
    it('fetches incidents successfully with auth token', async () => {
      const mockIncidents = [
        {
          id: 'inc-1',
          userId: 'u-1',
          triggerType: 'MANUAL_SOS',
          status: 'ACTIVE',
          startedAt: new Date().toISOString(),
          locationLogs: [],
        },
      ];

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockIncidents,
      });

      const result = await fetchIncidents('bearer_token');
      expect(result).toEqual(mockIncidents);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/incidents',
        { headers: { Authorization: 'Bearer bearer_token' } },
      );
    });

    it('returns empty array when API response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
      const result = await fetchIncidents();
      expect(result).toEqual([]);
    });

    it('returns empty array and logs warning if fetch throws', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Fetch failed'));

      const result = await fetchIncidents();
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('updateIncidentStatus', () => {
    it('updates incident status successfully', async () => {
      const updated = {
        id: 'inc-1',
        userId: 'u-1',
        triggerType: 'MANUAL_SOS',
        status: 'DISPATCHED',
        startedAt: new Date().toISOString(),
        locationLogs: [],
      };

      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => updated,
      });

      const result = await updateIncidentStatus('inc-1', 'DISPATCHED', 'auth_jwt');
      expect(result).toEqual(updated);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/incidents/inc-1/status',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer auth_jwt',
          },
          body: JSON.stringify({ status: 'DISPATCHED' }),
        },
      );
    });

    it('returns null if response is not ok', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false });
      const result = await updateIncidentStatus('inc-1', 'RESOLVED');
      expect(result).toBeNull();
    });

    it('returns null and logs error if fetch throws', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

      const result = await updateIncidentStatus('inc-1', 'RESOLVED');
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
