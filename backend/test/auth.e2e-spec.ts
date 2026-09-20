import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { createMockPrismaService, MockPrismaService } from '../src/test-utils/prisma-mock';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

describe('Auth & Users (E2E Fastify)', () => {
  let app: NestFastifyApplication;
  let prisma: MockPrismaService;
  let redis: any;

  const mockUser = {
    id: '11111111-1111-1111-1111-111111111111',
    phone: '+15551234567',
    name: 'Elena Citizen',
    passwordHash: '',
    role: UserRole.USER,
    isVolunteer: false,
    mlSensitivity: 'MEDIUM',
    createdAt: new Date(),
    emergencyContacts: [],
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('Password123!', 10);
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue(mockUser as any);
  });

  describe('/api/auth/register (POST)', () => {
    it('should register a new user and return token and user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null); // phone not taken
      prisma.user.create.mockResolvedValueOnce({
        ...mockUser,
        phone: '+15559990001',
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          phone: '+15559990001',
          password: 'SecurePassword123!',
          name: 'New Registered User',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.token).toBeDefined();
      expect(body.user.phone).toBe('+15559990001');
      expect(body.user.passwordHash).toBeUndefined();
    });

    it('should return 409 if phone already exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          phone: mockUser.phone,
          password: 'Password123!',
          name: 'Duplicate User',
        },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('/api/auth/login (POST)', () => {
    it('should authenticate valid credentials and return JWT token', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          phone: mockUser.phone,
          password: 'Password123!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.token).toBeDefined();
      expect(body.user.id).toBe(mockUser.id);
    });

    it('should return 401 for incorrect password', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(mockUser as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          phone: mockUser.phone,
          password: 'WrongPassword!',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('/api/users/me (Protected Fastify Route)', () => {
    it('should return 401 Unauthorized when no Bearer token is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return current user profile when valid Bearer token is provided', async () => {
      // First login to obtain valid signed JWT
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          phone: mockUser.phone,
          password: 'Password123!',
        },
      });
      const { token } = JSON.parse(loginRes.payload);

      const response = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.id).toBe(mockUser.id);
      expect(body.name).toBe(mockUser.name);
    });

    it('should update current user profile via PUT /api/users/me', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        name: 'Elena Rostova Updated',
      } as any);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          phone: mockUser.phone,
          password: 'Password123!',
        },
      });
      const { token } = JSON.parse(loginRes.payload);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/users/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: 'Elena Rostova Updated',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.name).toBe('Elena Rostova Updated');
    });

    it('should add emergency contact via POST /api/users/contacts', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.emergencyContact.create.mockResolvedValue({
        id: '22222222-2222-2222-2222-222222222222',
        userId: mockUser.id,
        contactName: 'Doctor Marcus',
        phoneNumber: '+1555444333',
        priorityOrder: 1,
        createdAt: new Date(),
      } as any);

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          phone: mockUser.phone,
          password: 'Password123!',
        },
      });
      const { token } = JSON.parse(loginRes.payload);

      const response = await app.inject({
        method: 'POST',
        url: '/api/users/contacts',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          contactName: 'Doctor Marcus',
          phoneNumber: '+1555444333',
          priorityOrder: 1,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.contactName).toBe('Doctor Marcus');
    });

    it('should delete emergency contact via DELETE /api/users/contacts/:id', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.emergencyContact.deleteMany.mockResolvedValue({ count: 1 });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          phone: mockUser.phone,
          password: 'Password123!',
        },
      });
      const { token } = JSON.parse(loginRes.payload);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/users/contacts/22222222-2222-2222-2222-222222222222',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.count).toBe(1);
    });
  });
});
