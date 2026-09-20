import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { VolunteersController } from './volunteers.controller';
import { VolunteersService } from './volunteers.service';

describe('VolunteersController', () => {
  let controller: VolunteersController;
  let volunteersService: {
    optIn: ReturnType<typeof vi.fn>;
    updateLocation: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    volunteersService = {
      optIn: vi.fn(),
      updateLocation: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VolunteersController],
      providers: [{ provide: VolunteersService, useValue: volunteersService }],
    }).compile();

    controller = module.get<VolunteersController>(VolunteersController);
  });

  it('should call volunteersService.optIn with authenticated user id', async () => {
    const req = { user: { id: 'u-vol-1' } };
    const mockRes = { status: 'active_sentinel', isVolunteer: true };
    volunteersService.optIn.mockResolvedValue(mockRes);

    const result = await controller.optIn(req);
    expect(volunteersService.optIn).toHaveBeenCalledWith('u-vol-1');
    expect(result).toEqual(mockRes);
  });

  it('should call volunteersService.updateLocation with user id and coordinates', async () => {
    const req = { user: { id: 'u-vol-1' } };
    const body = { lat: 40.7128, lng: -74.006 };
    volunteersService.updateLocation.mockResolvedValue({ success: true, ...body });

    const result = await controller.updateLocation(req, body);
    expect(volunteersService.updateLocation).toHaveBeenCalledWith('u-vol-1', 40.7128, -74.006);
    expect(result).toEqual({ success: true, ...body });
  });
});
