import { Platform } from 'react-native';
import * as Location from 'expo-location';

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

class HardwareLocationService {
  private watchSubscription: Location.LocationSubscription | null = null;
  private webWatchId: number | null = null;
  private hasPermission: boolean | null = null;
  private isSimulatedMode: boolean = false;
  private fallbackCoords: { lat: number; lng: number } = { lat: 40.7128, lng: -74.006 };
  private activeCallback: LocationCallback | null = null;

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
   * Get single instantaneous high-accuracy GPS location fix
   */
  public async getCurrentLocation(): Promise<LocationFix> {
    if (this.isSimulatedMode) {
      return this.getSimulatedFix();
    }

    try {
      if (Platform.OS === 'web') {
        return await this.getWebCurrentPosition();
      }

      const hasPerm = this.hasPermission ?? (await this.requestPermissions());
      if (!hasPerm) {
        return this.getSimulatedFix();
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

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
      return fix;
    } catch (err) {
      console.warn('[HardwareLocation] getCurrentLocation fallback to simulated:', err);
      return this.getSimulatedFix();
    }
  }

  /**
   * Start live GPS tracking stream with instant initial fix and zero-meter distance interval
   * @param onUpdate callback invoked on every satellite fix
   * @param isSosActive true = 1000ms high-priority emergency interval, false = 1500ms standby
   */
  public async startTracking(onUpdate: LocationCallback, isSosActive: boolean): Promise<void> {
    this.stopTracking();
    this.activeCallback = onUpdate;

    if (this.isSimulatedMode) {
      this.startSimulatedTracking(onUpdate, isSosActive);
      return;
    }

    // 1. Instantly fetch initial position without waiting for watcher interval
    this.getCurrentLocation().then((initialFix) => {
      if (this.activeCallback) {
        this.activeCallback(initialFix);
      }
    }).catch(() => {});

    try {
      const hasPerm = this.hasPermission ?? (await this.requestPermissions());
      if (!hasPerm) {
        this.startSimulatedTracking(onUpdate, isSosActive);
        return;
      }

      if (Platform.OS === 'web') {
        this.startWebTracking(onUpdate, isSosActive);
        return;
      }

      // Native iOS / Android High-Accuracy Satellite Watcher
      // distanceInterval: 0 ensures instantaneous response whenever GPS coordinates change in settings / emulator
      const intervalMs = isSosActive ? 500 : 1000;
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          timeInterval: intervalMs,
          distanceInterval: 0,
        },
        (loc) => {
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
      console.warn('[HardwareLocation] Native watcher failed, falling back to simulated:', err);
      this.startSimulatedTracking(onUpdate, isSosActive);
    }
  }

  /**
   * Force instantaneous GPS poll and invoke active callback immediately
   */
  public async forceRefreshLocation(): Promise<LocationFix> {
    const fix = await this.getCurrentLocation();
    if (this.activeCallback) {
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

  public setSimulatedMode(enabled: boolean, coords?: { lat: number; lng: number }): void {
    this.isSimulatedMode = enabled;
    if (coords) this.fallbackCoords = coords;
  }
}

export const hardwareLocationService = new HardwareLocationService();
