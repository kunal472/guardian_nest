import { Platform } from 'react-native';
import * as Battery from 'expo-battery';

export type BatteryStateEnum = 'UNPLUGGED' | 'CHARGING' | 'FULL' | 'UNKNOWN';

export interface BatteryInfo {
  level: number; // 0 to 100
  state: BatteryStateEnum;
  isLowPowerMode: boolean;
  isCritical: boolean; // level <= 5%
}

export type BatteryCallback = (info: BatteryInfo) => void;

class HardwareBatteryService {
  private levelSubscription: Battery.Subscription | null = null;
  private stateSubscription: Battery.Subscription | null = null;
  private powerModeSubscription: Battery.Subscription | null = null;
  private simulatedLevel: number | null = null;
  private simulatedState: BatteryStateEnum = 'UNPLUGGED';
  private simulatedLowPower: boolean = false;

  private currentInfo: BatteryInfo = {
    level: 85,
    state: 'UNPLUGGED',
    isLowPowerMode: false,
    isCritical: false,
  };

  /**
   * Fetch snapshot of current hardware battery metrics
   */
  public async getBatterySnapshot(): Promise<BatteryInfo> {
    if (this.simulatedLevel !== null) {
      return {
        level: this.simulatedLevel,
        state: this.simulatedState,
        isLowPowerMode: this.simulatedLowPower,
        isCritical: this.simulatedLevel <= 5,
      };
    }

    try {
      if (Platform.OS === 'web') {
        return await this.getWebBatterySnapshot();
      }

      const rawLevel = await Battery.getBatteryLevelAsync();
      const batteryLevel = rawLevel >= 0 ? Math.round(rawLevel * 100) : 85;
      const rawState = await Battery.getBatteryStateAsync();
      const isLowPower = await Battery.isLowPowerModeEnabledAsync();

      let state: BatteryStateEnum = 'UNPLUGGED';
      if (rawState === Battery.BatteryState.CHARGING) state = 'CHARGING';
      else if (rawState === Battery.BatteryState.FULL) state = 'FULL';
      else if (rawState === Battery.BatteryState.UNPLUGGED) state = 'UNPLUGGED';

      this.currentInfo = {
        level: batteryLevel,
        state,
        isLowPowerMode: isLowPower,
        isCritical: batteryLevel <= 5,
      };

      return this.currentInfo;
    } catch (err) {
      console.warn('[HardwareBattery] getBatterySnapshot error, fallback:', err);
      return this.currentInfo;
    }
  }

  /**
   * Start listening to native OS battery changes
   */
  public async startListening(callback: BatteryCallback): Promise<void> {
    this.stopListening();

    // Initial snapshot
    const initial = await this.getBatterySnapshot();
    callback(initial);

    if (this.simulatedLevel !== null) return;

    if (Platform.OS === 'web') {
      this.startWebListening(callback);
      return;
    }

    try {
      this.levelSubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
        const level = batteryLevel >= 0 ? Math.round(batteryLevel * 100) : this.currentInfo.level;
        this.currentInfo = {
          ...this.currentInfo,
          level,
          isCritical: level <= 5,
        };
        callback(this.currentInfo);
      });

      this.stateSubscription = Battery.addBatteryStateListener(({ batteryState }) => {
        let state: BatteryStateEnum = 'UNPLUGGED';
        if (batteryState === Battery.BatteryState.CHARGING) state = 'CHARGING';
        else if (batteryState === Battery.BatteryState.FULL) state = 'FULL';

        this.currentInfo = {
          ...this.currentInfo,
          state,
        };
        callback(this.currentInfo);
      });

      this.powerModeSubscription = Battery.addLowPowerModeListener(({ lowPowerMode }) => {
        this.currentInfo = {
          ...this.currentInfo,
          isLowPowerMode: lowPowerMode,
        };
        callback(this.currentInfo);
      });
    } catch (err) {
      console.warn('[HardwareBattery] Add native listeners failed:', err);
    }
  }

  /**
   * Stop active battery listeners
   */
  public stopListening(): void {
    if (this.levelSubscription) {
      this.levelSubscription.remove();
      this.levelSubscription = null;
    }
    if (this.stateSubscription) {
      this.stateSubscription.remove();
      this.stateSubscription = null;
    }
    if (this.powerModeSubscription) {
      this.powerModeSubscription.remove();
      this.powerModeSubscription = null;
    }
  }

  /**
   * Set simulated battery level for developer QA / testing pre-shutdown Last Gasp
   */
  public setSimulatedLevel(level: number | null, onUpdate?: BatteryCallback): void {
    this.simulatedLevel = level;
    if (level !== null) {
      this.currentInfo = {
        level,
        state: this.simulatedState,
        isLowPowerMode: level <= 15,
        isCritical: level <= 5,
      };
    }
    if (onUpdate) {
      onUpdate(this.currentInfo);
    }
  }

  // --- Web Battery API Fallback ---
  private async getWebBatterySnapshot(): Promise<BatteryInfo> {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const nav = navigator as any;
        const b = await nav.getBattery();
        const level = Math.round(b.level * 100);
        return {
          level,
          state: b.charging ? 'CHARGING' : 'UNPLUGGED',
          isLowPowerMode: level <= 20,
          isCritical: level <= 5,
        };
      } catch {
        return this.currentInfo;
      }
    }
    return this.currentInfo;
  }

  private startWebListening(callback: BatteryCallback): void {
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      const nav = navigator as any;
      nav.getBattery().then((b: any) => {
        const update = () => {
          const level = Math.round(b.level * 100);
          this.currentInfo = {
            level,
            state: b.charging ? 'CHARGING' : 'UNPLUGGED',
            isLowPowerMode: level <= 20,
            isCritical: level <= 5,
          };
          callback(this.currentInfo);
        };
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      }).catch(() => {});
    }
  }
}

export const hardwareBatteryService = new HardwareBatteryService();
