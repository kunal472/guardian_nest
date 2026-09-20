import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RedisService } from './redis.service';

const mockClientInstance = {
  status: 'ready',
  connect: vi.fn().mockResolvedValue(undefined),
  quit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  del: vi.fn().mockResolvedValue(1),
  geoadd: vi.fn().mockResolvedValue(1),
  geosearch: vi.fn().mockResolvedValue(['vol-1', 'vol-2']),
  georadius: vi.fn().mockResolvedValue(['vol-3']),
};

vi.mock('ioredis', () => {
  return {
    default: class MockRedis {
      status = mockClientInstance.status;
      connect = mockClientInstance.connect;
      quit = mockClientInstance.quit;
      on = mockClientInstance.on;
      set = mockClientInstance.set;
      get = mockClientInstance.get;
      del = mockClientInstance.del;
      geoadd = mockClientInstance.geoadd;
      geosearch = mockClientInstance.geosearch;
      georadius = mockClientInstance.georadius;
    },
  };
});

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(() => {
    mockClientInstance.status = 'ready';
    mockClientInstance.connect.mockReset().mockResolvedValue(undefined);
    mockClientInstance.quit.mockReset().mockResolvedValue(undefined);
    mockClientInstance.on.mockReset();
    mockClientInstance.set.mockReset().mockResolvedValue('OK');
    mockClientInstance.get.mockReset().mockResolvedValue(null);
    mockClientInstance.del.mockReset().mockResolvedValue(1);
    mockClientInstance.geoadd.mockReset().mockResolvedValue(1);
    mockClientInstance.geosearch.mockReset().mockResolvedValue(['vol-1', 'vol-2']);
    mockClientInstance.georadius.mockReset().mockResolvedValue(['vol-3']);

    service = new RedisService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('lifecycle', () => {
    it('onModuleInit should create Redis client and attach event listeners', () => {
      service.onModuleInit();
      expect(service.client).toBeDefined();
      expect(mockClientInstance.connect).toHaveBeenCalled();
      expect(mockClientInstance.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockClientInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle connection error callback on connect', async () => {
      mockClientInstance.connect.mockRejectedValue(new Error('Connection deferred'));
      service.onModuleInit();
      expect(service.client).toBeDefined();
    });

    it('onModuleDestroy should quit redis client', async () => {
      service.onModuleInit();
      await service.onModuleDestroy();
      expect(mockClientInstance.quit).toHaveBeenCalled();
    });
  });

  describe('set & get & del', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should set key with TTL when client is ready', async () => {
      await service.set('key1', 'val1', 60);
      expect(mockClientInstance.set).toHaveBeenCalledWith('key1', 'val1', 'EX', 60);
    });

    it('should set key without TTL when ttl is omitted', async () => {
      await service.set('key1', 'val1');
      expect(mockClientInstance.set).toHaveBeenCalledWith('key1', 'val1');
    });

    it('should not throw if set fails', async () => {
      mockClientInstance.set.mockRejectedValue(new Error('SET error'));
      await expect(service.set('key1', 'val1')).resolves.toBeUndefined();
    });

    it('should get value when client is ready', async () => {
      mockClientInstance.get.mockResolvedValue('cached_val');
      const val = await service.get('key1');
      expect(val).toBe('cached_val');
      expect(mockClientInstance.get).toHaveBeenCalledWith('key1');
    });

    it('should return null when client is not ready or get throws', async () => {
      service.client.status = 'connecting';
      expect(await service.get('key1')).toBeNull();

      service.client.status = 'ready';
      mockClientInstance.get.mockRejectedValue(new Error('GET error'));
      expect(await service.get('key1')).toBeNull();
    });

    it('should delete key when ready and catch error', async () => {
      await service.del('key1');
      expect(mockClientInstance.del).toHaveBeenCalledWith('key1');

      mockClientInstance.del.mockRejectedValue(new Error('DEL error'));
      await expect(service.del('key1')).resolves.toBeUndefined();
    });
  });

  describe('user socket mapping', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should map user socket with 24h expiration', async () => {
      await service.mapUserSocket('u-1', 'sock-123');
      expect(mockClientInstance.set).toHaveBeenCalledWith('user:socket:u-1', 'sock-123', 'EX', 86400);
    });

    it('should get user socket', async () => {
      mockClientInstance.get.mockResolvedValue('sock-123');
      const sock = await service.getUserSocket('u-1');
      expect(sock).toBe('sock-123');
      expect(mockClientInstance.get).toHaveBeenCalledWith('user:socket:u-1');
    });
  });

  describe('incident cache', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should cache active incident data as JSON', async () => {
      const data = { id: 'inc-1', status: 'ACTIVE' };
      await service.cacheActiveIncident('inc-1', data);
      expect(mockClientInstance.set).toHaveBeenCalledWith('incident:inc-1:active', JSON.stringify(data), 'EX', 3600);
    });

    it('should retrieve and parse cached active incident', async () => {
      const data = { id: 'inc-1', status: 'ACTIVE' };
      mockClientInstance.get.mockResolvedValue(JSON.stringify(data));
      const res = await service.getActiveIncident('inc-1');
      expect(res).toEqual(data);
    });

    it('should return null if active incident is not in cache', async () => {
      mockClientInstance.get.mockResolvedValue(null);
      const res = await service.getActiveIncident('inc-none');
      expect(res).toBeNull();
    });
  });

  describe('geospatial operations', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should add volunteer location via geoadd', async () => {
      await service.updateVolunteerLocation('vol-1', 40.7128, -74.006);
      expect(mockClientInstance.geoadd).toHaveBeenCalledWith('volunteers:active_locations', -74.006, 40.7128, 'vol-1');
    });

    it('should catch error on geoadd gracefully', async () => {
      mockClientInstance.geoadd.mockRejectedValue(new Error('GEO error'));
      await expect(service.updateVolunteerLocation('vol-1', 40.7128, -74.006)).resolves.toBeUndefined();
    });

    it('should find nearby volunteers using geosearch', async () => {
      const result = await service.findNearbyVolunteers(40.7128, -74.006, 500);
      expect(result).toEqual(['vol-1', 'vol-2']);
      expect(mockClientInstance.geosearch).toHaveBeenCalledWith(
        'volunteers:active_locations',
        'FROMLONLAT',
        -74.006,
        40.7128,
        'BYRADIUS',
        500,
        'm',
      );
    });

    it('should fallback to georadius if geosearch throws', async () => {
      mockClientInstance.geosearch.mockRejectedValue(new Error('geosearch not supported'));
      const result = await service.findNearbyVolunteers(40.7128, -74.006, 500);
      expect(result).toEqual(['vol-3']);
      expect(mockClientInstance.georadius).toHaveBeenCalledWith(
        'volunteers:active_locations',
        -74.006,
        40.7128,
        500,
        'm',
      );
    });

    it('should return empty array if both geosearch and georadius fail', async () => {
      mockClientInstance.geosearch.mockRejectedValue(new Error('geosearch failed'));
      mockClientInstance.georadius.mockRejectedValue(new Error('georadius failed'));
      const result = await service.findNearbyVolunteers(40.7128, -74.006, 500);
      expect(result).toEqual([]);
    });
  });
});
