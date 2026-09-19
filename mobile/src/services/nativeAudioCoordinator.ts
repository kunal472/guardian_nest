import {
  audioResourceCoordinator,
  AudioResourceCoordinator,
  MeteringPayload,
  SpotterState,
} from '../../modules/guardian-audio';

export type AudioCoordinatorState =
  | 'IDLE'
  | 'CONTINUOUS_SPOTTER'
  | 'CALIBRATING'
  | 'VAULT_RECORDING';

export interface NativeAudioMeteringEvent {
  dbfs: number; // dBFS level (-100.0 to 0.0)
  rms: number;  // Linear RMS amplitude
}

export type MeteringListener = (event: NativeAudioMeteringEvent) => void;

class NativeAudioCoordinatorWrapper {
  private coordinator: AudioResourceCoordinator = audioResourceCoordinator;
  private activeState: AudioCoordinatorState = 'IDLE';

  public subscribeMetering(listener: MeteringListener): () => void {
    return this.coordinator.subscribeMetering((payload: MeteringPayload) => {
      listener({ dbfs: payload.dbfs, rms: payload.rms });
    });
  }

  public async startContinuousSpotter(): Promise<boolean> {
    this.activeState = 'CONTINUOUS_SPOTTER';
    return await this.coordinator.startContinuousSpotter();
  }

  public async stopContinuousSpotter(): Promise<boolean> {
    this.activeState = 'IDLE';
    return await this.coordinator.stopContinuousSpotter();
  }

  public async pauseForPreemption(
    targetState: 'CALIBRATING' | 'VAULT_RECORDING',
    cooldownMs: number = 200
  ): Promise<boolean> {
    this.activeState = targetState;
    return await this.coordinator.pauseForHardwarePreemption(cooldownMs);
  }

  public async resumeAfterPreemption(cooldownMs: number = 150): Promise<boolean> {
    this.activeState = 'CONTINUOUS_SPOTTER';
    return await this.coordinator.resumeAfterHardwarePreemption(cooldownMs);
  }

  public getState(): AudioCoordinatorState {
    return this.activeState;
  }
}

export const nativeAudioCoordinator = new NativeAudioCoordinatorWrapper();
export { audioResourceCoordinator };
