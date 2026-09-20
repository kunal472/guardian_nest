import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { register: ReturnType<typeof vi.fn>; login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authService = {
      register: vi.fn(),
      login: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should call authService.register and return result', async () => {
    const dto = { phone: '+1555123456', password: 'password', name: 'John Doe' };
    const mockResponse = { token: 'token123', user: { id: 'u1', name: 'John Doe' } };
    authService.register.mockResolvedValue(mockResponse);

    const result = await controller.register(dto as any);
    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });

  it('should call authService.login and return result', async () => {
    const dto = { phone: '+1555123456', password: 'password' };
    const mockResponse = { token: 'token123', user: { id: 'u1', name: 'John Doe' } };
    authService.login.mockResolvedValue(mockResponse);

    const result = await controller.login(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockResponse);
  });
});
