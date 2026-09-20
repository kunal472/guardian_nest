import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminResolver } from './admin.resolver';
import { PrismaService } from '../../prisma/prisma.service';
import { IncidentsService } from '../../incidents/incidents.service';
import { SosGateway } from '../../gateway/sos.gateway';
import { createMockPrismaService, MockPrismaService } from '../../test-utils/prisma-mock';
import { IncidentStatus, UserRole } from '@prisma/client';

describe('AdminResolver', () => {
  let resolver: AdminResolver;
  let prisma: MockPrismaService;
  let incidentsService: {
    getAllIncidents: ReturnType<typeof vi.fn>;
    getIncidentById: ReturnType<typeof vi.fn>;
    getActiveCount: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let sosGateway: {
    broadcastStatusChange: ReturnType<typeof vi.fn>;
  };

  const sampleUuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  beforeEach(() => {
    prisma = createMockPrismaService();
    incidentsService = {
      getAllIncidents: vi.fn(),
      getIncidentById: vi.fn(),
      getActiveCount: vi.fn(),
      updateStatus: vi.fn(),
    };
    sosGateway = {
      broadcastStatusChange: vi.fn(),
    };

    resolver = new AdminResolver(
      prisma as unknown as PrismaService,
      incidentsService as unknown as IncidentsService,
      sosGateway as unknown as SosGateway,
    );
  });

  describe('users queries', () => {
    it('should query all users with serialized dates', async () => {
      const mockUsers = [
        {
          id: 'u-1',
          name: 'Alice',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          incidents: [
            {
              id: 'inc-1',
              startedAt: new Date('2026-01-01T01:00:00.000Z'),
              resolvedAt: new Date('2026-01-01T02:00:00.000Z'),
              locationLogs: [{ id: 'loc-1', loggedAt: new Date('2026-01-01T01:30:00.000Z') }],
            },
          ],
        },
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers as any);

      const result = await resolver.users();
      expect(result).toHaveLength(1);
      expect(result[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result[0].incidents[0].startedAt).toBe('2026-01-01T01:00:00.000Z');
      expect(result[0].incidents[0].resolvedAt).toBe('2026-01-01T02:00:00.000Z');
      expect(result[0].incidents[0].locationLogs[0].loggedAt).toBe('2026-01-01T01:30:00.000Z');
    });

    it('should query single user by id with incidents and location logs', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        incidents: [
          {
            id: 'inc-1',
            startedAt: new Date('2026-01-01T01:00:00.000Z'),
            resolvedAt: null,
            locationLogs: [{ id: 'loc-1', loggedAt: new Date('2026-01-01T01:30:00.000Z') }],
          },
        ],
      } as any);

      const result = await resolver.user('u-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('u-1');
      expect(result?.incidents[0].resolvedAt).toBeUndefined();
    });

    it('should return null if single user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await resolver.user('u-missing');
      expect(result).toBeNull();
    });
  });

  describe('incidents queries & mutations', () => {
    it('should query all incidents and serialize dates', async () => {
      incidentsService.getAllIncidents.mockResolvedValue([
        {
          id: sampleUuid,
          startedAt: new Date('2026-01-01T00:00:00Z'),
          resolvedAt: new Date('2026-01-01T01:00:00Z'),
          locationLogs: [{ loggedAt: new Date('2026-01-01T00:30:00Z') }],
        },
      ]);

      const result = await resolver.incidents(IncidentStatus.ACTIVE);
      expect(result).toHaveLength(1);
      expect(result[0].startedAt).toBe('2026-01-01T00:00:00.000Z');
      expect(result[0].resolvedAt).toBe('2026-01-01T01:00:00.000Z');
      expect(result[0].locationLogs[0].loggedAt).toBe('2026-01-01T00:30:00.000Z');
    });

    it('should query single incident by id', async () => {
      incidentsService.getIncidentById.mockResolvedValue({
        id: sampleUuid,
        startedAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: new Date('2026-01-01T01:00:00Z'),
        locationLogs: [{ loggedAt: new Date('2026-01-01T00:30:00Z') }],
      });

      const result = await resolver.incident(sampleUuid);
      expect(result?.id).toBe(sampleUuid);
      expect(result?.resolvedAt).toBe('2026-01-01T01:00:00.000Z');
    });

    it('should return null if incident not found', async () => {
      incidentsService.getIncidentById.mockResolvedValue(null);
      const result = await resolver.incident('missing');
      expect(result).toBeNull();
    });

    it('should return active incidents count', async () => {
      incidentsService.getActiveCount.mockResolvedValue(7);
      const count = await resolver.activeIncidentsCount();
      expect(count).toBe(7);
    });

    it('should update user role via mutation', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u-1',
        role: UserRole.RESPONDER,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        incidents: [
          {
            id: 'inc-1',
            startedAt: new Date('2026-01-01T01:00:00Z'),
            resolvedAt: new Date('2026-01-01T02:00:00Z'),
            locationLogs: [{ loggedAt: new Date('2026-01-01T01:30:00Z') }],
          },
        ],
      } as any);

      const result = await resolver.updateUserRole('u-1', UserRole.RESPONDER);
      expect(result.role).toBe(UserRole.RESPONDER);
      expect(result.incidents[0].resolvedAt).toBe('2026-01-01T02:00:00.000Z');
    });

    it('should resolve incident and broadcast status change via mutation', async () => {
      const mockInc = {
        id: sampleUuid,
        status: IncidentStatus.RESOLVED,
        startedAt: new Date('2026-01-01T00:00:00Z'),
        resolvedAt: new Date('2026-01-01T01:00:00Z'),
        locationLogs: [{ loggedAt: new Date('2026-01-01T00:30:00Z') }],
      };
      incidentsService.updateStatus.mockResolvedValue(mockInc);

      const result = await resolver.resolveIncident(sampleUuid, IncidentStatus.RESOLVED);
      expect(result.status).toBe(IncidentStatus.RESOLVED);
      expect(sosGateway.broadcastStatusChange).toHaveBeenCalledWith(sampleUuid, IncidentStatus.RESOLVED, undefined, mockInc);
      expect(result.locationLogs[0].loggedAt).toBe('2026-01-01T00:30:00.000Z');
    });
  });

  describe('system config', () => {
    it('should return default system configuration', async () => {
      const config = await resolver.systemConfig();
      expect(config.yamnetScreamThreshold).toBe(0.6);
      expect(config.openWakeWordThreshold).toBe(0.7);
    });

    it('should update system configuration properties partially', async () => {
      const updated = await resolver.updateSystemConfig(0.85, 0.9, 4.0, 0.1, 20);
      expect(updated.yamnetScreamThreshold).toBe(0.85);
      expect(updated.openWakeWordThreshold).toBe(0.9);
      expect(updated.snatchThresholdG).toBe(4.0);
      expect(updated.batteryCriticalThreshold).toBe(0.1);
      expect(updated.deadmanTimeoutMins).toBe(20);
    });
  });
});
