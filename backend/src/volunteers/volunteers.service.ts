import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class VolunteersService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async optIn(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isVolunteer: true },
    });

    const { passwordHash: _, ...safeUser } = user;
    return {
      status: 'active_sentinel',
      isVolunteer: safeUser.isVolunteer,
      user: safeUser,
    };
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    await this.redis.updateVolunteerLocation(userId, lat, lng);
    return { success: true, lat, lng };
  }

  async getNearbyIncidents(lat: number, lng: number) {
    // Return active incidents nearby
    const activeIncidents = await this.prisma.incident.findMany({
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

    return activeIncidents;
  }
}
