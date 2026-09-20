import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/prisma-mock';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: MockPrismaService;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should return user without passwordHash when user exists', async () => {
    const payload = { sub: 'u-123', phone: '+1555123456', role: 'USER' };
    prisma.user.findUnique.mockResolvedValue({
      id: 'u-123',
      phone: '+1555123456',
      passwordHash: 'secret_hash',
      name: 'Test User',
      role: 'USER',
      emergencyContacts: [],
    } as any);

    const user = await strategy.validate(payload);
    expect(user).toBeDefined();
    expect(user.id).toBe('u-123');
    expect((user as any).passwordHash).toBeUndefined();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u-123' },
      include: { emergencyContacts: true },
    });
  });

  it('should throw UnauthorizedException when user does not exist', async () => {
    const payload = { sub: 'u-missing', phone: '+1555999999', role: 'USER' };
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
