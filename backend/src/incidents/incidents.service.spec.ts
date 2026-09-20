import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../notifications/sms.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/prisma-mock';
import { IncidentStatus, TriggerType } from '@prisma/client';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prisma: MockPrismaService;
  let redis: {
    cacheActiveIncident: ReturnType<typeof vi.fn>;
    getActiveIncident: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  let smsService: {
    dispatchEmergencyAlert: ReturnType<typeof vi.fn>;
  };

  const sampleUuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  const sampleUserUuid = 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e';

  beforeEach(async () => {
    prisma = createMockPrismaService();
    redis = {
      cacheActiveIncident: vi.fn().mockResolvedValue(undefined),
      getActiveIncident: vi.fn().mockResolvedValue(null),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };
    smsService = {
      dispatchEmergencyAlert: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: SmsService, useValue: smsService },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
  });

  describe('createIncident', () => {
    const dto = {
      lat: 40.7128,
      lng: -74.006,
      triggerType: TriggerType.MANUAL_SOS,
      batteryLevel: 95,
      evidenceAudioUrl: 'https://example.com/audio.m4a',
    };

    it('should create incident when user exists and dispatch SMS if contacts exist', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: sampleUserUuid, phone: '+1555123456' } as any);
      const mockCreatedIncident = {
        id: sampleUuid,
        userId: sampleUserUuid,
        triggerType: TriggerType.MANUAL_SOS,
        status: IncidentStatus.ACTIVE,
        startedAt: new Date(),
        user: {
          id: sampleUserUuid,
          name: 'Elena',
          phone: '+1555123456',
          emergencyContacts: [{ contactName: 'Bob', phoneNumber: '+1555987654' }],
        },
        locationLogs: [{ id: 'loc-1', lat: 40.7128, lng: -74.006, batteryLevel: 95 }],
      };
      prisma.incident.create.mockResolvedValue(mockCreatedIncident as any);

      const result = await service.createIncident(sampleUserUuid, dto);

      expect(result).toEqual(mockCreatedIncident);
      expect(redis.cacheActiveIncident).toHaveBeenCalledWith(
        sampleUuid,
        expect.objectContaining({
          userId: sampleUserUuid,
          name: 'Elena',
          triggerType: TriggerType.MANUAL_SOS,
          status: IncidentStatus.ACTIVE,
        }),
      );
      expect(smsService.dispatchEmergencyAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentId: sampleUuid,
          victimName: 'Elena',
          recipients: [{ name: 'Bob', phone: '+1555987654' }],
        }),
      );
    });

    it('should upsert fallback demo user if user does not exist in database', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.upsert.mockResolvedValue({ id: 'fallback-user-id', phone: '+1555019888' } as any);
      prisma.incident.create.mockResolvedValue({
        id: sampleUuid,
        userId: 'fallback-user-id',
        user: { name: 'Elena Rostova', phone: '+1555019888', emergencyContacts: [] },
        locationLogs: [],
      } as any);

      const result = await service.createIncident('non-existing-user', {
        ...dto,
        batteryLevel: undefined,
      });

      expect(prisma.user.upsert).toHaveBeenCalled();
      expect(result.userId).toBe('fallback-user-id');
      expect(smsService.dispatchEmergencyAlert).not.toHaveBeenCalled();
    });

    it('should handle SMS dispatch rejection without failing incident creation', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: sampleUserUuid } as any);
      prisma.incident.create.mockResolvedValue({
        id: sampleUuid,
        userId: sampleUserUuid,
        user: {
          name: 'Elena',
          phone: '+1555123456',
          emergencyContacts: [{ contactName: 'Bob', phoneNumber: '+1555987654' }],
        },
        locationLogs: [],
      } as any);
      smsService.dispatchEmergencyAlert.mockRejectedValue(new Error('SMS Gateway Down'));

      const result = await service.createIncident(sampleUserUuid, dto);
      expect(result).toBeDefined();
    });
  });

  describe('recordLocationUpdate', () => {
    it('should update Redis cache immediately and throttle DB write when last write is recent', async () => {
      redis.getActiveIncident.mockResolvedValue({ batteryLevel: 80 });
      redis.get.mockResolvedValue(Math.floor(Date.now() / 1000).toString()); // recent write (<2s)

      const result = await service.recordLocationUpdate(sampleUuid, 40.7128, -74.006, 75);

      expect(result).toEqual({
        success: true,
        incidentId: sampleUuid,
        lat: 40.7128,
        lng: -74.006,
      });
      expect(redis.cacheActiveIncident).toHaveBeenCalled();
      expect(prisma.incidentLocationLog.create).not.toHaveBeenCalled();
    });

    it('should write to DB when last write is older than 2s or null', async () => {
      redis.getActiveIncident.mockResolvedValue(null);
      redis.get.mockResolvedValue((Math.floor(Date.now() / 1000) - 5).toString());
      prisma.incidentLocationLog.create.mockResolvedValue({ id: 'log-1' } as any);

      const result = await service.recordLocationUpdate(sampleUuid, 40.7128, -74.006);

      expect(result.success).toBe(true);
      expect(prisma.incidentLocationLog.create).toHaveBeenCalledWith({
        data: {
          incidentId: sampleUuid,
          lat: 40.7128,
          lng: -74.006,
          batteryLevel: 100,
        },
      });
    });

    it('should catch DB error gracefully on location log create', async () => {
      redis.get.mockResolvedValue(null);
      prisma.incidentLocationLog.create.mockRejectedValue(new Error('DB connection dropped'));

      const result = await service.recordLocationUpdate(sampleUuid, 40.7128, -74.006);
      expect(result.success).toBe(true);
    });

    it('should skip DB log create if incidentId is not a UUID', async () => {
      const result = await service.recordLocationUpdate('non_uuid_demo_123', 40.7128, -74.006);
      expect(result.success).toBe(true);
      expect(prisma.incidentLocationLog.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should update status and resolvedAt for UUID incident', async () => {
      prisma.incident.update.mockResolvedValue({
        id: sampleUuid,
        status: IncidentStatus.RESOLVED,
        resolvedAt: new Date(),
        user: { id: sampleUserUuid, name: 'Victim', phone: '+1555123456' },
        locationLogs: [],
      } as any);

      const result = await service.updateStatus(sampleUuid, IncidentStatus.RESOLVED, sampleUserUuid);
      expect(result.status).toBe(IncidentStatus.RESOLVED);
      expect(redis.cacheActiveIncident).toHaveBeenCalledWith(
        sampleUuid,
        expect.objectContaining({ status: IncidentStatus.RESOLVED, resolvedAt: expect.any(String) }),
      );
    });

    it('should handle non-resolved status update', async () => {
      prisma.incident.update.mockResolvedValue({
        id: sampleUuid,
        status: IncidentStatus.DISPATCHED,
        user: { id: sampleUserUuid, name: 'Victim', phone: '+1555123456' },
        locationLogs: [],
      } as any);

      const result = await service.updateStatus(sampleUuid, IncidentStatus.DISPATCHED);
      expect(result.status).toBe(IncidentStatus.DISPATCHED);
      expect(redis.cacheActiveIncident).toHaveBeenCalledWith(
        sampleUuid,
        expect.objectContaining({ status: IncidentStatus.DISPATCHED }),
      );
    });

    it('should fallback to latest active incident for non-UUID incidentId', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: sampleUuid } as any);
      prisma.incident.update.mockResolvedValue({
        id: sampleUuid,
        status: IncidentStatus.FALSE_ALARM,
        user: {},
        locationLogs: [],
      } as any);

      const result = await service.updateStatus('inc_fallback', IncidentStatus.FALSE_ALARM);
      expect(result.status).toBe(IncidentStatus.FALSE_ALARM);
    });

    it('should throw NotFoundException if non-UUID target has no active incident', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);

      await expect(service.updateStatus('inc_not_found', IncidentStatus.RESOLVED)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllIncidents', () => {
    it('should return all incidents ordered by startedAt desc', async () => {
      prisma.incident.findMany.mockResolvedValue([{ id: sampleUuid }] as any);

      const result = await service.getAllIncidents(IncidentStatus.ACTIVE);
      expect(result).toHaveLength(1);
      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: { status: IncidentStatus.ACTIVE },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          resolvedByUser: { select: { id: true, name: true } },
          locationLogs: { orderBy: { loggedAt: 'asc' } },
        },
        orderBy: { startedAt: 'desc' },
      });
    });

    it('should return all incidents without status filter if status not provided', async () => {
      prisma.incident.findMany.mockResolvedValue([]);
      await service.getAllIncidents();
      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: undefined,
        include: expect.any(Object),
        orderBy: { startedAt: 'desc' },
      });
    });
  });

  describe('getIncidentById', () => {
    it('should throw NotFoundException if id is not a valid UUID', async () => {
      await expect(service.getIncidentById('not-a-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if incident is not found', async () => {
      prisma.incident.findUnique.mockResolvedValue(null);
      await expect(service.getIncidentById(sampleUuid)).rejects.toThrow(NotFoundException);
    });

    it('should return incident when found', async () => {
      prisma.incident.findUnique.mockResolvedValue({ id: sampleUuid, status: IncidentStatus.ACTIVE } as any);
      const result = await service.getIncidentById(sampleUuid);
      expect(result.id).toBe(sampleUuid);
    });
  });

  describe('getActiveCount', () => {
    it('should return count of active incidents', async () => {
      prisma.incident.count.mockResolvedValue(4);
      const count = await service.getActiveCount();
      expect(count).toBe(4);
      expect(prisma.incident.count).toHaveBeenCalledWith({
        where: { status: IncidentStatus.ACTIVE },
      });
    });
  });

  describe('attachAudioEvidence', () => {
    const audioUrl = '/uploads/evidence/test.m4a';

    it('should attach audio to existing UUID incident', async () => {
      prisma.incident.findUnique.mockResolvedValue({ id: sampleUuid } as any);
      prisma.incident.update.mockResolvedValue({ id: sampleUuid, evidenceAudioUrl: audioUrl } as any);

      const result = await service.attachAudioEvidence(sampleUuid, audioUrl);
      expect(result.evidenceAudioUrl).toBe(audioUrl);
      expect(redis.cacheActiveIncident).toHaveBeenCalledWith(
        sampleUuid,
        expect.objectContaining({ evidenceAudioUrl: audioUrl }),
      );
    });

    it('should handle DB findUnique error and fallback', async () => {
      prisma.incident.findUnique.mockRejectedValue(new Error('DB query error'));
      prisma.incident.findFirst.mockResolvedValue({ id: sampleUuid } as any);
      prisma.incident.update.mockResolvedValue({ id: sampleUuid, evidenceAudioUrl: audioUrl } as any);

      const result = await service.attachAudioEvidence(sampleUuid, audioUrl);
      expect(result).toBeDefined();
    });

    it('should fallback to active incident if non-UUID incidentId is passed', async () => {
      prisma.incident.findFirst.mockResolvedValue({ id: sampleUuid } as any);
      prisma.incident.update.mockResolvedValue({ id: sampleUuid, evidenceAudioUrl: audioUrl } as any);

      const result = await service.attachAudioEvidence('demo_vault_1', audioUrl);
      expect(result.id).toBe(sampleUuid);
    });

    it('should fallback to creating resolved incident for default user if no active incident exists', async () => {
      prisma.incident.findFirst.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: sampleUserUuid } as any);
      prisma.incident.create.mockResolvedValue({
        id: sampleUuid,
        userId: sampleUserUuid,
        evidenceAudioUrl: audioUrl,
      } as any);

      const result = await service.attachAudioEvidence('demo_vault_2', audioUrl);
      expect(result.userId).toBe(sampleUserUuid);
    });
  });

  describe('notifyEmergencyContacts', () => {
    it('should dispatch alert to user emergency contacts', async () => {
      prisma.incident.findUnique.mockResolvedValue({
        id: sampleUuid,
        userId: sampleUserUuid,
        triggerType: TriggerType.MANUAL_SOS,
        user: { name: 'Alice', phone: '+1555123456' },
        locationLogs: [{ lat: 40.7128, lng: -74.006, batteryLevel: 88 }],
      } as any);
      prisma.user.findUnique.mockResolvedValue({
        id: sampleUserUuid,
        emergencyContacts: [{ contactName: 'Bob', phoneNumber: '+1555999888' }],
      } as any);
      smsService.dispatchEmergencyAlert.mockResolvedValue([{ recipient: '+1555999888', success: true } as any]);

      const result = await service.notifyEmergencyContacts(sampleUuid);
      expect(result.incidentId).toBe(sampleUuid);
      expect(result.dispatchedCount).toBe(1);
      expect(smsService.dispatchEmergencyAlert).toHaveBeenCalled();
    });
  });

  describe('generateAudioPresignedUrl', () => {
    it('should generate local static evidence url path', () => {
      const url = service.generateAudioPresignedUrl('inc-123');
      expect(url).toBe('/uploads/evidence/evidence_inc-123.m4a');
    });
  });
});
