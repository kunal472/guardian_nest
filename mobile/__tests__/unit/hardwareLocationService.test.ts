import {
  hardwareLocationService,
  computeHaversineMeters,
  LocationFix,
} from '../../src/services/hardwareLocationService';
import * as Location from 'expo-location';

describe('HardwareLocationService Unit Tests', () => {
  beforeEach(() => {
    hardwareLocationService.stopTracking();
    (hardwareLocationService as any).hasPermission = true;
    (hardwareLocationService as any).isSimulatedMode = false;
    (hardwareLocationService as any).fallbackCoords = null;
    jest.clearAllMocks();
  });

  describe('Haversine Distance Calculations', () => {
    it('should return 0 meters for identical coordinates', () => {
      const dist = computeHaversineMeters(40.7128, -74.006, 40.7128, -74.006);
      expect(dist).toBe(0);
    });

    it('should calculate accurate distance between two distinct GPS coordinates', () => {
      // Distance between NYC (40.7128, -74.0060) and Philadelphia (39.9526, -75.1652) is ~130 km
      const dist = computeHaversineMeters(40.7128, -74.006, 39.9526, -75.1652);
      expect(dist).toBeGreaterThan(128000);
      expect(dist).toBeLessThan(132000);
    });

    it('should return sentinel value 999999 for invalid 0,0 inputs', () => {
      expect(computeHaversineMeters(0, 0, 40.7128, -74.006)).toBe(999999);
      expect(computeHaversineMeters(40.7128, -74.006, 0, 0)).toBe(999999);
    });
  });

  describe('Permissions and Lifecycle', () => {
    it('should request and return true when foreground permissions are granted', async () => {
      (hardwareLocationService as any).hasPermission = null;
      const granted = await hardwareLocationService.requestPermissions();
      expect(granted).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false if permission request rejects or fails', async () => {
      (hardwareLocationService as any).hasPermission = null;
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
      });

      const granted = await hardwareLocationService.requestPermissions();
      expect(granted).toBe(false);
    });

    it('should check if location services are enabled', async () => {
      const enabled = await hardwareLocationService.ensureLocationServicesEnabled();
      expect(enabled).toBe(true);
      expect(Location.hasServicesEnabledAsync).toHaveBeenCalled();
    });
  });

  describe('Location Tracking and Fixes', () => {
    it('should start watch position and invoke callback with valid LocationFix', async () => {
      let receivedFix: LocationFix | null = null;

      await hardwareLocationService.startTracking((fix) => {
        receivedFix = fix;
      }, true);

      // Force location event
      (Location as any)._emitLocation(40.7135, -74.0055, 3.5, 2.1);

      expect(receivedFix).not.toBeNull();
      expect(receivedFix!.lat).toBeDefined();
    });

    it('should retrieve a high-accuracy current location fix on demand', async () => {
      const fix = await hardwareLocationService.getCurrentLocation();
      expect(fix).not.toBeNull();
      expect(fix!.lat).toBe(40.7128);
      expect(fix!.lng).toBe(-74.006);
    });

    it('should support simulated coordinates mode for testing and QA', async () => {
      hardwareLocationService.setSimulatedMode(true, { lat: 37.7749, lng: -122.4194 });

      await hardwareLocationService.startTracking(() => {}, false);

      const fix = await hardwareLocationService.getCurrentLocation();
      expect(fix).not.toBeNull();
      expect(fix!.lat).toBeDefined();
    });
  });
});
