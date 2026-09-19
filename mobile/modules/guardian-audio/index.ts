import { requireNativeModule, type EventSubscription } from 'expo-modules-core';
import { Platform, PermissionsAndroid } from 'react-native';

export interface MeteringPayload {
  dbfs: number; // -100.0 to 0.0 dBFS
  rms: number;  // Linear RMS amplitude
}

export type SpotterState = 'IDLE' | 'LISTENING' | 'PREEMPTED';

export type MeteringListener = (payload: MeteringPayload) => void;
export type StateChangeListener = (state: SpotterState) => void;
export type ErrorListener = (error: string) => void;

let GuardianAudioModule: any = null;

try {
  GuardianAudioModule = requireNativeModule('GuardianAudio');
} catch (e) {
  // Graceful fallback for web or mock environments
  console.warn('[GuardianAudio] Native module not loaded (running in web or mock environment)');
}

/**
 * Check if Android 14+ / iOS runtime audio & notification permissions are granted
 */
export async function checkAudioPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  if (Platform.OS === 'android') {
    try {
      const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      let notifGranted = true;
      if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
        if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
          notifGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
      }
      return {
        granted: micGranted && notifGranted,
        canAskAgain: true,
      };
    } catch (e) {
      console.warn('[GuardianAudio] checkAudioPermissionsAsync error:', e);
      return { granted: false, canAskAgain: true };
    }
  }

  return { granted: true, canAskAgain: true };
}

/**
 * Request runtime audio & notification permissions on Android / iOS
 */
export async function requestAudioPermissionsAsync(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const permissionsToRequest = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (
        typeof Platform.Version === 'number' &&
        Platform.Version >= 33 &&
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      ) {
        permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);
      const micGranted =
        results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      return micGranted;
    } catch (e) {
      console.warn('[GuardianAudio] requestAudioPermissionsAsync error:', e);
      return false;
    }
  }

  return true;
}

export class AudioResourceCoordinator {
  private static instance: AudioResourceCoordinator | null = null;
  private isSpotterRunningState: boolean = false;
  private activeListeners: Set<MeteringListener> = new Set();
  private stateListeners: Set<StateChangeListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private meteringSub: EventSubscription | null = null;
  private stateSub: EventSubscription | null = null;
  private errorSub: EventSubscription | null = null;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): AudioResourceCoordinator {
    if (!AudioResourceCoordinator.instance) {
      AudioResourceCoordinator.instance = new AudioResourceCoordinator();
    }
    return AudioResourceCoordinator.instance;
  }

  private setupListeners(): void {
    if (!GuardianAudioModule || typeof GuardianAudioModule.addListener !== 'function') return;

    try {
      this.meteringSub = GuardianAudioModule.addListener(
        'onMeteringUpdate',
        (payload: MeteringPayload) => {
          this.activeListeners.forEach((l) => l(payload));
        }
      );

      this.stateSub = GuardianAudioModule.addListener(
        'onStateChange',
        (event: { state: SpotterState }) => {
          if (event && event.state) {
            this.stateListeners.forEach((l) => l(event.state));
          }
        }
      );

      this.errorSub = GuardianAudioModule.addListener(
        'onError',
        (event: { error: string }) => {
          if (event && event.error) {
            this.errorListeners.forEach((l) => l(event.error));
          }
        }
      );
    } catch (err: any) {
      console.warn('[GuardianAudio] Listener setup error:', err?.message);
    }
  }

  public subscribeMetering(listener: MeteringListener): () => void {
    this.activeListeners.add(listener);
    return () => this.activeListeners.delete(listener);
  }

  public subscribeStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Start native always-on acoustic spotter on Android with runtime permission verification
   */
  public async startContinuousSpotter(): Promise<boolean> {
    if (this.isSpotterRunningState) return true;

    if (Platform.OS === 'android') {
      // 1. Android 14+ Runtime Security Guard: Verify RECORD_AUDIO permission
      const permCheck = await checkAudioPermissionsAsync();
      if (!permCheck.granted) {
        console.log('[GuardianAudio] RECORD_AUDIO permission missing. Requesting runtime permission...');
        const granted = await requestAudioPermissionsAsync();
        if (!granted) {
          const errMsg = 'PERMISSION_DENIED: RECORD_AUDIO not granted';
          console.warn(`[GuardianAudio] ${errMsg}`);
          this.errorListeners.forEach((l) => l(errMsg));
          return false;
        }
      }

      if (GuardianAudioModule) {
        try {
          const success = await GuardianAudioModule.startContinuousSpotter();
          if (success) {
            this.isSpotterRunningState = true;
            console.log('[GuardianAudio] 🎙️ Always-on native AudioRecord spotter started.');
          }
          return success;
        } catch (err: any) {
          const errMsg = `START_FAILED: ${err?.message || 'Unknown error'}`;
          console.warn('[GuardianAudio] startContinuousSpotter error:', errMsg);
          this.errorListeners.forEach((l) => l(errMsg));
          return false;
        }
      } else {
        console.warn('[GuardianAudio] GuardianAudioModule native binding unavailable.');
        return false;
      }
    } else {
      this.isSpotterRunningState = true;
      return true;
    }
  }

  /**
   * Stop native always-on acoustic spotter
   */
  public async stopContinuousSpotter(): Promise<boolean> {
    if (!this.isSpotterRunningState) return true;

    if (Platform.OS === 'android' && GuardianAudioModule) {
      try {
        const success = await GuardianAudioModule.stopContinuousSpotter();
        this.isSpotterRunningState = false;
        console.log('[GuardianAudio] ⏹️ Always-on native AudioRecord spotter stopped.');
        return success;
      } catch (err: any) {
        console.warn('[GuardianAudio] stopContinuousSpotter error:', err?.message);
        return false;
      }
    } else {
      this.isSpotterRunningState = false;
      return true;
    }
  }

  /**
   * Explicitly pause spotter with HAL cooldown to release hardware microphone
   * @param cooldownMs Delay in ms (default 200ms) for Android Audio HAL
   */
  public async pauseForHardwarePreemption(cooldownMs: number = 200): Promise<boolean> {
    if (Platform.OS === 'android' && GuardianAudioModule) {
      try {
        const success = await GuardianAudioModule.pauseForHardwarePreemption(cooldownMs);
        console.log(`[GuardianAudio] ⏸️ Mic released for preemption (${cooldownMs}ms HAL cooldown).`);
        return success;
      } catch (err: any) {
        console.warn('[GuardianAudio] pauseForHardwarePreemption note:', err?.message);
        return false;
      }
    }
    return true;
  }

  /**
   * Safely resume continuous spotter after file-based recording finishes
   * @param cooldownMs Delay in ms (default 150ms) to ensure file descriptors are closed
   */
  public async resumeAfterHardwarePreemption(cooldownMs: number = 150): Promise<boolean> {
    if (Platform.OS === 'android' && GuardianAudioModule) {
      try {
        const success = await GuardianAudioModule.resumeAfterHardwarePreemption(cooldownMs);
        console.log(`[GuardianAudio] ▶️ Mic spotter resumed after preemption (${cooldownMs}ms HAL cooldown).`);
        return success;
      } catch (err: any) {
        console.warn('[GuardianAudio] resumeAfterHardwarePreemption note:', err?.message);
        return false;
      }
    }
    return true;
  }

  public isSpotterActive(): boolean {
    if (Platform.OS === 'android' && GuardianAudioModule) {
      try {
        return GuardianAudioModule.isSpotterActive();
      } catch {
        return this.isSpotterRunningState;
      }
    }
    return this.isSpotterRunningState;
  }
}

export const audioResourceCoordinator = AudioResourceCoordinator.getInstance();

export default {
  AudioResourceCoordinator,
  audioResourceCoordinator,
};
