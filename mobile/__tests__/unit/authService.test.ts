import {
  loginCitizen,
  registerCitizen,
  getStoredCitizenAuth,
  setStoredCitizenAuth,
  clearStoredCitizenAuth,
  CitizenUser,
} from '../../src/services/authService';

describe('AuthService Unit Tests', () => {
  const mockUser: CitizenUser = {
    id: 'user-uuid-123',
    phone: '+1555019999',
    name: 'Alice Guardian',
    role: 'USER',
    isVolunteer: false,
    mlSensitivity: 'MEDIUM',
    emergencyContacts: [
      {
        contactName: 'Bob Guardian',
        phoneNumber: '+1555018888',
        priorityOrder: 1,
      },
    ],
  };

  const mockToken = 'mock_jwt_token_payload';

  beforeEach(() => {
    clearStoredCitizenAuth();
    jest.clearAllMocks();
  });

  describe('Session Storage Management', () => {
    it('should store, retrieve, and clear authenticated user credentials in memory', () => {
      expect(getStoredCitizenAuth()).toBeNull();

      setStoredCitizenAuth(mockToken, mockUser);

      const stored = getStoredCitizenAuth();
      expect(stored).not.toBeNull();
      expect(stored!.token).toBe(mockToken);
      expect(stored!.user.phone).toBe('+1555019999');

      clearStoredCitizenAuth();
      expect(getStoredCitizenAuth()).toBeNull();
    });
  });

  describe('Login Flow', () => {
    it('should successfully authenticate user via REST and store token', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: mockToken,
          user: mockUser,
        }),
      });

      const response = await loginCitizen('+1555019999', 'secure_pass123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '+1555019999', password: 'secure_pass123' }),
        })
      );

      expect(response.token).toBe(mockToken);
      expect(response.user.name).toBe('Alice Guardian');
      expect(getStoredCitizenAuth()?.token).toBe(mockToken);
    });

    it('should throw an error with server message when login fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid phone or password' }),
      });

      await expect(loginCitizen('+1555019999', 'wrong_pass')).rejects.toThrow(
        'Invalid phone or password'
      );
    });
  });

  describe('Registration Flow', () => {
    it('should register a new user and attach primary emergency contact', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: mockToken,
          user: {
            id: 'user-uuid-new',
            phone: '+1555017777',
            name: 'New Citizen',
            role: 'USER',
            isVolunteer: true,
            mlSensitivity: 'HIGH',
          },
        }),
      });

      const response = await registerCitizen({
        phone: '+1555017777',
        password: 'Password123!',
        name: 'New Citizen',
        isVolunteer: true,
        mlSensitivity: 'HIGH',
        emergencyContactName: 'Primary Contact',
        emergencyContactPhone: '+1555016666',
      });

      expect(response.token).toBe(mockToken);
      expect(response.user.emergencyContacts?.length).toBe(1);
      expect(response.user.emergencyContacts![0].contactName).toBe('Primary Contact');
    });

    it('should throw error when registration fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Phone already registered' }),
      });

      await expect(
        registerCitizen({
          phone: '+1555017777',
          password: 'pass',
          name: 'Name',
        })
      ).rejects.toThrow('Phone already registered');
    });
  });
});
