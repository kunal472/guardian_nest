import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { AddEmergencyContactDto } from './dto/add-contact.dto';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    return this.usersService.getMe(req.user.id);
  }

  @Put('me')
  async updateMe(@Req() req: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(req.user.id, dto);
  }

  @Post('contacts')
  async addContact(@Req() req: any, @Body() dto: AddEmergencyContactDto) {
    return this.usersService.addContact(req.user.id, dto);
  }

  @Delete('contacts/:id')
  async deleteContact(@Req() req: any, @Param('id') contactId: string) {
    return this.usersService.deleteContact(req.user.id, contactId);
  }
}
