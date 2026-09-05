const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: string;
  isVolunteer: boolean;
  mlSensitivity: string;
}

export interface LocationLog {
  id: string;
  lat: number;
  lng: number;
  batteryLevel?: number;
  loggedAt: string;
}

export interface Incident {
  id: string;
  userId: string;
  triggerType: 'MANUAL_SOS' | 'AUDIO_SCREAM' | 'DEVICE_SNATCH' | 'DEAD_MAN_SWITCH';
  status: 'ACTIVE' | 'DISPATCHED' | 'RESOLVED' | 'FALSE_ALARM';
  startedAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  evidenceAudioUrl?: string;
  locationLogs: LocationLog[];
  user?: {
    id: string;
    name: string;
    phone: string;
  };
}

export async function loginDemoResponder(): Promise<{ token: string; user: User }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '+1999888777', password: 'password123' }),
    });
    if (res.ok) return await res.json();

    // Register if doesn't exist
    const regRes = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '+1999888777',
        password: 'password123',
        name: 'Dispatch Central Alpha',
        role: 'RESPONDER',
      }),
    });
    return await regRes.json();
  } catch (err) {
    console.warn('Backend login fallback:', err);
    return {
      token: 'demo_token',
      user: {
        id: 'u_responder_1',
        phone: '+1999888777',
        name: 'Dispatch Central Alpha',
        role: 'RESPONDER',
        isVolunteer: true,
        mlSensitivity: 'HIGH',
      },
    };
  }
}

export async function fetchIncidents(token?: string): Promise<Incident[]> {
  try {
    const res = await fetch(`${API_URL}/api/incidents`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('Failed to fetch incidents from API:', err);
  }
  return [];
}

export async function updateIncidentStatus(
  incidentId: string,
  status: string,
  token?: string,
): Promise<Incident | null> {
  try {
    const res = await fetch(`${API_URL}/api/incidents/${incidentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.error('Failed to update status:', err);
  }
  return null;
}
