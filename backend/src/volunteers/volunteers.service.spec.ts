import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { VolunteersService } from './volunteers.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/prisma-mock';

describe('VolunteersService', () => {
  let service: VolunteersService;
  let prisma: MockPrismaService;
  let redis: { updateVolunteerLocation: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    redis = {
      updateVolunteerLocation: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VolunteersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<VolunteersService>(VolunteersService);
  });

  describe('optIn', () => {
    it('should set isVolunteer to true and return active sentinel status', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'u-vol-1',
        phone: '+1555111222',
        passwordHash: 'hash',
        name: 'Volunteer Joe',
        isVolunteer: true,
      } as any);

      const result = await service.optIn('u-vol-1');
      expect(result).toEqual({
        status: 'active_sentinel',
        isVolunteer: true,
        user: {
          id: 'u-vol-1',
          phone: '+1555111222',
          name: 'Volunteer Joe',
          isVolunteer: true,
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u-vol-1' },
        data: { isVolunteer: true },
      });
    });
  });

  describe('updateLocation', () => {
    it('should update volunteer location in Redis and return success', async () => {
      const result = await service.updateLocation('u-vol-1', 40.7128, -74.006);
      expect(result).toEqual({
        success: true,
        lat: 40.7128,
        lng: -74.006,
      });
      expect(redis.updateVolunteerLocation).toHaveBeenCalledWith('u-vol-1', 40.7128, -74.006);
    });
  });

  describe('getNearbyIncidents', () => {
    it('should query active incidents with latest location log and user select', async () => {
      const mockIncidents = [
        {
          id: 'inc-1',
          status: 'ACTIVE',
          locationLogs: [{ lat: 40.7128, lng: -74.006 }],
          user: { id: 'u-victim', name: 'Victim', phone: '+1555123456' },
        },
      ];
      prisma.incident.findMany.mockResolvedValue(mockIncidents as any);

      const result = await service.getNearbyIncidents(40.7128, -74.006);
      expect(result).toEqual(mockIncidents);
      expect(prisma.incident.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        include: {
          locationLogs: {
            orderBy: { loggedAt: 'desc' },
            take: 1,
          },
          user: {
            select: { id: true, name: true, phone: true },
          },
        },
      });
    });
  });
});
