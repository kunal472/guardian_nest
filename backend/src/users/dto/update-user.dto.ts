import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { MlSensitivity } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isVolunteer?: boolean;

  @IsEnum(MlSensitivity)
  @IsOptional()
  mlSensitivity?: MlSensitivity;
}
