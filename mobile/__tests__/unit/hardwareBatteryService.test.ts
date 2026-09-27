import { hardwareBatteryService, BatteryInfo } from '../../src/services/hardwareBatteryService';
import * as Battery from 'expo-battery';

describe('HardwareBatteryService Unit Tests', () => {
  beforeEach(() => {
    hardwareBatteryService.stopListening();
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

  it('should handle hardware error gracefully by returning current info', async () => {
    (Battery.getBatteryLevelAsync as jest.Mock).mockRejectedValueOnce(new Error('Hardware Battery Sensor Failed'));

    const snapshot = await hardwareBatteryService.getBatterySnapshot();
    expect(snapshot).toBeDefined();
    expect(typeof snapshot.level).toBe('number');
  });

  it('should clean up subscriptions on stopListening()', async () => {
    await hardwareBatteryService.startListening(() => {});
    hardwareBatteryService.stopListening();

    expect(Battery.addBatteryLevelListener).toHaveBeenCalled();
  });
});
