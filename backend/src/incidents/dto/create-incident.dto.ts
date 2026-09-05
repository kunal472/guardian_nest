import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { TriggerType } from '@prisma/client';

export class CreateIncidentDto {
  @IsEnum(TriggerType)
  triggerType: TriggerType;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;

  @IsNumber()
  @IsOptional()
  batteryLevel?: number;

  @IsString()
  @IsOptional()
  evidenceAudioUrl?: string;
}
