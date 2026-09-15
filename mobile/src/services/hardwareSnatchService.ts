import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export type SnatchSensitivity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface MotionTelemetry {
  x: number;
  y: number;
  z: number;
  magnitude: number; // in Gs (1.0 = baseline Earth gravity)
  deltaG: number;     // absolute spike above baseline
  isSpike: boolean;
  sensitivity: SnatchSensitivity;
}

export type SnatchCallback = () => void;
export type TelemetryCallback = (data: MotionTelemetry) => void;

class HardwareSnatchService {
  private subscription: any = null;
  private isListening: boolean = false;
  private sensitivity: SnatchSensitivity = 'MEDIUM';
  private lastTriggerTime: number = 0;
  private recentMagnitudes: number[] = [];

  private onSnatch: SnatchCallback | null = null;
  private onTelemetry: TelemetryCallback | null = null;

  // Thresholds in G-forces (where 1.0G = normal rest)
  private readonly THRESHOLDS: Record<SnatchSensitivity, number> = {
    LOW: 4.2,    // High threshold: requires severe violent yank
    MEDIUM: 3.2, // Standard threshold: typical hand-snatch acceleration
    HIGH: 2.2,   // Sensitive threshold: detects fast pocket pull or jog stumble
  };
  private customThresholdG: number | null = null;

  /**
   * Set motion sensitivity level
   */
  public setSensitivity(level: SnatchSensitivity): void {
    this.sensitivity = level;
    this.customThresholdG = null;
  }

  /**
   * Set dynamic G-force threshold from remote Event Bus sync
   */
  public setCustomThresholdG(gValue: number): void {
    if (gValue > 0) {
      this.customThresholdG = gValue;
    }
  }

  public getSensitivity(): SnatchSensitivity {
    return this.sensitivity;
  }

  public getActiveThreshold(): number {
    return this.customThresholdG ?? this.THRESHOLDS[this.sensitivity];
  }

  /**
   * Start real-time hardware accelerometer listener (20 Hz sampling)
   */
  public async startListening(
    onSnatchDetected: SnatchCallback,
    onTelemetryUpdate?: TelemetryCallback
  ): Promise<boolean> {
    this.stopListening();
    this.onSnatch = onSnatchDetected;
    this.onTelemetry = onTelemetryUpdate || null;
    this.isListening = true;
    this.recentMagnitudes = [];

    if (Platform.OS === 'web') {
      this.startWebMotionListening();
      return true;
    }

    try {
      const isAvailable = await Accelerometer.isAvailableAsync();
      if (!isAvailable) {
        console.warn('[HardwareSnatch] Accelerometer sensor not available on this device');
        return false;
      }

      Accelerometer.setUpdateInterval(50); // 50ms = 20 Hz sampling rate

      this.subscription = Accelerometer.addListener(({ x, y, z }) => {
        this.processSensorFrame(x, y, z);
      });

      return true;
    } catch (err) {
      console.warn('[HardwareSnatch] Accelerometer listener initialization error:', err);
      return false;
    }
  }

  /**
   * Process raw 3-axis accelerometer values into G-force magnitude and detect jerk spikes
   */
  private processSensorFrame(x: number, y: number, z: number): void {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const deltaG = Math.abs(magnitude - 1.0);
    const threshold = this.getActiveThreshold();
    const isSpike = magnitude >= threshold;

    this.recentMagnitudes.push(magnitude);
    if (this.recentMagnitudes.length > 10) {
      this.recentMagnitudes.shift();
    }

    if (this.onTelemetry) {
      this.onTelemetry({
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        z: Math.round(z * 100) / 100,
        magnitude: Math.round(magnitude * 100) / 100,
        deltaG: Math.round(deltaG * 100) / 100,
        isSpike,
        sensitivity: this.sensitivity,
      });
    }

    // Snatch Spike Trigger with 3-second cooldown
    const now = Date.now();
    if (isSpike && now - this.lastTriggerTime > 3000) {
      this.lastTriggerTime = now;
      console.warn(`🚨 [SNATCH DETECTED] Acceleration spike: ${magnitude.toFixed(2)}G (Threshold: ${threshold}G)`);
      if (this.onSnatch) {
        this.onSnatch();
      }
    }
  }

  /**
   * Stop accelerometer subscription
   */
  public stopListening(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.handleWebMotion);
    }
    this.isListening = false;
  }

  /**
   * Manually simulate a snatch acceleration jerk for testing / QA
   */
  public simulateSnatchJerk(): void {
    const simulatedG = this.THRESHOLDS[this.sensitivity] + 0.8;
    this.processSensorFrame(simulatedG * 0.6, simulatedG * 0.7, simulatedG * 0.4);
  }

  // --- Web DeviceMotionEvent fallback ---
  private handleWebMotion = (event: DeviceMotionEvent) => {
    if (event.accelerationIncludingGravity) {
      const { x, y, z } = event.accelerationIncludingGravity;
      const normX = (x || 0) / 9.81;
      const normY = (y || 0) / 9.81;
      const normZ = (z || 9.81) / 9.81;
      this.processSensorFrame(normX, normY, normZ);
    }
  };

  private startWebMotionListening(): void {
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', this.handleWebMotion);
    }
  }
}

export const hardwareSnatchService = new HardwareSnatchService();
