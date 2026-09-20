import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/prisma-mock';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getMe', () => {
    it('should return user without passwordHash when found', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phone: '+1555123456',
        passwordHash: 'hash',
        name: 'Jane Doe',
        emergencyContacts: [{ id: 'ec-1', contactName: 'Mom', phoneNumber: '+1555987654', priorityOrder: 1 }],
      } as any);

      const result = await service.getMe('user-1');
      expect(result).toBeDefined();
      expect(result.id).toBe('user-1');
      expect((result as any).passwordHash).toBeUndefined();
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { emergencyContacts: { orderBy: { priorityOrder: 'asc' } } },
      });
    });

    it('should throw NotFoundException when user is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('user-missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('should update and return sanitized user with modified fields', async () => {
      const updateDto = { name: 'Updated Name', isVolunteer: true, mlSensitivity: 'HIGH' as any };
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        phone: '+1555123456',
        passwordHash: 'hash',
        name: 'Updated Name',
        isVolunteer: true,
        mlSensitivity: 'HIGH',
        emergencyContacts: [],
      } as any);

      const result = await service.updateMe('user-1', updateDto);
      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Name');
      expect((result as any).passwordHash).toBeUndefined();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          name: 'Updated Name',
          isVolunteer: true,
          mlSensitivity: 'HIGH',
        },
        include: { emergencyContacts: { orderBy: { priorityOrder: 'asc' } } },
      });
    });

    it('should handle partial updates where only one field is provided', async () => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        name: 'Jane Doe',
        passwordHash: 'hash',
      } as any);

      await service.updateMe('user-1', { name: 'Jane Doe' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Jane Doe' },
        include: { emergencyContacts: { orderBy: { priorityOrder: 'asc' } } },
      });
    });
  });

  describe('addContact', () => {
    it('should create emergency contact with default priority if priorityOrder is not provided', async () => {
      const dto = { contactName: 'Brother', phoneNumber: '+1555111222' };
      prisma.emergencyContact.create.mockResolvedValue({
        id: 'ec-1',
        userId: 'user-1',
        contactName: 'Brother',
        phoneNumber: '+1555111222',
        priorityOrder: 1,
        createdAt: new Date(),
      } as any);

      const result = await service.addContact('user-1', dto);
      expect(result.id).toBe('ec-1');
      expect(prisma.emergencyContact.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          contactName: 'Brother',
          phoneNumber: '+1555111222',
          priorityOrder: 1,
        },
      });
    });

    it('should create emergency contact with specified priority', async () => {
      const dto = { contactName: 'Sister', phoneNumber: '+1555333444', priorityOrder: 2 };
      prisma.emergencyContact.create.mockResolvedValue({
        id: 'ec-2',
        userId: 'user-1',
        contactName: 'Sister',
        phoneNumber: '+1555333444',
        priorityOrder: 2,
        createdAt: new Date(),
      } as any);

      const result = await service.addContact('user-1', dto);
      expect(result.id).toBe('ec-2');
      expect(prisma.emergencyContact.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          contactName: 'Sister',
          phoneNumber: '+1555333444',
          priorityOrder: 2,
        },
      });
    });
  });

  describe('deleteContact', () => {
    it('should delete emergency contact by contactId and userId', async () => {
      prisma.emergencyContact.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.deleteContact('user-1', 'ec-1');
      expect(result).toEqual({ count: 1 });
      expect(prisma.emergencyContact.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'ec-1',
          userId: 'user-1',
        },
      });
    });
  });
});
