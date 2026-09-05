import { TriggerType, IncidentStatus } from '@prisma/client';

export interface DistressTriggerPayload {
  userId?: string;
  lat: number;
  lng: number;
  triggerType: TriggerType;
  batteryLevel?: number;
  evidenceAudioUrl?: string;
}

export interface LocationUpdatePayload {
  incidentId: string;
  lat: number;
  lng: number;
  batteryLevel?: number;
}

export interface VolunteerLocationPayload {
  volunteerId?: string;
  lat: number;
  lng: number;
}

export interface ResponderStatusPayload {
  incidentId: string;
  responderId?: string;
  status: IncidentStatus;
  estimatedArrivalMins?: number;
}

export interface JoinIncidentPayload {
  incidentId: string;
}

export interface SystemConfigUpdatePayload {
  type: string;
  newWeights: Record<string, any>;
}
