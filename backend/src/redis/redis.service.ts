import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: Redis;

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) {
          return null; // stop retrying
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });

    this.client.connect().catch((err) => {
      this.logger.warn(`Redis connection deferred or unavailable (${redisUrl}): ${err.message}`);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis connected successfully.');
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (this.client.status === 'ready') {
        if (ttlSeconds) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Redis SET failed for key ${key}: ${err.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.client.status === 'ready') {
        return await this.client.get(key);
      }
    } catch (err: any) {
      this.logger.warn(`Redis GET failed for key ${key}: ${err.message}`);
    }
    return null;
  }

  async del(key: string): Promise<void> {
    try {
      if (this.client.status === 'ready') {
        await this.client.del(key);
      }
    } catch (err: any) {
      this.logger.warn(`Redis DEL failed for key ${key}: ${err.message}`);
    }
  }

  async mapUserSocket(userId: string, socketId: string): Promise<void> {
    await this.set(`user:socket:${userId}`, socketId, 86400); // 24 hours
  }

  async getUserSocket(userId: string): Promise<string | null> {
    return await this.get(`user:socket:${userId}`);
  }

  async cacheActiveIncident(incidentId: string, data: any): Promise<void> {
    await this.set(`incident:${incidentId}:active`, JSON.stringify(data), 3600); // 1 hour
  }

  async getActiveIncident(incidentId: string): Promise<any | null> {
    const raw = await this.get(`incident:${incidentId}:active`);
    return raw ? JSON.parse(raw) : null;
  }

  async updateVolunteerLocation(volunteerId: string, lat: number, lng: number): Promise<void> {
    try {
      if (this.client.status === 'ready') {
        await this.client.geoadd('volunteers:active_locations', lng, lat, volunteerId);
      }
    } catch (err: any) {
      this.logger.warn(`Redis GEOADD failed: ${err.message}`);
    }
  }

  async findNearbyVolunteers(lat: number, lng: number, radiusMeters: number = 500): Promise<string[]> {
    try {
      if (this.client.status === 'ready') {
        // Use geosearch if supported, fallback to georadius
        try {
          const results = await this.client.geosearch(
            'volunteers:active_locations',
            'FROMLONLAT',
            lng,
            lat,
            'BYRADIUS',
            radiusMeters,
            'm'
          );
          return results as string[];
        } catch {
          const results = await this.client.georadius(
            'volunteers:active_locations',
            lng,
            lat,
            radiusMeters,
            'm'
          );
          return results as string[];
        }
      }
    } catch (err: any) {
      this.logger.warn(`Redis FindNearbyVolunteers failed: ${err.message}`);
    }
    return [];
  }
}
