import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SmsService } from './sms.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

describe('SmsService', () => {
  let service: SmsService;
  let configService: { get: ReturnType<typeof vi.fn> };
  let redisService: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return null;
        if (key === 'TWILIO_AUTH_TOKEN') return null;
        if (key === 'TWILIO_PHONE_NUMBER') return null;
        return null;
      }),
    };
    redisService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };
    service = new SmsService(configService as unknown as ConfigService, redisService as unknown as RedisService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configuration & formatting', () => {
    it('should initialize in DEV-AUDIT mode when Twilio creds are missing', () => {
      expect(service.isTwilioConfigured()).toBe(false);
    });

    it('should detect when Twilio is properly configured', () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return 'AC_MOCK_SID';
        if (key === 'TWILIO_AUTH_TOKEN') return 'AUTH_TOKEN_123';
        if (key === 'TWILIO_PHONE_NUMBER') return '+18005550199';
        return null;
      });
      const configuredService = new SmsService(
        configService as unknown as ConfigService,
        redisService as unknown as RedisService,
      );
      expect(configuredService.isTwilioConfigured()).toBe(true);
    });

    it('should format distress message properly with coordinates and battery level', () => {
      const msg = service.formatDistressMessage(
        {
          incidentId: 'abcdef1234567890',
          victimName: 'Elena Rostova',
          victimPhone: '+1555111222',
          triggerType: 'AUDIO_SCREAM',
          lat: 40.7128,
          lng: -74.006,
          batteryLevel: 85.4,
          recipients: [],
        },
        'Agent Mom',
      );

      expect(msg).toContain('GUARDIAN EMERGENCY ALERT');
      expect(msg).toContain('Hello Agent Mom');
      expect(msg).toContain('Elena Rostova');
      expect(msg).toContain('AUDIO SCREAM');
      expect(msg).toContain('85%');
      expect(msg).toContain('https://maps.google.com/?q=40.71280,-74.00600');
    });
  });

  describe('dispatchEmergencyAlert', () => {
    const payload = {
      incidentId: 'inc-12345678',
      victimName: 'John',
      victimPhone: '+1555000111',
      triggerType: 'MANUAL_SOS',
      lat: 40.7128,
      lng: -74.006,
      recipients: [
        { name: 'Mom', phone: '+1555111222' },
        { name: 'Dad', phone: '   ' }, // empty phone edge case
      ],
    };

    it('should return empty results if recipients list is empty', async () => {
      const results = await service.dispatchEmergencyAlert({ ...payload, recipients: [] });
      expect(results).toEqual([]);
    });

    it('should dispatch via DEV_AUDIT_LOG mode and set Redis cooldown', async () => {
      const results = await service.dispatchEmergencyAlert(payload);

      expect(results).toHaveLength(1);
      expect(results[0].recipient).toBe('+1555111222');
      expect(results[0].contactName).toBe('Mom');
      expect(results[0].mode).toBe('DEV_AUDIT_LOG');
      expect(results[0].success).toBe(true);
      expect(results[0].messageSid).toContain('audit_msg_');
      expect(redisService.set).toHaveBeenCalledWith(
        'sms:cooldown:inc-12345678:+1555111222',
        '1',
        60,
      );
    });

    it('should throttle dispatch if contact is already in Redis cooldown', async () => {
      redisService.get.mockResolvedValue('1'); // throttled

      const results = await service.dispatchEmergencyAlert(payload);

      expect(results).toHaveLength(1);
      expect(results[0].mode).toBe('THROTTLED');
      expect(results[0].success).toBe(true);
    });

    it('should dispatch via live Twilio API when configured and response is ok', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return 'AC_SID';
        if (key === 'TWILIO_AUTH_TOKEN') return 'AUTH_TOKEN';
        if (key === 'TWILIO_PHONE_NUMBER') return '+18005550199';
        return null;
      });
      const twilioService = new SmsService(
        configService as unknown as ConfigService,
        redisService as unknown as RedisService,
      );

      // Mock global fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM_LIVE_12345' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const results = await twilioService.dispatchEmergencyAlert(payload);
      expect(results[0].mode).toBe('TWILIO_LIVE');
      expect(results[0].success).toBe(true);
      expect(results[0].messageSid).toBe('SM_LIVE_12345');
    });

    it('should handle Twilio error response gracefully', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return 'AC_SID';
        if (key === 'TWILIO_AUTH_TOKEN') return 'AUTH_TOKEN';
        if (key === 'TWILIO_PHONE_NUMBER') return '+18005550199';
        return null;
      });
      const twilioService = new SmsService(
        configService as unknown as ConfigService,
        redisService as unknown as RedisService,
      );

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Invalid phone number' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const results = await twilioService.dispatchEmergencyAlert(payload);
      expect(results[0].mode).toBe('TWILIO_LIVE');
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Invalid phone number');
    });

    it('should handle network exception during Twilio dispatch', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TWILIO_ACCOUNT_SID') return 'AC_SID';
        if (key === 'TWILIO_AUTH_TOKEN') return 'AUTH_TOKEN';
        if (key === 'TWILIO_PHONE_NUMBER') return '+18005550199';
        return null;
      });
      const twilioService = new SmsService(
        configService as unknown as ConfigService,
        redisService as unknown as RedisService,
      );

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
      vi.stubGlobal('fetch', mockFetch);

      const results = await twilioService.dispatchEmergencyAlert(payload);
      expect(results[0].mode).toBe('TWILIO_LIVE');
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Network timeout');
    });
  });
});
