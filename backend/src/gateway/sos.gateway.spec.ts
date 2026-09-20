import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SosGateway } from './sos.gateway';
import { JwtService } from '@nestjs/jwt';
import { IncidentsService } from '../incidents/incidents.service';
import { RedisService } from '../redis/redis.service';
import { IncidentStatus, TriggerType } from '@prisma/client';

describe('SosGateway', () => {
  let gateway: SosGateway;
  let jwtService: { verify: ReturnType<typeof vi.fn> };
  let incidentsService: {
    createIncident: ReturnType<typeof vi.fn>;
    recordLocationUpdate: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let redisService: {
    mapUserSocket: ReturnType<typeof vi.fn>;
    findNearbyVolunteers: ReturnType<typeof vi.fn>;
    getUserSocket: ReturnType<typeof vi.fn>;
    updateVolunteerLocation: ReturnType<typeof vi.fn>;
  };
  let mockServer: any;

  beforeEach(() => {
    jwtService = { verify: vi.fn() };
    incidentsService = {
      createIncident: vi.fn(),
      recordLocationUpdate: vi.fn(),
      updateStatus: vi.fn(),
    };
    redisService = {
      mapUserSocket: vi.fn().mockResolvedValue(undefined),
      findNearbyVolunteers: vi.fn().mockResolvedValue([]),
      getUserSocket: vi.fn().mockResolvedValue(null),
      updateVolunteerLocation: vi.fn().mockResolvedValue(undefined),
    };

    const roomMock = { emit: vi.fn() };
    mockServer = {
      emit: vi.fn(),
      to: vi.fn().mockReturnValue(roomMock),
    };

    gateway = new SosGateway(
      jwtService as unknown as JwtService,
      incidentsService as unknown as IncidentsService,
      redisService as unknown as RedisService,
    );
    gateway.server = mockServer;
  });

  describe('handleConnection', () => {
    it('should authenticate demo mobile token', async () => {
      const socket: any = {
        id: 'sock_mobile_1',
        handshake: { auth: { token: 'demo_mobile_token' }, headers: {} },
        data: {},
        join: vi.fn(),
      };

      await gateway.handleConnection(socket);
      expect(socket.data.user.id).toBe('u_victim_mobile_01');
      expect(redisService.mapUserSocket).toHaveBeenCalledWith('u_victim_mobile_01', 'sock_mobile_1');
    });

    it('should authenticate demo responder token and join responders room', async () => {
      const socket: any = {
        id: 'sock_resp_1',
        handshake: { auth: { token: 'demo_responder_token' }, headers: {} },
        data: {},
        join: vi.fn(),
      };

      await gateway.handleConnection(socket);
      expect(socket.data.user.role).toBe('RESPONDER');
      expect(socket.join).toHaveBeenCalledWith('room:responders');
    });

    it('should authenticate valid JWT for ADMIN and join room:responders', async () => {
      const socket: any = {
        id: 'sock_admin_1',
        handshake: { auth: {}, headers: { authorization: 'Bearer aaa.bbb.ccc' } },
        data: {},
        join: vi.fn(),
      };
      jwtService.verify.mockReturnValue({ sub: 'admin-1', role: 'ADMIN' });

      await gateway.handleConnection(socket);
      expect(socket.data.user.sub).toBe('admin-1');
      expect(socket.join).toHaveBeenCalledWith('room:responders');
      expect(redisService.mapUserSocket).toHaveBeenCalledWith('admin-1', 'sock_admin_1');
    });

    it('should fallback to guest session when JWT verification throws', async () => {
      const socket: any = {
        id: 'sock_guest_1',
        handshake: { auth: { token: 'bad.jwt.token' }, headers: {} },
        data: {},
        join: vi.fn(),
      };
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await gateway.handleConnection(socket);
      expect(socket.data.user.sub).toContain('u_guest_');
    });

    it('should assign guest session when no token provided', async () => {
      const socket: any = {
        id: 'sock_anon_1',
        handshake: { auth: {}, headers: {} },
        data: {},
        join: vi.fn(),
      };

      await gateway.handleConnection(socket);
      expect(socket.data.user.sub).toContain('u_guest_');
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnect without error', async () => {
      const socket: any = { id: 'sock_1' };
      await gateway.handleDisconnect(socket);
    });
  });

  describe('handleDistressTriggered', () => {
    it('should create incident, alert nearby volunteers, and broadcast to responders', async () => {
      const socket: any = {
        id: 'sock_victim',
        data: { user: { sub: 'u-victim' } },
        join: vi.fn(),
        emit: vi.fn(),
      };

      const payload = {
        userId: 'u-victim',
        lat: 40.7128,
        lng: -74.006,
        triggerType: TriggerType.MANUAL_SOS,
        batteryLevel: 90,
      };

      const mockIncident = {
        id: 'inc-123',
        userId: 'u-victim',
        status: IncidentStatus.ACTIVE,
        startedAt: new Date(),
        user: { name: 'Elena', phone: '+1555123456' },
      };
      incidentsService.createIncident.mockResolvedValue(mockIncident);
      redisService.findNearbyVolunteers.mockResolvedValue(['vol-1']);
      redisService.getUserSocket.mockResolvedValue('sock_vol_1');

      const result = await gateway.handleDistressTriggered(socket, payload as any);

      expect(result).toEqual({ success: true, incidentId: 'inc-123' });
      expect(socket.join).toHaveBeenCalledWith('room:inc_inc-123');
      expect(socket.emit).toHaveBeenCalledWith('distress:acknowledged', {
        incidentId: 'inc-123',
        status: IncidentStatus.ACTIVE,
        startedAt: mockIncident.startedAt,
      });
      expect(mockServer.to).toHaveBeenCalledWith('sock_vol_1');
      expect(mockServer.to).toHaveBeenCalledWith('room:responders');
      expect(mockServer.emit).toHaveBeenCalledWith('incident:new', mockIncident);
    });

    it('should emit error when unauthorized or missing userId', async () => {
      const socket: any = {
        id: 'sock_anon',
        data: {},
        emit: vi.fn(),
      };

      await gateway.handleDistressTriggered(socket, {} as any);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized or missing userId' });
    });

    it('should catch error on failure and emit error to client', async () => {
      const socket: any = {
        id: 'sock_err',
        data: { user: { sub: 'u-1' } },
        join: vi.fn(),
        emit: vi.fn(),
      };
      incidentsService.createIncident.mockRejectedValue(new Error('DB Failed'));

      await gateway.handleDistressTriggered(socket, { lat: 40.71, lng: -74.0, triggerType: 'MANUAL_SOS' } as any);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'DB Failed' });
    });
  });

  describe('handleLocationUpdate', () => {
    it('should record location update and emit breadcrumbs', async () => {
      const socket: any = { id: 'sock_1' };
      const data = { incidentId: 'inc-123', lat: 40.7128, lng: -74.006, batteryLevel: 80 };

      const res = await gateway.handleLocationUpdate(socket, data);
      expect(res).toEqual({ success: true });
      expect(incidentsService.recordLocationUpdate).toHaveBeenCalledWith('inc-123', 40.7128, -74.006, 80);
      expect(mockServer.emit).toHaveBeenCalledWith('location:breadcrumb', expect.any(Object));
    });

    it('should ignore location update if incidentId is missing', async () => {
      const socket: any = { id: 'sock_1' };
      await gateway.handleLocationUpdate(socket, {} as any);
      expect(incidentsService.recordLocationUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleVolunteerLocationUpdate', () => {
    it('should update volunteer location in Redis', async () => {
      const socket: any = { id: 'sock_1', data: { user: { id: 'vol-1' } } };
      const data = { volunteerId: 'vol-1', lat: 40.7128, lng: -74.006 };

      const res = await gateway.handleVolunteerLocationUpdate(socket, data);
      expect(res).toEqual({ success: true });
      expect(redisService.updateVolunteerLocation).toHaveBeenCalledWith('vol-1', 40.7128, -74.006);
    });
  });

  describe('handleJoinIncident', () => {
    it('should join client to incident room', async () => {
      const socket: any = { id: 'sock_1', join: vi.fn() };
      const res = await gateway.handleJoinIncident(socket, { incidentId: 'inc-123' });
      expect(res).toEqual({ success: true, room: 'room:inc_inc-123' });
      expect(socket.join).toHaveBeenCalledWith('room:inc_inc-123');
    });
  });

  describe('handleResponderStatusChange', () => {
    it('should update status and broadcast status change', async () => {
      const socket: any = { id: 'sock_1', data: { user: { sub: 'u-resp' } } };
      const data = { incidentId: 'inc-123', status: IncidentStatus.RESOLVED };
      const mockUpdated = { id: 'inc-123', status: IncidentStatus.RESOLVED };
      incidentsService.updateStatus.mockResolvedValue(mockUpdated);

      const res = await gateway.handleResponderStatusChange(socket, data);
      expect(res).toEqual({ success: true, incident: mockUpdated });
      expect(incidentsService.updateStatus).toHaveBeenCalledWith('inc-123', IncidentStatus.RESOLVED, 'u-resp');
    });

    it('should return error if incidentId is missing', async () => {
      const socket: any = { id: 'sock_1', data: {} };
      const res = await gateway.handleResponderStatusChange(socket, {});
      expect(res).toEqual({ success: false, message: 'Missing incidentId' });
    });
  });

  describe('handleSystemConfigUpdate', () => {
    it('should broadcast configuration update', async () => {
      const socket: any = { id: 'sock_1' };
      const data = { yamnetScreamThreshold: 0.8 } as any;
      const res = await gateway.handleSystemConfigUpdate(socket, data);
      expect(res).toEqual({ success: true, broadcasted: true });
      expect(mockServer.emit).toHaveBeenCalledWith('events.system.configuration_update', data);
    });
  });
});
