import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IncidentsService } from '../incidents/incidents.service';
import { RedisService } from '../redis/redis.service';
import {
  DistressTriggerPayload,
  LocationUpdatePayload,
  VolunteerLocationPayload,
  ResponderStatusPayload,
  JoinIncidentPayload,
  SystemConfigUpdatePayload,
} from './types/socket.types';
import { IncidentStatus } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class SosGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SosGateway.name);

  constructor(
    private jwtService: JwtService,
    @Inject(forwardRef(() => IncidentsService))
    private incidentsService: IncidentsService,
    private redisService: RedisService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (rawToken) {
        if (rawToken === 'demo_mobile_token' || rawToken.startsWith('demo_mobile')) {
          socket.data.user = { sub: 'u_victim_mobile_01', id: 'u_victim_mobile_01', role: 'USER', phone: '+1555019888' };
          await this.redisService.mapUserSocket('u_victim_mobile_01', socket.id);
          this.logger.log(`Demo mobile user authenticated on socket ${socket.id}`);
        } else if (rawToken === 'demo_token' || rawToken.startsWith('demo_responder')) {
          socket.data.user = { sub: 'u_responder_1', id: 'u_responder_1', role: 'RESPONDER', phone: '+1999888777' };
          await this.redisService.mapUserSocket('u_responder_1', socket.id);
          socket.join('room:responders');
          this.logger.log(`Demo responder authenticated and joined room:responders on socket ${socket.id}`);
        } else if (rawToken.split('.').length === 3) {
          // Valid JWT structure
          try {
            const payload = this.jwtService.verify(rawToken, {
              secret: process.env.JWT_SECRET || 'guardian_jwt_secret_key_123!',
            });
            socket.data.user = payload;
            const userId = payload.sub || payload.id;
            if (userId) {
              await this.redisService.mapUserSocket(userId, socket.id);
              this.logger.log(`User ${userId} authenticated and mapped to socket ${socket.id}`);
            }
            if (payload.role === 'RESPONDER' || payload.role === 'ADMIN') {
              socket.join('room:responders');
            }
          } catch (err: any) {
            this.logger.log(`Socket token verification fallback (${err.message}): Assigned guest session.`);
            socket.data.user = { sub: 'u_guest_' + socket.id.substring(0, 8), role: 'USER' };
          }
        } else {
          socket.data.user = { sub: 'u_guest_' + socket.id.substring(0, 8), role: 'USER' };
        }
      } else {
        socket.data.user = { sub: 'u_guest_' + socket.id.substring(0, 8), role: 'USER' };
      }

      this.logger.log(`Client connected: ${socket.id}`);
    } catch (err: any) {
      this.logger.error(`Connection error: ${err.message}`);
    }
  }

  async handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('distress:triggered')
  async handleDistressTriggered(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DistressTriggerPayload,
  ) {
    try {
      const userId = client.data.user?.sub || client.data.user?.id || data.userId;
      if (!userId) {
        client.emit('error', { message: 'Unauthorized or missing userId' });
        return;
      }

      this.logger.warn(`[DISTRESS TRIGGERED] User ${userId} at (${data.lat}, ${data.lng}) via ${data.triggerType}`);

      // 1. Create incident in DB
      const incident = await this.incidentsService.createIncident(userId, {
        lat: data.lat,
        lng: data.lng,
        triggerType: data.triggerType,
        batteryLevel: data.batteryLevel,
        evidenceAudioUrl: data.evidenceAudioUrl,
      });

      // Join the incident room
      client.join(`room:inc_${incident.id}`);

      // 2. Acknowledge to triggering client
      client.emit('distress:acknowledged', {
        incidentId: incident.id,
        status: incident.status,
        startedAt: incident.startedAt,
      });

      // 3. Search Redis GEO for nearby volunteers within 500m
      const nearbyVolunteerIds = await this.redisService.findNearbyVolunteers(data.lat, data.lng, 500);

      // 4. Alert nearby volunteers
      for (const volId of nearbyVolunteerIds) {
        const volSocketId = await this.redisService.getUserSocket(volId);
        if (volSocketId) {
          this.server.to(volSocketId).emit('nearby:broadcast', {
            incidentId: incident.id,
            victimName: incident.user.name,
            coordinates: { lat: data.lat, lng: data.lng },
            distanceMeters: 250, // Approx
            triggerType: data.triggerType,
            startedAt: incident.startedAt,
          });
        }
      }

      // 5. Broadcast to responders room and globally
      this.server.to('room:responders').emit('nearby:broadcast', {
        incidentId: incident.id,
        victimId: userId,
        victimName: incident.user.name,
        victimPhone: incident.user.phone,
        coordinates: { lat: data.lat, lng: data.lng },
        batteryLevel: data.batteryLevel || 100,
        triggerType: data.triggerType,
        startedAt: incident.startedAt,
        status: incident.status,
      });

      this.server.emit('incident:new', incident);

      return { success: true, incidentId: incident.id };
    } catch (err: any) {
      this.logger.error(`Error in handleDistressTriggered: ${err.message}`);
      client.emit('error', { message: err.message });
    }
  }

  @SubscribeMessage('location:update')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LocationUpdatePayload,
  ) {
    try {
      if (!data.incidentId) return;

      // 1. Throttled update to Redis & DB
      await this.incidentsService.recordLocationUpdate(
        data.incidentId,
        data.lat,
        data.lng,
        data.batteryLevel,
      );

      const updatePayload = {
        incidentId: data.incidentId,
        coordinates: { lat: data.lat, lng: data.lng },
        lat: data.lat,
        lng: data.lng,
        batteryLevel: data.batteryLevel || 100,
        timestamp: new Date().toISOString(),
      };

      // 2. Broadcast to specific incident room and responders
      this.server.to(`room:inc_${data.incidentId}`).emit('location:update', updatePayload);
      this.server.to('room:responders').emit('location:update', updatePayload);
      this.server.emit('location:breadcrumb', updatePayload);

      return { success: true };
    } catch (err: any) {
      this.logger.error(`Error in location:update: ${err.message}`);
    }
  }

  @SubscribeMessage('volunteer:location_update')
  async handleVolunteerLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: VolunteerLocationPayload,
  ) {
    try {
      const volId = client.data.user?.sub || client.data.user?.id || data.volunteerId;
      if (volId && data.lat && data.lng) {
        await this.redisService.updateVolunteerLocation(volId, data.lat, data.lng);
      }
      return { success: true };
    } catch (err: any) {
      this.logger.error(`Error in volunteer:location_update: ${err.message}`);
    }
  }

  @SubscribeMessage('join:incident')
  async handleJoinIncident(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinIncidentPayload,
  ) {
    if (data.incidentId) {
      client.join(`room:inc_${data.incidentId}`);
      this.logger.log(`Socket ${client.id} joined room:inc_${data.incidentId}`);
      return { success: true, room: `room:inc_${data.incidentId}` };
    }
  }

  @SubscribeMessage('responder:status_change')
  async handleResponderStatusChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ResponderStatusPayload,
  ) {
    try {
      const responderId = client.data.user?.sub || client.data.user?.id || data.responderId;
      const updated = await this.incidentsService.updateStatus(
        data.incidentId,
        data.status,
        responderId,
      );

      this.broadcastStatusChange(data.incidentId, data.status, responderId, updated, data.estimatedArrivalMins);

      return { success: true, incident: updated };
    } catch (err: any) {
      this.logger.error(`Error in responder:status_change: ${err.message}`);
    }
  }

  public broadcastStatusChange(
    incidentId: string,
    status: IncidentStatus,
    resolvedByUserId?: string,
    updatedIncident?: any,
    estimatedArrivalMins: number = 5,
  ) {
    const broadcastData = {
      incidentId,
      status,
      responderId: resolvedByUserId,
      resolvedByUserId,
      estimatedArrivalMins,
      updatedAt: new Date().toISOString(),
    };

    if (this.server) {
      this.server.to(`room:inc_${incidentId}`).emit('events.responder.status_change', broadcastData);
      this.server.to(`room:inc_${incidentId}`).emit('incident:status_changed', broadcastData);
      this.server.to('room:responders').emit('responder:status_changed', broadcastData);
      this.server.to('room:responders').emit('incident:status_changed', broadcastData);
      this.server.emit('incident:status_changed', broadcastData);
      this.server.emit('responder:status_changed', broadcastData);
      if (updatedIncident) {
        this.server.emit('incident:updated', updatedIncident);
      }
      this.logger.log(`Broadcasted status change for incident #${incidentId} -> ${status}`);
    }
  }

  @SubscribeMessage('system:config_update')
  async handleSystemConfigUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SystemConfigUpdatePayload,
  ) {
    this.server.emit('events.system.configuration_update', data);
    return { success: true, broadcasted: true };
  }
}
