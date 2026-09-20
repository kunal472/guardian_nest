import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audioChime } from './audioChime';

describe('AudioChimeService Unit Tests', () => {
  let mockOscillator: any;
  let mockGain: any;
  let mockAudioCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockAudioCtx = {
      currentTime: 100,
      state: 'running',
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      destination: {},
      resume: vi.fn().mockResolvedValue(undefined),
    };

    audioChime.setContextForTesting(mockAudioCtx);
    audioChime.setMuted(false);
  });

  it('should toggle and persist mute state correctly', () => {
    audioChime.setMuted(true);
    expect(audioChime.getMuted()).toBe(true);

    audioChime.setMuted(false);
    expect(audioChime.getMuted()).toBe(false);
  });

  it('should synthesize emergency alert tones when not muted', () => {
    audioChime.setMuted(false);
    audioChime.playEmergencyDispatchAlert();

    expect(mockAudioCtx.createOscillator).toHaveBeenCalled();
    expect(mockAudioCtx.createGain).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
    expect(mockOscillator.stop).toHaveBeenCalled();
  });

  it('should suppress audio synthesis when muted', () => {
    audioChime.setMuted(true);
    audioChime.playEmergencyDispatchAlert();

    expect(mockAudioCtx.createOscillator).not.toHaveBeenCalled();
  });

  it('should synthesize acknowledge ping tone when not muted', () => {
    audioChime.setMuted(false);
    audioChime.playAcknowledgePing();

    expect(mockAudioCtx.createOscillator).toHaveBeenCalled();
    expect(mockOscillator.start).toHaveBeenCalled();
  });
});
