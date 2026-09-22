import { Field, ID, Int, Float, ObjectType, registerEnumType } from '@nestjs/graphql';
import { UserRole, MlSensitivity, TriggerType, IncidentStatus } from '@prisma/client';

registerEnumType(UserRole, { name: 'UserRole' });
registerEnumType(MlSensitivity, { name: 'MlSensitivity' });
registerEnumType(TriggerType, { name: 'TriggerType' });
registerEnumType(IncidentStatus, { name: 'IncidentStatus' });

@ObjectType()
export class LocationLog {
  @Field(() => ID)
  id: string;

  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;

  @Field(() => Int, { nullable: true })
  batteryLevel?: number | null;

  @Field(() => String)
  loggedAt: string;
}

@ObjectType()
export class Incident {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  userId: string;

  @Field(() => TriggerType)
  triggerType: TriggerType;

  @Field(() => IncidentStatus)
  status: IncidentStatus;

  @Field(() => String)
  startedAt: string;

  @Field(() => String, { nullable: true })
  resolvedAt?: string | null;

  @Field(() => String, { nullable: true })
  resolvedByUserId?: string | null;

  @Field(() => [LocationLog])
  locationLogs: LocationLog[];

  @Field(() => String, { nullable: true })
  evidenceAudioUrl?: string | null;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  phone: string;

  @Field(() => String)
  name: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field(() => Boolean)
  isVolunteer: boolean;

  @Field(() => MlSensitivity)
  mlSensitivity: MlSensitivity;

  @Field(() => String)
  createdAt: string;

  @Field(() => [Incident])
  incidents: Incident[];
}

@ObjectType()
export class SystemConfigModel {
  @Field(() => Float)
  yamnetScreamThreshold: number;

  @Field(() => Float)
  openWakeWordThreshold: number;

  @Field(() => Float)
  snatchThresholdG: number;

  @Field(() => Float)
  batteryCriticalThreshold: number;

  @Field(() => Int)
  deadmanTimeoutMins: number;

  @Field(() => String)
  updatedAt: string;
}

