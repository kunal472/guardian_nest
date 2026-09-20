import { hardwareSnatchService, MotionTelemetry } from '../../src/services/hardwareSnatchService';
import { Accelerometer } from 'expo-sensors';

describe('HardwareSnatchService Unit Tests', () => {
  beforeEach(() => {
    hardwareSnatchService.stopListening();
    hardwareSnatchService.setSensitivity('MEDIUM');
    (hardwareSnatchService as any).lastTriggerTime = 0;
    jest.clearAllMocks();
  });

  it('should initialize with default MEDIUM sensitivity and threshold of 3.2G', () => {
    expect(hardwareSnatchService.getSensitivity()).toBe('MEDIUM');
    expect(hardwareSnatchService.getActiveThreshold()).toBe(3.2);
  });

  it('should correctly update active threshold when sensitivity is changed', () => {
    hardwareSnatchService.setSensitivity('LOW');
    expect(hardwareSnatchService.getSensitivity()).toBe('LOW');
    expect(hardwareSnatchService.getActiveThreshold()).toBe(4.2);

    hardwareSnatchService.setSensitivity('HIGH');
    expect(hardwareSnatchService.getSensitivity()).toBe('HIGH');
    expect(hardwareSnatchService.getActiveThreshold()).toBe(2.2);
  });

  it('should support dynamic remote threshold overrides', () => {
    hardwareSnatchService.setCustomThresholdG(5.0);
    expect(hardwareSnatchService.getActiveThreshold()).toBe(5.0);
  });

  it('should register accelerometer listener at 20Hz (50ms) update interval', async () => {
    const onSnatch = jest.fn();
    const onTelemetry = jest.fn();

    const started = await hardwareSnatchService.startListening(onSnatch, onTelemetry);
    expect(started).toBe(true);
    expect(Accelerometer.setUpdateInterval).toHaveBeenCalledWith(50);
    expect(Accelerometer.addListener).toHaveBeenCalled();
  });

  it('should compute motion telemetry accurately and deliver callbacks', async () => {
    let capturedTelemetry: MotionTelemetry | null = null;
    await hardwareSnatchService.startListening(
      jest.fn(),
      (data) => {
        capturedTelemetry = data;
      }
    );

    // Baseline rest: 0, 0, 1.0 (Earth gravity)
    (Accelerometer as any)._emit(0, 0, 1.0);

    expect(capturedTelemetry).toBeDefined();
    expect(capturedTelemetry!.magnitude).toBe(1.0);
    expect(capturedTelemetry!.deltaG).toBe(0);
    expect(capturedTelemetry!.isSpike).toBe(false);
  });

  it('should trigger snatch callback when acceleration exceeds the threshold', async () => {
    const onSnatch = jest.fn();
    await hardwareSnatchService.startListening(onSnatch);

    // Emit severe jerk spike: x=2.5, y=2.5, z=1.0 -> magnitude = sqrt(2.5^2 + 2.5^2 + 1) = 3.67G > 3.2G
    (Accelerometer as any)._emit(2.5, 2.5, 1.0);

    expect(onSnatch).toHaveBeenCalledTimes(1);
  });

  it('should enforce a 3-second cooldown between consecutive snatch triggers', async () => {
    const onSnatch = jest.fn();
    await hardwareSnatchService.startListening(onSnatch);

    // Spike 1
    (Accelerometer as any)._emit(2.5, 2.5, 1.0);
    expect(onSnatch).toHaveBeenCalledTimes(1);

    // Immediate second spike within cooldown window
    (Accelerometer as any)._emit(3.0, 3.0, 1.0);
    expect(onSnatch).toHaveBeenCalledTimes(1); // Debounced
  });

  it('should clean up accelerometer listeners upon stopListening()', async () => {
    const onSnatch = jest.fn();
    await hardwareSnatchService.startListening(onSnatch);

    hardwareSnatchService.stopListening();

    (Accelerometer as any)._emit(4.0, 4.0, 1.0);
    expect(onSnatch).not.toHaveBeenCalled();
  });
});
