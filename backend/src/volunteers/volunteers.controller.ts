import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VolunteersService } from './volunteers.service';

@Controller('api/volunteers')
@UseGuards(JwtAuthGuard)
export class VolunteersController {
  constructor(private volunteersService: VolunteersService) {}

  @Post('opt-in')
  async optIn(@Req() req: any) {
    return this.volunteersService.optIn(req.user.id);
  }

  @Post('location')
  async updateLocation(@Req() req: any, @Body() body: { lat: number; lng: number }) {
    return this.volunteersService.updateLocation(req.user.id, body.lat, body.lng);
  }
}
