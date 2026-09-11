const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ResponderUser {
  id: string;
  phone: string;
  name: string;
  role: 'RESPONDER' | 'ADMIN' | 'USER';
  isVolunteer?: boolean;
  mlSensitivity?: string;
}

export interface AuthResponse {
  token: string;
  user: ResponderUser;
}

const TOKEN_KEY = 'guardian_responder_token';
const USER_KEY = 'guardian_responder_user';

export async function loginResponder(phone: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Responder authentication failed.');
  }

  const data: AuthResponse = await res.json();
  if (data.user.role !== 'RESPONDER' && data.user.role !== 'ADMIN') {
    throw new Error('Access denied: You must have a RESPONDER or ADMIN clearance.');
  }

  setStoredResponderAuth(data.token, data.user);
  return data;
}

export async function registerResponder(
  phone: string,
  password: string,
  name: string,
  isVolunteer: boolean = true
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      password,
      name,
      role: 'RESPONDER',
      isVolunteer,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Responder registration failed.');
  }

  const data: AuthResponse = await res.json();
  setStoredResponderAuth(data.token, data.user);
  return data;
}

export function getStoredResponderAuth(): { token: string; user: ResponderUser } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const userJson = localStorage.getItem(USER_KEY);
  if (!token || !userJson) return null;
  try {
    const user = JSON.parse(userJson);
    return { token, user };
  } catch {
    return null;
  }
}

export function setStoredResponderAuth(token: string, user: ResponderUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredResponderAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
