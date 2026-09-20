import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { createMockPrismaService, MockPrismaService } from '../src/test-utils/prisma-mock';

describe('GraphQL Apollo Fastify (E2E)', () => {
  let app: NestFastifyApplication;
  let prisma: MockPrismaService;
  let redis: any;

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should query systemConfig via GraphQL endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `
          query {
            systemConfig {
              yamnetScreamThreshold
              openWakeWordThreshold
              snatchThresholdG
            }
          }
        `,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data).toBeDefined();
    expect(body.data.systemConfig.yamnetScreamThreshold).toBe(0.6);
  });

  it('should update systemConfig via GraphQL mutation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `
          mutation {
            updateSystemConfig(yamnetScreamThreshold: 0.77, openWakeWordThreshold: 0.88) {
              yamnetScreamThreshold
              openWakeWordThreshold
            }
          }
        `,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.updateSystemConfig.yamnetScreamThreshold).toBe(0.77);
    expect(body.data.updateSystemConfig.openWakeWordThreshold).toBe(0.88);
  });

  it('should query activeIncidentsCount via GraphQL endpoint', async () => {
    prisma.incident.count.mockResolvedValueOnce(9);

    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `
          query {
            activeIncidentsCount
          }
        `,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.data.activeIncidentsCount).toBe(9);
  });
});
