/**
 * Audio Chime & Emergency Siren Synthesizer for Responder Dispatch
 * Uses Web Audio API to generate synthesized high-urgency tones without external audio assets.
 */
class AudioChimeService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Attempt to restore mute preference from storage
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedMute = localStorage.getItem('guardian_responder_muted');
      this.isMuted = storedMute === 'true';
    }
  }

  private initContext(): AudioContext | null {
    const AudioCtx =
      (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) ||
      (typeof globalThis !== 'undefined' && (globalThis as any).AudioContext);
    if (AudioCtx) {
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public resetContextForTesting(): void {
    this.ctx = null;
  }

  public setContextForTesting(ctx: any): void {
    this.ctx = ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('guardian_responder_muted', String(muted));
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Synthesizes a dual-tone Euro/dispatch emergency siren (960 Hz <-> 770 Hz)
   */
  public playEmergencyDispatchAlert(): void {
    if (this.isMuted) return;

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';

      // 4-cycle alternating frequency sweep
      const stepDuration = 0.15;
      const tones = [960, 770, 960, 770, 960, 770];
      
      tones.forEach((freq, index) => {
        osc.frequency.setValueAtTime(freq, now + index * stepDuration);
      });

      // Smooth attack and release envelope with safe guards
      const totalDuration = tones.length * stepDuration;
      if (gain.gain && typeof gain.gain.setValueAtTime === 'function') {
        gain.gain.setValueAtTime(0.01, now);
        if (typeof gain.gain.linearRampToValueAtTime === 'function') {
          gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
          gain.gain.setValueAtTime(0.25, now + totalDuration - 0.05);
        }
        if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);
        }
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + totalDuration);
    } catch (e) {
      // Audio playback blocked until user gesture or unsupported
      console.warn('[AudioChime] Playback blocked or failed:', e);
    }
  }

  /**
   * Synthesizes a subtle high-pitch notification ping (1200 Hz)
   */
  public playAcknowledgePing(): void {
    if (this.isMuted) return;

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') {
        osc.frequency.setValueAtTime(1200, now);
        if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
          osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
        }
      }

      if (gain.gain && typeof gain.gain.setValueAtTime === 'function') {
        gain.gain.setValueAtTime(0.15, now);
        if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        }
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      console.warn('[AudioChime] Ping failed:', e);
    }
  }
}

export const audioChime = new AudioChimeService();
