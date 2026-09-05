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
  batteryLevel?: number;

  @Field()
  loggedAt: string;
}

@ObjectType()
export class Incident {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field(() => TriggerType)
  triggerType: TriggerType;

  @Field(() => IncidentStatus)
  status: IncidentStatus;

  @Field()
  startedAt: string;

  @Field({ nullable: true })
  resolvedAt?: string;

  @Field({ nullable: true })
  resolvedByUserId?: string;

  @Field(() => [LocationLog])
  locationLogs: LocationLog[];

  @Field({ nullable: true })
  evidenceAudioUrl?: string;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  phone: string;

  @Field()
  name: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field()
  isVolunteer: boolean;

  @Field(() => MlSensitivity)
  mlSensitivity: MlSensitivity;

  @Field()
  createdAt: string;

  @Field(() => [Incident])
  incidents: Incident[];
}
