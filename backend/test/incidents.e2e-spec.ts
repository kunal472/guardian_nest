import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { createMockPrismaService, MockPrismaService } from '../src/test-utils/prisma-mock';
import { IncidentStatus, TriggerType, UserRole } from '@prisma/client';

describe('Incidents & Volunteers (E2E Fastify)', () => {
  let app: NestFastifyApplication;
  let prisma: MockPrismaService;
  let redis: any;
  let authToken: string;

  const sampleUserId = '11111111-1111-1111-1111-111111111111';
  const sampleIncidentId = '33333333-3333-3333-3333-333333333333';

  const mockUser = {
    id: sampleUserId,
    phone: '+15551234567',
    name: 'Elena Citizen',
    passwordHash: 'dummy',
    role: UserRole.USER,
    isVolunteer: false,
    mlSensitivity: 'MEDIUM',
    createdAt: new Date(),
    emergencyContacts: [],
  };

  beforeAll(async () => {
    prisma = createMockPrismaService();

    redis = {
      onModuleInit: () => {},
      onModuleDestroy: () => {},
      mapUserSocket: async () => {},
      getUserSocket: async () => null,
      set: async () => {},
      get: async () => null,
      del: async () => {},
      cacheActiveIncident: async () => {},
      getActiveIncident: async () => null,
      updateVolunteerLocation: async () => {},
      findNearbyVolunteers: async () => [],
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(redis)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    // Create a deterministic auth token by calling register endpoint
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce(mockUser as any);
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { phone: mockUser.phone, password: 'Password123!', name: mockUser.name },
    });
    authToken = JSON.parse(regRes.payload).token;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue(mockUser as any);
  });

  describe('/api/incidents (POST & GET)', () => {
    it('POST /api/incidents should create an emergency incident', async () => {
      const mockIncident = {
        id: sampleIncidentId,
        userId: sampleUserId,
        triggerType: TriggerType.MANUAL_SOS,
        status: IncidentStatus.ACTIVE,
        startedAt: new Date(),
        user: { name: 'Elena', phone: '+15551234567', emergencyContacts: [] },
        locationLogs: [{ id: 'loc-1', lat: 40.7128, lng: -74.006, batteryLevel: 99 }],
      };
      prisma.incident.create.mockResolvedValueOnce(mockIncident as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/incidents',
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          lat: 40.7128,
          lng: -74.006,
          triggerType: 'MANUAL_SOS',
          batteryLevel: 99,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.id).toBe(sampleIncidentId);
      expect(body.status).toBe('ACTIVE');
    });

    it('GET /api/incidents should return list of incidents', async () => {
      prisma.incident.findMany.mockResolvedValueOnce([
        {
          id: sampleIncidentId,
          userId: sampleUserId,
          status: IncidentStatus.ACTIVE,
          startedAt: new Date(),
        },
      ] as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/incidents',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
    });

    it('GET /api/incidents/active/count should return active incidents count', async () => {
      prisma.incident.count.mockResolvedValueOnce(3);

      const response = await app.inject({
        method: 'GET',
        url: '/api/incidents/active/count',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.activeIncidentsCount).toBe(3);
    });

    it('GET /api/incidents/:id should return incident details', async () => {
      prisma.incident.findUnique.mockResolvedValueOnce({
        id: sampleIncidentId,
        status: IncidentStatus.ACTIVE,
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: `/api/incidents/${sampleIncidentId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.id).toBe(sampleIncidentId);
    });

    it('PATCH /api/incidents/:id/status should update incident status', async () => {
      prisma.incident.update.mockResolvedValueOnce({
        id: sampleIncidentId,
        status: IncidentStatus.RESOLVED,
        user: { name: 'Elena', phone: '+15551234567' },
        locationLogs: [],
      } as any);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/incidents/${sampleIncidentId}/status`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { status: 'RESOLVED' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('RESOLVED');
    });

    it('POST /api/incidents/:id/location should record location update', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/incidents/${sampleIncidentId}/location`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { lat: 40.713, lng: -74.005, batteryLevel: 94 },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });

  describe('/api/volunteers (POST)', () => {
    it('POST /api/volunteers/opt-in should register user as volunteer sentinel', async () => {
      prisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        isVolunteer: true,
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/volunteers/opt-in',
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.status).toBe('active_sentinel');
      expect(body.isVolunteer).toBe(true);
    });

    it('POST /api/volunteers/location should update volunteer location', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/volunteers/location',
        headers: { authorization: `Bearer ${authToken}` },
        payload: { lat: 40.7128, lng: -74.006 },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
    });
  });
});
