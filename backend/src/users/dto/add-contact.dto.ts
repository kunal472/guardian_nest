import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddEmergencyContactDto {
  @IsString()
  @IsNotEmpty()
  contactName: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsInt()
  @IsOptional()
  priorityOrder?: number;
}
