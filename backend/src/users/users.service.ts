import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddEmergencyContactDto } from './dto/add-contact.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        emergencyContacts: {
          orderBy: { priorityOrder: 'asc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isVolunteer !== undefined && { isVolunteer: dto.isVolunteer }),
        ...(dto.mlSensitivity !== undefined && { mlSensitivity: dto.mlSensitivity }),
      },
      include: {
        emergencyContacts: {
          orderBy: { priorityOrder: 'asc' },
        },
      },
    });

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async addContact(userId: string, dto: AddEmergencyContactDto) {
    return this.prisma.emergencyContact.create({
      data: {
        userId,
        contactName: dto.contactName,
        phoneNumber: dto.phoneNumber,
        priorityOrder: dto.priorityOrder ?? 1,
      },
    });
  }

  async deleteContact(userId: string, contactId: string) {
    return this.prisma.emergencyContact.deleteMany({
      where: {
        id: contactId,
        userId,
      },
    });
  }
}
