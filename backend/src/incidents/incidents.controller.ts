import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentStatus } from '@prisma/client';

@Controller('api/incidents')
@UseGuards(JwtAuthGuard)
export class IncidentsController {
  constructor(private incidentsService: IncidentsService) {}

  @Post()
  async createIncident(@Req() req: any, @Body() dto: CreateIncidentDto) {
    return this.incidentsService.createIncident(req.user.id, dto);
  }

  @Post(':id/location')
  async recordLocation(
    @Param('id') incidentId: string,
    @Body() body: { lat: number; lng: number; batteryLevel?: number },
  ) {
    return this.incidentsService.recordLocationUpdate(
      incidentId,
      body.lat,
      body.lng,
      body.batteryLevel,
    );
  }

  @Get()
  async getAllIncidents(@Query('status') status?: IncidentStatus) {
    return this.incidentsService.getAllIncidents(status);
  }

  @Get('active/count')
  async getActiveCount() {
    const count = await this.incidentsService.getActiveCount();
    return { activeIncidentsCount: count };
  }

  @Get(':id')
  async getIncidentById(@Param('id') id: string) {
    return this.incidentsService.getIncidentById(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: IncidentStatus,
  ) {
    return this.incidentsService.updateStatus(id, status, req.user.id);
  }

  @Get(':id/audio-presigned-url')
  async getPresignedAudioUrl(@Param('id') id: string) {
    const url = this.incidentsService.generateAudioPresignedUrl(id);
    return { presignedUrl: url, expiresInSeconds: 300 };
  }
}
