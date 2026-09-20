import { twoTierDistressPipeline, PipelineTelemetry } from '../../src/services/twoTierDistressPipeline';

describe('TwoTierDistressPipeline Unit Tests', () => {
  beforeEach(() => {
    twoTierDistressPipeline.stopPipeline();
    twoTierDistressPipeline.resetTelemetry();
    jest.clearAllMocks();
  });

  afterEach(() => {
    twoTierDistressPipeline.stopPipeline();
  });

  it('should subscribe and emit initial telemetry state', () => {
    let capturedTelemetry: PipelineTelemetry | null = null;

    const unsubscribe = twoTierDistressPipeline.subscribe((telemetry) => {
      capturedTelemetry = telemetry;
    });

    expect(capturedTelemetry).toBeDefined();
    expect(capturedTelemetry!.tier1Status).toBeDefined();
    unsubscribe();
  });

  it('should start pipeline and set up emergency callback', async () => {
    const onEmergency = jest.fn();
    twoTierDistressPipeline.setEmergencyCallback(onEmergency);

    await twoTierDistressPipeline.startPipeline();

    // Verify thresholds
    const thresholds = twoTierDistressPipeline.getThresholds();
    expect(thresholds.yamnetThreshold).toBeGreaterThan(0);
    expect(thresholds.openWakeWordThreshold).toBeGreaterThan(0);
  });

  it('should allow dynamic tuning of acoustic thresholds', () => {
    twoTierDistressPipeline.setDynamicThresholds(0.85, 0.75);

    const thresholds = twoTierDistressPipeline.getThresholds();
    expect(thresholds.yamnetThreshold).toBe(0.85);
    expect(thresholds.openWakeWordThreshold).toBe(0.75);
  });

  it('should pause and resume native spotter for preemption', async () => {
    await twoTierDistressPipeline.startPipeline();

    await expect(twoTierDistressPipeline.pauseNativeSpotter('VAULT_RECORDING')).resolves.not.toThrow();
    await expect(twoTierDistressPipeline.resumeNativeSpotter()).resolves.not.toThrow();
  });

  it('should reset telemetry state cleanly', () => {
    twoTierDistressPipeline.resetTelemetry();

    let telemetry: PipelineTelemetry | null = null;
    twoTierDistressPipeline.subscribe((t) => {
      telemetry = t;
    });

    expect(telemetry!.yamnetConfidence).toBe(0);
    expect(telemetry!.targetClass).toBeNull();
    expect(telemetry!.distressIntent).toBeNull();
  });
});
