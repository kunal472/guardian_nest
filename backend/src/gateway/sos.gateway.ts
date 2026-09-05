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
import { Logger } from '@nestjs/common';
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
    private incidentsService: IncidentsService,
    private redisService: RedisService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          const payload = this.jwtService.verify(token, {
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
          this.logger.warn(`Socket JWT verify warning: ${err.message}`);
        }
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

      const broadcastData = {
        incidentId: data.incidentId,
        responderId,
        status: data.status,
        estimatedArrivalMins: data.estimatedArrivalMins || 5,
        updatedAt: new Date().toISOString(),
      };

      this.server.to(`room:inc_${data.incidentId}`).emit('events.responder.status_change', broadcastData);
      this.server.to('room:responders').emit('responder:status_changed', broadcastData);
      this.server.emit('incident:updated', updated);

      return { success: true, incident: updated };
    } catch (err: any) {
      this.logger.error(`Error in responder:status_change: ${err.message}`);
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
