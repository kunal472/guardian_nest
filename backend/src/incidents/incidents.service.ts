import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentStatus, TriggerType } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async createIncident(userId: string, dto: CreateIncidentDto) {
    const incident = await this.prisma.incident.create({
      data: {
        userId,
        triggerType: dto.triggerType,
        status: IncidentStatus.ACTIVE,
        evidenceAudioUrl: dto.evidenceAudioUrl,
        locationLogs: {
          create: {
            lat: dto.lat,
            lng: dto.lng,
            batteryLevel: dto.batteryLevel ?? 100,
          },
        },
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
        locationLogs: true,
      },
    });

    // Cache active incident in Redis
    await this.redis.cacheActiveIncident(incident.id, {
      userId,
      name: incident.user.name,
      phone: incident.user.phone,
      lastLat: dto.lat,
      lastLng: dto.lng,
      batteryLevel: dto.batteryLevel ?? 100,
      triggerType: dto.triggerType,
      status: IncidentStatus.ACTIVE,
      startedAt: incident.startedAt,
      activeResponders: [],
    });

    return incident;
  }

  async recordLocationUpdate(
    incidentId: string,
    lat: number,
    lng: number,
    batteryLevel?: number,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const lastDbWriteKey = `incident:${incidentId}:last_db_write`;

    // 1. Redis is always updated immediately for real-time tracking
    const activeData = (await this.redis.getActiveIncident(incidentId)) || {};
    await this.redis.cacheActiveIncident(incidentId, {
      ...activeData,
      lastLat: lat,
      lastLng: lng,
      batteryLevel: batteryLevel ?? activeData.batteryLevel ?? 100,
      lastUpdated: now,
    });

    // 2. PostgreSQL insertions are throttled to 1 write every 2 seconds per incident
    const lastWrite = await this.redis.get(lastDbWriteKey);
    if (!lastWrite || now - parseInt(lastWrite, 10) >= 2) {
      await this.redis.set(lastDbWriteKey, now.toString(), 3600);
      try {
        await this.prisma.incidentLocationLog.create({
          data: {
            incidentId,
            lat,
            lng,
            batteryLevel: batteryLevel ?? 100,
          },
        });
      } catch (err) {
        // Ignore DB insert errors if incident was just cleaned up
      }
    }

    return { success: true, incidentId, lat, lng };
  }

  async updateStatus(
    incidentId: string,
    status: IncidentStatus,
    resolvedByUserId?: string,
  ) {
    const incident = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        status,
        ...(status === IncidentStatus.RESOLVED || status === IncidentStatus.FALSE_ALARM
          ? {
              resolvedAt: new Date(),
              resolvedByUserId,
            }
          : {}),
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        locationLogs: { orderBy: { loggedAt: 'desc' }, take: 10 },
      },
    });

    // Update Redis cache
    const activeData = (await this.redis.getActiveIncident(incidentId)) || {};
    if (status === IncidentStatus.RESOLVED || status === IncidentStatus.FALSE_ALARM) {
      await this.redis.cacheActiveIncident(incidentId, {
        ...activeData,
        status,
        resolvedAt: new Date().toISOString(),
      });
    } else {
      await this.redis.cacheActiveIncident(incidentId, {
        ...activeData,
        status,
      });
    }

    return incident;
  }

  async getAllIncidents(status?: IncidentStatus) {
    return this.prisma.incident.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        resolvedByUser: { select: { id: true, name: true } },
        locationLogs: {
          orderBy: { loggedAt: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async getIncidentById(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        resolvedByUser: { select: { id: true, name: true } },
        locationLogs: {
          orderBy: { loggedAt: 'asc' },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException(`Incident #${id} not found`);
    }

    return incident;
  }

  async getActiveCount() {
    return this.prisma.incident.count({
      where: { status: IncidentStatus.ACTIVE },
    });
  }

  generateAudioPresignedUrl(incidentId: string) {
    return `https://guardian-evidence-vault.s3.amazonaws.com/${incidentId}/evidence_${Date.now()}.m4a?token=mock_presigned_url_valid_300s`;
  }
}
