describe('REST API End-to-End Client Integration Tests', () => {
  const backendUrl = 'http://localhost:3000';
  const authToken = 'mock_jwt_token_456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch authenticated user profile with emergency contacts', async () => {
    const mockProfile = {
      id: 'usr_abc_123',
      phone: '+1555019999',
      name: 'Sarah Connor',
      role: 'USER',
      isVolunteer: true,
      mlSensitivity: 'HIGH',
      emergencyContacts: [
        {
          id: 'contact_01',
          contactName: 'John Connor',
          phoneNumber: '+1555018888',
          priorityOrder: 1,
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    });

    const res = await fetch(`${backendUrl}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.name).toBe('Sarah Connor');
    expect(data.emergencyContacts.length).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/users/me',
      expect.objectContaining({
        headers: { Authorization: 'Bearer mock_jwt_token_456' },
      })
    );
  });

  it('should update user profile settings and volunteer mode', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'usr_abc_123',
        isVolunteer: true,
        mlSensitivity: 'HIGH',
      }),
    });

    const res = await fetch(`${backendUrl}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ isVolunteer: true, mlSensitivity: 'HIGH' }),
    });

    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.isVolunteer).toBe(true);
  });

  it('should upload encrypted audio evidence vault to backend', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        incidentId: 'inc_test_123',
        evidenceAudioUrl: '/uploads/evidence/evidence_inc_test_123_1773900000.m4a',
        vaultSize: 45000,
      }),
    });

    const res = await fetch(`${backendUrl}/api/incidents/inc_test_123/evidence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        audioBase64: 'data:audio/m4a;base64,AAAAHGZ0eXBtcDQy...',
      }),
    });

    const data = await res.json();
    expect(res.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.evidenceAudioUrl).toContain('evidence_inc_test_123');
  });
});
