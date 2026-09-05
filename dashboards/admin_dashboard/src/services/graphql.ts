const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:3000/graphql';

export interface AdminUser {
  id: string;
  phone: string;
  name: string;
  role: 'USER' | 'RESPONDER' | 'ADMIN';
  isVolunteer: boolean;
  mlSensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  incidents: Array<{
    id: string;
    triggerType: string;
    status: string;
    startedAt: string;
  }>;
}

export interface AdminIncident {
  id: string;
  userId: string;
  triggerType: 'MANUAL_SOS' | 'AUDIO_SCREAM' | 'DEVICE_SNATCH' | 'DEAD_MAN_SWITCH';
  status: 'ACTIVE' | 'DISPATCHED' | 'RESOLVED' | 'FALSE_ALARM';
  startedAt: string;
  resolvedAt?: string;
  resolvedByUserId?: string;
  evidenceAudioUrl?: string;
  locationLogs: Array<{
    id: string;
    lat: number;
    lng: number;
    batteryLevel?: number;
    loggedAt: string;
  }>;
}

export async function fetchGraphQL<T>(query: string, variables: Record<string, any> = {}): Promise<T | null> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors) {
      console.warn('GraphQL Errors:', json.errors);
    }
    return json.data;
  } catch (err) {
    console.error('GraphQL fetch error:', err);
    return null;
  }
}

export const GET_DASHBOARD_DATA = `
  query GetDashboardData {
    activeIncidentsCount
    users {
      id
      phone
      name
      role
      isVolunteer
      mlSensitivity
      createdAt
      incidents {
        id
        triggerType
        status
        startedAt
      }
    }
    incidents {
      id
      userId
      triggerType
      status
      startedAt
      resolvedAt
      resolvedByUserId
      locationLogs {
        id
        lat
        lng
        batteryLevel
        loggedAt
      }
    }
  }
`;

export const UPDATE_USER_ROLE = `
  mutation UpdateUserRole($userId: ID!, $role: UserRole!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      name
      role
    }
  }
`;

export const RESOLVE_INCIDENT = `
  mutation ResolveIncident($incidentId: ID!, $status: IncidentStatus!) {
    resolveIncident(incidentId: $incidentId, status: $status) {
      id
      status
      resolvedAt
    }
  }
`;
