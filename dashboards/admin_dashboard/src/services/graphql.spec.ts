import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchGraphQL } from './graphql';

describe('Admin GraphQL service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should include Authorization header when token is in localStorage and return data', async () => {
    localStorage.setItem('guardian_admin_token', 'admin_jwt_123');

    const mockData = { activeIncidentsCount: 3 };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockData }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchGraphQL<{ activeIncidentsCount: number }>('query { activeIncidentsCount }');
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer admin_jwt_123',
        }),
      }),
    );
  });

  it('should warn on GraphQL errors and return data or null on fetch network exception', async () => {
    localStorage.removeItem('guardian_admin_token');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: null, errors: [{ message: 'Field not found' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchGraphQL('query { invalid }');
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    // Exception handling
    mockFetch.mockRejectedValue(new Error('Network error'));
    const resErr = await fetchGraphQL('query { test }');
    expect(resErr).toBeNull();
  });
});
