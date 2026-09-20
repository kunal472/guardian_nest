import { AudioRingBuffer } from '../../src/services/audioRingBuffer';

describe('AudioRingBuffer Unit Tests', () => {
  let ringBuffer: AudioRingBuffer;
  const sampleRate = 16000;
  const maxSeconds = 5;

  beforeEach(() => {
    ringBuffer = new AudioRingBuffer(sampleRate, maxSeconds);
  });

  it('should initialize with correct capacity and empty state', () => {
    expect(ringBuffer.getBufferedSeconds()).toBe(0);
    expect(ringBuffer.getFillPercentage()).toBe(0);
  });

  it('should accurately store and track samples pushed into the circular buffer', () => {
    const frame = new Float32Array(16000); // 1 second of audio
    frame.fill(0.5);

    ringBuffer.push(frame);

    expect(ringBuffer.getBufferedSeconds()).toBe(1.0);
    expect(ringBuffer.getFillPercentage()).toBe(20); // 1s out of 5s = 20%
  });

  it('should cap buffer duration and fill percentage at 100% when capacity is exceeded', () => {
    // Push 6 seconds of audio into a 5-second buffer (96,000 samples)
    const frame = new Float32Array(16000 * 6);
    frame.fill(0.8);

    ringBuffer.push(frame);

    expect(ringBuffer.getBufferedSeconds()).toBe(5.0);
    expect(ringBuffer.getFillPercentage()).toBe(100);
  });

  it('should retrieve the most recent contiguous window of audio in chronological order', () => {
    const frame1 = new Float32Array([1.0, 2.0, 3.0]);
    const frame2 = new Float32Array([4.0, 5.0, 6.0]);

    const smallBuffer = new AudioRingBuffer(10, 1); // 10 samples capacity
    smallBuffer.push(frame1);
    smallBuffer.push(frame2);

    const recent = smallBuffer.getRecentWindow(0.6); // 6 samples
    expect(recent.length).toBe(6);
    expect(Array.from(recent)).toEqual([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
  });

  it('should correctly extract pre- and post-trigger contiguous window', () => {
    const frame = new Float32Array(16000 * 5); // 5 seconds
    for (let i = 0; i < frame.length; i++) {
      frame[i] = i / 1000;
    }
    ringBuffer.push(frame);

    const window = ringBuffer.getPreAndPostTriggerWindow(2, 2); // 4 seconds total = 64,000 samples
    expect(window.length).toBe(64000);
  });

  it('should reset state cleanly upon clear()', () => {
    const frame = new Float32Array(16000 * 2);
    ringBuffer.push(frame);
    expect(ringBuffer.getBufferedSeconds()).toBe(2.0);

    ringBuffer.clear();

    expect(ringBuffer.getBufferedSeconds()).toBe(0);
    expect(ringBuffer.getFillPercentage()).toBe(0);
    expect(ringBuffer.getRecentWindow(1).length).toBe(0);
  });
});
