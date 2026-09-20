import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getMe: ReturnType<typeof vi.fn>;
    updateMe: ReturnType<typeof vi.fn>;
    addContact: ReturnType<typeof vi.fn>;
    deleteContact: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    usersService = {
      getMe: vi.fn(),
      updateMe: vi.fn(),
      addContact: vi.fn(),
      deleteContact: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should call usersService.getMe with request user id', async () => {
    const req = { user: { id: 'u-123' } };
    usersService.getMe.mockResolvedValue({ id: 'u-123', name: 'Alice' });

    const result = await controller.getMe(req);
    expect(usersService.getMe).toHaveBeenCalledWith('u-123');
    expect(result).toEqual({ id: 'u-123', name: 'Alice' });
  });

  it('should call usersService.updateMe with request user id and body', async () => {
    const req = { user: { id: 'u-123' } };
    const dto = { name: 'Alice Smith' };
    usersService.updateMe.mockResolvedValue({ id: 'u-123', name: 'Alice Smith' });

    const result = await controller.updateMe(req, dto);
    expect(usersService.updateMe).toHaveBeenCalledWith('u-123', dto);
    expect(result).toEqual({ id: 'u-123', name: 'Alice Smith' });
  });

  it('should call usersService.addContact with request user id and contact dto', async () => {
    const req = { user: { id: 'u-123' } };
    const dto = { contactName: 'Bob', phoneNumber: '+1555123456' };
    usersService.addContact.mockResolvedValue({ id: 'c-1', ...dto });

    const result = await controller.addContact(req, dto);
    expect(usersService.addContact).toHaveBeenCalledWith('u-123', dto);
    expect(result).toEqual({ id: 'c-1', ...dto });
  });

  it('should call usersService.deleteContact with request user id and contact id', async () => {
    const req = { user: { id: 'u-123' } };
    usersService.deleteContact.mockResolvedValue({ count: 1 });

    const result = await controller.deleteContact(req, 'c-1');
    expect(usersService.deleteContact).toHaveBeenCalledWith('u-123', 'c-1');
    expect(result).toEqual({ count: 1 });
  });
});
