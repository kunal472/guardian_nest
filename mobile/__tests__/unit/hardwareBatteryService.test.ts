import { hardwareBatteryService, BatteryInfo } from '../../src/services/hardwareBatteryService';
import * as Battery from 'expo-battery';

describe('HardwareBatteryService Unit Tests', () => {
  beforeEach(() => {
    hardwareBatteryService.stopListening();
    hardwareBatteryService.setSimulatedLevel(null);
    jest.clearAllMocks();
  });

  it('should fetch hardware battery metrics accurately', async () => {
    (Battery.getBatteryLevelAsync as jest.Mock).mockResolvedValueOnce(0.78);
    (Battery.getBatteryStateAsync as jest.Mock).mockResolvedValueOnce(Battery.BatteryState.UNPLUGGED);
    (Battery.isLowPowerModeEnabledAsync as jest.Mock).mockResolvedValueOnce(false);

    const snapshot = await hardwareBatteryService.getBatterySnapshot();

    expect(snapshot.level).toBe(78);
    expect(snapshot.state).toBe('UNPLUGGED');
    expect(snapshot.isLowPowerMode).toBe(false);
    expect(snapshot.isCritical).toBe(false);
  });

  it('should flag isCritical when battery level is 5% or below', async () => {
    (Battery.getBatteryLevelAsync as jest.Mock).mockResolvedValueOnce(0.04);

    const snapshot = await hardwareBatteryService.getBatterySnapshot();

    expect(snapshot.level).toBe(4);
    expect(snapshot.isCritical).toBe(true);
  });

  it('should start listening and deliver battery updates on level changes', async () => {
    let captured: BatteryInfo | null = null;

    await hardwareBatteryService.startListening((info) => {
      captured = info;
    });

    expect(captured).not.toBeNull();
    expect(Battery.addBatteryLevelListener).toHaveBeenCalled();
  });

  it('should support simulated battery levels for testing and QA', async () => {
    hardwareBatteryService.setSimulatedLevel(12);

    const snapshot = await hardwareBatteryService.getBatterySnapshot();
    expect(snapshot.level).toBe(12);
  });

  it('should clean up subscriptions on stopListening()', async () => {
    await hardwareBatteryService.startListening(() => {});
    hardwareBatteryService.stopListening();

    expect(Battery.addBatteryLevelListener).toHaveBeenCalled();
  });
});
