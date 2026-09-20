import io from 'socket.io-client';
import { mockSocketInstance } from '../../jest.setup';

describe('Socket.IO Gateway Integration Tests', () => {
  let socket: any;

  beforeEach(() => {
    mockSocketInstance._clearAll();
    socket = io('http://localhost:3000', {
      auth: { token: 'mock_jwt_token_123' },
      transports: ['websocket'],
    });
  });

  afterEach(() => {
    socket.disconnect();
  });

  it('should establish connection and receive connect event', (done) => {
    socket.on('connect', () => {
      expect(socket.connected).toBe(true);
      done();
    });

    mockSocketInstance._trigger('connect');
  });

  it('should emit distress:triggered and handle server acknowledgment', (done) => {
    const distressPayload = {
      userId: 'victim_user_01',
      lat: 40.7128,
      lng: -74.006,
      triggerType: 'AUDIO_SCREAM',
      batteryLevel: 85,
    };

    socket.on('distress:acknowledged', (ack: any) => {
      expect(ack.incidentId).toBe('inc_test_999');
      expect(ack.status).toBe('ACTIVE');
      done();
    });

    socket.emit('distress:triggered', distressPayload);
    expect(socket.emit).toHaveBeenCalledWith('distress:triggered', distressPayload);

    // Simulate backend response
    mockSocketInstance._trigger('distress:acknowledged', {
      incidentId: 'inc_test_999',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
    });
  });

  it('should emit dynamic location updates during active SOS', () => {
    const locationPayload = {
      incidentId: 'inc_test_999',
      lat: 40.713,
      lng: -74.0058,
      batteryLevel: 84,
    };

    socket.emit('location:update', locationPayload);
    expect(socket.emit).toHaveBeenCalledWith('location:update', locationPayload);
  });

  it('should process nearby:broadcast events for community sentinels', (done) => {
    socket.on('nearby:broadcast', (alert: any) => {
      expect(alert.incidentId).toBe('inc_broadcast_123');
      expect(alert.distanceMeters).toBe(250);
      expect(alert.triggerType).toBe('MANUAL_SOS');
      done();
    });

    mockSocketInstance._trigger('nearby:broadcast', {
      incidentId: 'inc_broadcast_123',
      victimName: 'Jane Victim',
      coordinates: { lat: 40.7128, lng: -74.006 },
      distanceMeters: 250,
      triggerType: 'MANUAL_SOS',
    });
  });

  it('should handle responder:status_changed updates and transition UI state', (done) => {
    socket.on('events.responder.status_change', (update: any) => {
      expect(update.status).toBe('DISPATCHED');
      expect(update.estimatedArrivalMins).toBe(3);
      done();
    });

    mockSocketInstance._trigger('events.responder.status_change', {
      incidentId: 'inc_test_999',
      status: 'DISPATCHED',
      responderId: 'u_responder_01',
      estimatedArrivalMins: 3,
    });
  });

  it('should handle disconnect and reconnect lifecycle', (done) => {
    socket.on('disconnect', (reason: string) => {
      expect(reason).toBeDefined();

      // Now simulate reconnect
      socket.on('connect', () => {
        done();
      });
      mockSocketInstance._trigger('connect');
    });

    mockSocketInstance._trigger('disconnect', 'transport close');
  });
});
