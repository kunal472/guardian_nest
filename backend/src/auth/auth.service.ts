import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (existing) {
      throw new ConflictException('A user with this phone number already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        name: dto.name,
        role: (dto.role as UserRole) || UserRole.USER,
      },
      include: {
        emergencyContacts: true,
      },
    });

    const token = this.generateToken(user.id, user.phone, user.role);

    const { passwordHash: _, ...safeUser } = user;
    return {
      token,
      user: safeUser,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: {
        emergencyContacts: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid phone number or password.');
    }

    const token = this.generateToken(user.id, user.phone, user.role);

    const { passwordHash: _, ...safeUser } = user;
    return {
      token,
      user: safeUser,
    };
  }

  private generateToken(userId: string, phone: string, role: string): string {
    return this.jwtService.sign({
      sub: userId,
      phone,
      role,
    });
  }
}
