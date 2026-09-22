export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost'
  ) {
    return `http://${window.location.hostname}:3000`;
  }
  return 'http://localhost:3000';
}

const INCIDENTS_CACHE_KEY = 'guardian_responder_cached_incidents';

export function getCachedIncidents(): Incident[] {
  try {
    const raw = localStorage.getItem(INCIDENTS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCachedIncidents(incidents: Incident[]): void {
  try {
    if (incidents && Array.isArray(incidents)) {
      localStorage.setItem(INCIDENTS_CACHE_KEY, JSON.stringify(incidents));
    }
  } catch (e) {
    console.warn('Failed to cache incidents in localStorage:', e);
  }
}

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
  const API_URL = getApiBaseUrl();
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
  const API_URL = getApiBaseUrl();
  const activeToken = token || localStorage.getItem('guardian_responder_token') || '';
  try {
    const res = await fetch(`${API_URL}/api/incidents`, {
      headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveCachedIncidents(data);
        return data;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch incidents from API, using cached state:', err);
  }
  return getCachedIncidents();
}

export async function updateIncidentStatus(
  incidentId: string,
  status: string,
  token?: string,
): Promise<Incident | null> {
  const API_URL = getApiBaseUrl();
  const activeToken = token || localStorage.getItem('guardian_responder_token') || '';
  try {
    const res = await fetch(`${API_URL}/api/incidents/${incidentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      const cached = getCachedIncidents();
      const updatedList = cached.map((i) => (i.id === incidentId ? { ...i, status } : i));
      saveCachedIncidents(updatedList);
      return updated;
    }
  } catch (err) {
    console.error('Failed to update status:', err);
  }
  return null;
}
