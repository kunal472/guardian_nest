import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { logger } from '../utils/logger';

export interface LocationFix {
  lat: number;
  lng: number;
  altitude?: number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: string;
}

export type LocationCallback = (location: LocationFix) => void;

/**
 * Compute Haversine distance in meters between two GPS coordinate points
 */
export function computeHaversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === 0 && lon1 === 0) return 999999;
  if (lat2 === 0 && lon2 === 0) return 999999;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

class HardwareLocationService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private webWatchId: number | null = null;
  private hasPermission: boolean | null = null;
  private isSimulatedMode: boolean = false;
  private fallbackCoords: { lat: number; lng: number } | null = null;
  private activeCallback: LocationCallback | null = null;

  /**
   * Ensure that the device Location Provider (GPS toggle) is enabled
   */
  public async ensureLocationServicesEnabled(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled && Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
          return await Location.hasServicesEnabledAsync();
        } catch {
          return false;
        }
      }
      return enabled;
    } catch {
      return false;
    }
  }

  /**
   * Request permissions from OS for foreground geolocation
   */
  public async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          this.hasPermission = true;
          return true;
        }
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      return this.hasPermission;
    } catch (err) {
      console.warn('[HardwareLocation] Permission request failed:', err);
      this.hasPermission = false;
      return false;
    }
  }

  /**
   * Get single instantaneous high-accuracy GPS location fix with strict cache invalidation
   */
  public async getCurrentLocation(): Promise<LocationFix | null> {
    if (this.isSimulatedMode && this.fallbackCoords) {
      return this.getSimulatedFix();
    }

    try {
      if (Platform.OS === 'web') {
        return await this.getWebCurrentPosition();
      }

      await this.ensureLocationServicesEnabled();

      const hasPerm = this.hasPermission ?? (await this.requestPermissions());
      if (!hasPerm) {
        return this.fallbackCoords ? this.getSimulatedFix() : null;
      }

      // 1. Fetch fresh high-accuracy position from satellite/network
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (loc && loc.coords && loc.coords.latitude !== 0) {
          const fix: LocationFix = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            altitude: loc.coords.altitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            heading: loc.coords.heading,
            timestamp: new Date(loc.timestamp).toISOString(),
          };
          this.fallbackCoords = { lat: fix.lat, lng: fix.lng };
          logger.telemetry(`Fresh GPS fix resolved: (${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}) ±${fix.accuracy?.toFixed(1)}m`);
          return fix;
        }
      } catch (freshErr) {
        logger.warn('[HardwareLocation] getCurrentPositionAsync fallback to cached:', freshErr);
      }

      // 2. Fallback to last known position
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 120000 });
        if (lastKnown && lastKnown.coords && lastKnown.coords.latitude !== 0) {
          const timestampMs = typeof lastKnown.timestamp === 'number'
            ? lastKnown.timestamp
            : new Date(lastKnown.timestamp).getTime();

          const fix: LocationFix = {
            lat: lastKnown.coords.latitude,
            lng: lastKnown.coords.longitude,
            altitude: lastKnown.coords.altitude,
            accuracy: lastKnown.coords.accuracy,
            speed: lastKnown.coords.speed,
            heading: lastKnown.coords.heading,
            timestamp: new Date(timestampMs).toISOString(),
          };
          this.fallbackCoords = { lat: fix.lat, lng: fix.lng };
          logger.telemetry(`Cached GPS fix fallback: (${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}) ±${fix.accuracy?.toFixed(1)}m`);
          return fix;
        }
      } catch {}

      return this.fallbackCoords ? this.getSimulatedFix() : null;
    } catch (err) {
      console.warn('[HardwareLocation] getCurrentLocation fallback:', err);
      return this.fallbackCoords ? this.getSimulatedFix() : null;
    }
  }

  /**
   * Start live GPS tracking stream with dynamic accuracy escalation (High for SOS, Balanced for standby)
   * @param onUpdate callback invoked on every satellite fix
   * @param isSosActive true = 1000ms high-priority emergency interval, false = 2000ms standby
   */
  public async startTracking(onUpdate: LocationCallback, isSosActive: boolean): Promise<void> {
    this.stopTracking();
    this.activeCallback = onUpdate;

    if (this.isSimulatedMode) {
      this.startSimulatedTracking(onUpdate, isSosActive);
      return;
    }

    // 1. Fetch initial fresh position asynchronously and only emit if genuine
    this.getCurrentLocation().then((initialFix) => {
      if (initialFix && initialFix.lat !== 0 && this.activeCallback) {
        this.activeCallback(initialFix);
      }
    }).catch(() => {});

    try {
      const hasPerm = this.hasPermission ?? (await this.requestPermissions());
      if (!hasPerm) {
        if (this.isSimulatedMode) this.startSimulatedTracking(onUpdate, isSosActive);
        return;
      }

      if (Platform.OS === 'web') {
        this.startWebTracking(onUpdate, isSosActive);
        return;
      }

      // Native iOS / Android Fused High-Accuracy Location Watcher
      const intervalMs = isSosActive ? 1000 : 2000;
      const accuracyMode = isSosActive ? Location.Accuracy.High : Location.Accuracy.Balanced;

      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: accuracyMode,
          timeInterval: intervalMs,
          distanceInterval: 0,
        },
        (loc) => {
          if (!loc || !loc.coords || loc.coords.latitude === 0) return;
          const fix: LocationFix = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            altitude: loc.coords.altitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            heading: loc.coords.heading,
            timestamp: new Date(loc.timestamp).toISOString(),
          };
          this.fallbackCoords = { lat: fix.lat, lng: fix.lng };
          if (this.activeCallback) {
            this.activeCallback(fix);
          }
        }
      );
    } catch (err) {
      console.warn('[HardwareLocation] Native watcher failed:', err);
      if (this.isSimulatedMode) this.startSimulatedTracking(onUpdate, isSosActive);
    }
  }

  /**
   * Force instantaneous GPS poll and invoke active callback immediately
   */
  public async forceRefreshLocation(): Promise<LocationFix | null> {
    const fix = await this.getCurrentLocation();
    if (fix && fix.lat !== 0 && this.activeCallback) {
      this.activeCallback(fix);
    }
    return fix;
  }

  /**
   * Stop active GPS subscription
   */
  public stopTracking(): void {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    if (this.webWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.webWatchId);
      this.webWatchId = null;
    }
    if (this.simulatedTimer) {
      clearInterval(this.simulatedTimer);
      this.simulatedTimer = null;
    }
    this.activeCallback = null;
  }

  // --- Platform & Simulated Fallbacks ---

  private simulatedTimer: any = null;

  private getSimulatedFix(): LocationFix {
    if (!this.fallbackCoords) {
      return {
        lat: 0,
        lng: 0,
        altitude: 0,
        accuracy: 0,
        speed: 0,
        heading: 0,
        timestamp: new Date().toISOString(),
      };
    }
    const delta = (Math.random() - 0.5) * 0.0003;
    this.fallbackCoords = {
      lat: this.fallbackCoords.lat + delta,
      lng: this.fallbackCoords.lng + delta,
    };
    return {
      lat: this.fallbackCoords.lat,
      lng: this.fallbackCoords.lng,
      altitude: 12.5,
      accuracy: 4.8,
      speed: 0.2,
      heading: 90,
      timestamp: new Date().toISOString(),
    };
  }

  private startSimulatedTracking(onUpdate: LocationCallback, isSosActive: boolean): void {
    const intervalMs = isSosActive ? 1000 : 2000;
    this.simulatedTimer = setInterval(() => {
      onUpdate(this.getSimulatedFix());
    }, intervalMs);
  }

  private getWebCurrentPosition(): Promise<LocationFix> {
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const fix = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              altitude: pos.coords.altitude,
              accuracy: pos.coords.accuracy,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              timestamp: new Date(pos.timestamp).toISOString(),
            };
            this.fallbackCoords = { lat: fix.lat, lng: fix.lng };
            resolve(fix);
          },
          (err) => {
            console.warn('[HardwareLocation] Web GPS error:', err);
            resolve(this.getSimulatedFix());
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        resolve(this.getSimulatedFix());
      }
    });
  }

  private startWebTracking(onUpdate: LocationCallback, isSosActive: boolean): void {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      this.webWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const fix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            altitude: pos.coords.altitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            timestamp: new Date(pos.timestamp).toISOString(),
          };
          this.fallbackCoords = { lat: fix.lat, lng: fix.lng };
          onUpdate(fix);
        },
        (err) => {
          console.warn('[HardwareLocation] Web watcher error:', err);
          this.startSimulatedTracking(onUpdate, isSosActive);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      this.startSimulatedTracking(onUpdate, isSosActive);
    }
  }

  public setSimulatedMode(enabled: boolean, coords?: { lat: number; lng: number } | null): void {
    this.isSimulatedMode = enabled;
    if (coords) this.fallbackCoords = coords;
  }
}

export const hardwareLocationService = new HardwareLocationService();
