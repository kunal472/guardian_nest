import { Platform } from 'react-native';

export interface EmergencyContact {
  id?: string;
  contactName: string;
  phoneNumber: string;
  priorityOrder?: number;
}

export interface CitizenUser {
  id: string;
  phone: string;
  name: string;
  role: 'USER' | 'RESPONDER' | 'ADMIN';
  isVolunteer: boolean;
  mlSensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  emergencyContacts?: EmergencyContact[];
}

export interface AuthResponse {
  token: string;
  user: CitizenUser;
}

const TOKEN_KEY = 'guardian_citizen_token';
const USER_KEY = 'guardian_citizen_user';

let memoryToken: string | null = null;
let memoryUser: CitizenUser | null = null;

export async function loginCitizen(
  phone: string,
  password: string,
  backendUrl: string = 'http://localhost:3000'
): Promise<AuthResponse> {
  const res = await fetch(`${backendUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Citizen login failed. Please verify credentials.');
  }

  const data: AuthResponse = await res.json();
  setStoredCitizenAuth(data.token, data.user);
  return data;
}

export async function registerCitizen(
  params: {
    phone: string;
    password: string;
    name: string;
    isVolunteer?: boolean;
    mlSensitivity?: 'LOW' | 'MEDIUM' | 'HIGH';
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  },
  backendUrl: string = 'http://localhost:3000'
): Promise<AuthResponse> {
  const res = await fetch(`${backendUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: params.phone,
      password: params.password,
      name: params.name,
      role: 'USER',
      isVolunteer: params.isVolunteer ?? false,
      mlSensitivity: params.mlSensitivity ?? 'MEDIUM',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Citizen registration failed.');
  }

  const data: AuthResponse = await res.json();

  // If user provided primary emergency contact, store in user object
  if (params.emergencyContactName && params.emergencyContactPhone) {
    const contact: EmergencyContact = {
      contactName: params.emergencyContactName,
      phoneNumber: params.emergencyContactPhone,
      priorityOrder: 1,
    };
    data.user.emergencyContacts = [contact];
  }

  setStoredCitizenAuth(data.token, data.user);
  return data;
}

export function getStoredCitizenAuth(): { token: string; user: CitizenUser } | null {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);
    if (token && userJson) {
      try {
        return { token, user: JSON.parse(userJson) };
      } catch {
        return null;
      }
    }
  }

  if (memoryToken && memoryUser) {
    return { token: memoryToken, user: memoryUser };
  }
  return null;
}

export function setStoredCitizenAuth(token: string, user: CitizenUser): void {
  memoryToken = token;
  memoryUser = user;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearStoredCitizenAuth(): void {
  memoryToken = null;
  memoryUser = null;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
