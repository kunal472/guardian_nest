import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../test-utils/prisma-mock';
import { UserRole } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let jwtService: { sign: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    jwtService = { sign: vi.fn().mockReturnValue('mock_jwt_token_xyz') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      phone: '+1555000111',
      password: 'SecurePassword123!',
      name: 'Test Citizen',
      role: 'USER',
    };

    it('should throw ConflictException if user with phone already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-existing-1',
        phone: registerDto.phone,
        passwordHash: 'hash',
        name: 'Existing',
        role: UserRole.USER,
        isVolunteer: false,
        mlSensitivity: 'MEDIUM' as any,
        createdAt: new Date(),
      } as any);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should successfully create a new user, hash password, and return safe user with token', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-new-1',
        phone: registerDto.phone,
        passwordHash: '$2a$10$hashedpw',
        name: registerDto.name,
        role: UserRole.USER,
        isVolunteer: false,
        mlSensitivity: 'MEDIUM' as any,
        createdAt: new Date(),
        emergencyContacts: [],
      } as any);

      const result = await service.register(registerDto);

      expect(result).toBeDefined();
      expect(result.token).toBe('mock_jwt_token_xyz');
      expect(result.user).toEqual({
        id: 'u-new-1',
        phone: registerDto.phone,
        name: registerDto.name,
        role: UserRole.USER,
        isVolunteer: false,
        mlSensitivity: 'MEDIUM',
        createdAt: expect.any(Date),
        emergencyContacts: [],
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'u-new-1',
        phone: registerDto.phone,
        role: UserRole.USER,
      });
    });

    it('should handle role fallback if role is not provided', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u-new-2',
        phone: '+1555000222',
        passwordHash: 'hashed',
        name: 'No Role User',
        role: UserRole.USER,
        isVolunteer: false,
        mlSensitivity: 'MEDIUM' as any,
        createdAt: new Date(),
        emergencyContacts: [],
      } as any);

      const res = await service.register({
        phone: '+1555000222',
        password: 'password',
        name: 'No Role User',
      } as any);

      expect(res.user.role).toBe(UserRole.USER);
    });

    it('should catch P2002 Prisma duplicate key error and throw ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const prismaError: any = new Error('Unique constraint failed');
      prismaError.code = 'P2002';
      prisma.user.create.mockRejectedValue(prismaError);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should catch 23505 Postgres code error and throw ConflictException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const pgError: any = new Error('Duplicate key');
      pgError.cause = { originalCode: '23505' };
      prisma.user.create.mockRejectedValue(pgError);

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected database errors', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const generalError = new Error('Database connection failed');
      prisma.user.create.mockRejectedValue(generalError);

      await expect(service.register(registerDto)).rejects.toThrow('Database connection failed');
    });
  });

  describe('login', () => {
    const loginDto = {
      phone: '+1555000111',
      password: 'CorrectPassword123!',
    };

    it('should throw UnauthorizedException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const hashedPassword = await bcrypt.hash('DifferentPassword', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        phone: loginDto.phone,
        passwordHash: hashedPassword,
        name: 'User One',
        role: UserRole.USER,
        emergencyContacts: [],
      } as any);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should return token and safeUser on successful login', async () => {
      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u-1',
        phone: loginDto.phone,
        passwordHash: hashedPassword,
        name: 'User One',
        role: UserRole.USER,
        emergencyContacts: [],
      } as any);

      const result = await service.login(loginDto);

      expect(result.token).toBe('mock_jwt_token_xyz');
      expect(result.user.id).toBe('u-1');
      expect((result.user as any).passwordHash).toBeUndefined();
    });
  });
});
