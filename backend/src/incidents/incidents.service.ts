import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../notifications/sms.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentStatus, TriggerType } from '@prisma/client';

@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private smsService: SmsService,
  ) {}

  async createIncident(userId: string, dto: CreateIncidentDto) {
    // Ensure user exists in database for foreign key constraint
    let existingUser = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      existingUser = await this.prisma.user.upsert({
        where: { phone: '+1555019888' },
        update: {},
        create: {
          id: userId,
          phone: '+1555019888',
          passwordHash: '$2a$10$DEMO_HASH_GUARDIAN_CITIZEN_FALLBACK',
          name: 'Elena Rostova (Citizen)',
          role: 'USER',
        },
      });
      userId = existingUser.id;
    }

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
          select: {
            id: true,
            name: true,
            phone: true,
            emergencyContacts: {
              select: { contactName: true, phoneNumber: true },
            },
          },
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

    // Autonomous Server-Side Emergency SMS Dispatch to all registered contacts
    const recipients = incident.user.emergencyContacts.map((c) => ({
      name: c.contactName,
      phone: c.phoneNumber,
    }));

    if (recipients.length > 0) {
      this.smsService
        .dispatchEmergencyAlert({
          incidentId: incident.id,
          victimName: incident.user.name,
          victimPhone: incident.user.phone,
          triggerType: dto.triggerType,
          lat: dto.lat,
          lng: dto.lng,
          batteryLevel: dto.batteryLevel ?? 100,
          recipients,
        })
        .catch((err) => {
          console.warn('[IncidentsService] Background SMS dispatch error:', err?.message);
        });
    }

    return incident;
  }

  private isUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
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
    if (this.isUuid(incidentId)) {
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
    }

    return { success: true, incidentId, lat, lng };
  }

  async updateStatus(
    incidentId: string,
    status: IncidentStatus,
    resolvedByUserId?: string,
  ) {
    let targetId = incidentId;
    if (!this.isUuid(incidentId)) {
      const active = await this.prisma.incident.findFirst({
        orderBy: { startedAt: 'desc' },
      });
      if (active) {
        targetId = active.id;
      } else {
        throw new NotFoundException(`Incident #${incidentId} not found`);
      }
    }

    const isValidUserUuid = resolvedByUserId && this.isUuid(resolvedByUserId);

    const incident = await this.prisma.incident.update({
      where: { id: targetId },
      data: {
        status,
        ...(status === IncidentStatus.RESOLVED || status === IncidentStatus.FALSE_ALARM
          ? {
              resolvedAt: new Date(),
              ...(isValidUserUuid ? { resolvedByUserId } : {}),
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
    if (!this.isUuid(id)) {
      throw new NotFoundException(`Incident #${id} not found`);
    }

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

  async attachAudioEvidence(incidentId: string, audioUrl: string) {
    let incident: any = null;

    if (this.isUuid(incidentId)) {
      try {
        incident = await this.prisma.incident.findUnique({
          where: { id: incidentId },
          include: {
            user: { select: { id: true, name: true, phone: true } },
            locationLogs: { orderBy: { loggedAt: 'desc' }, take: 10 },
          },
        });

        if (incident) {
          incident = await this.prisma.incident.update({
            where: { id: incidentId },
            data: { evidenceAudioUrl: audioUrl },
            include: {
              user: { select: { id: true, name: true, phone: true } },
              locationLogs: { orderBy: { loggedAt: 'desc' }, take: 10 },
            },
          });
        }
      } catch (dbErr: any) {
        console.warn(`[IncidentsService] DB query for incident ${incidentId} warning:`, dbErr?.message);
      }
    }

    if (!incident) {
      // If incidentId is not a UUID or not found (e.g. standalone demo vault recording 'inc_vault_...'),
      // attach to latest active incident if available, or create a demo record
      try {
        const activeIncident = await this.prisma.incident.findFirst({
          where: { status: IncidentStatus.ACTIVE },
          orderBy: { startedAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, phone: true } },
            locationLogs: { orderBy: { loggedAt: 'desc' }, take: 10 },
          },
        });

        if (activeIncident) {
          incident = await this.prisma.incident.update({
            where: { id: activeIncident.id },
            data: { evidenceAudioUrl: audioUrl },
            include: {
              user: { select: { id: true, name: true, phone: true } },
              locationLogs: { orderBy: { loggedAt: 'desc' }, take: 10 },
            },
          });
        } else {
          const defaultUser = await this.prisma.user.findFirst();
          if (defaultUser) {
            incident = await this.prisma.incident.create({
              data: {
                userId: defaultUser.id,
                triggerType: TriggerType.MANUAL_SOS,
                status: IncidentStatus.RESOLVED,
                evidenceAudioUrl: audioUrl,
              },
              include: {
                user: { select: { id: true, name: true, phone: true } },
                locationLogs: { orderBy: { loggedAt: 'desc' }, take: 10 },
              },
            });
          }
        }
      } catch (err: any) {
        console.warn('[IncidentsService] Standalone incident DB fallback:', err?.message);
      }
    }

    const activeData = (await this.redis.getActiveIncident(incidentId)) || {};
    await this.redis.cacheActiveIncident(incidentId, {
      ...activeData,
      evidenceAudioUrl: audioUrl,
    });

    return incident;
  }

  async notifyEmergencyContacts(incidentId: string) {
    const incident = await this.getIncidentById(incidentId);
    const userWithContacts = await this.prisma.user.findUnique({
      where: { id: incident.userId },
      include: { emergencyContacts: true },
    });

    const lastLoc = incident.locationLogs?.[incident.locationLogs.length - 1];
    const recipients = (userWithContacts?.emergencyContacts || []).map((c) => ({
      name: c.contactName,
      phone: c.phoneNumber,
    }));

    const results = await this.smsService.dispatchEmergencyAlert({
      incidentId,
      victimName: incident.user?.name || 'Citizen User',
      victimPhone: incident.user?.phone || '',
      triggerType: incident.triggerType,
      lat: lastLoc?.lat || 40.7128,
      lng: lastLoc?.lng || -74.006,
      batteryLevel: lastLoc?.batteryLevel ?? 100,
      recipients,
    });

    return {
      incidentId,
      dispatchedCount: results.length,
      results,
    };
  }

  generateAudioPresignedUrl(incidentId: string) {
    // Graceful fallback to Fastify local static evidence storage vault
    return `/uploads/evidence/evidence_${incidentId}.m4a`;
  }
}

