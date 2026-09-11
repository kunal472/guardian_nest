const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface AdminAuthUser {
  id: string;
  phone: string;
  name: string;
  role: 'ADMIN' | 'RESPONDER' | 'USER';
  isVolunteer?: boolean;
}

export interface AuthResponse {
  token: string;
  user: AdminAuthUser;
}

const TOKEN_KEY = 'guardian_admin_token';
const USER_KEY = 'guardian_admin_user';

export async function loginAdmin(phone: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Authentication failed. Please check credentials.');
  }

  const data: AuthResponse = await res.json();
  if (data.user.role !== 'ADMIN') {
    throw new Error('Access denied: You must have an ADMIN role to access this portal.');
  }

  setStoredAuth(data.token, data.user);
  return data;
}

export async function registerAdmin(
  phone: string,
  password: string,
  name: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      password,
      name,
      role: 'ADMIN',
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Admin registration failed.');
  }

  const data: AuthResponse = await res.json();
  setStoredAuth(data.token, data.user);
  return data;
}

export function getStoredAuth(): { token: string; user: AdminAuthUser } | null {
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

export function setStoredAuth(token: string, user: AdminAuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
