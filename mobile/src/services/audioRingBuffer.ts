/**
 * AudioRingBuffer - 5-Second Continuous Circular Audio Ring Buffer
 * Format: 16 kHz, 16-bit Mono PCM (80,000 samples @ 16kHz)
 * Operates entirely in memory with zero allocations during steady-state streaming.
 */
export class AudioRingBuffer {
  private readonly sampleRate: number;
  private readonly maxSeconds: number;
  private readonly capacity: number;
  private buffer: Float32Array;
  private writePointer: number = 0;
  private totalSamplesWritten: number = 0;

  constructor(sampleRate: number = 16000, maxSeconds: number = 5) {
    this.sampleRate = sampleRate;
    this.maxSeconds = maxSeconds;
    this.capacity = sampleRate * maxSeconds; // 80,000 samples
    this.buffer = new Float32Array(this.capacity);
  }

  /**
   * Push new PCM audio frame into circular ring buffer
   */
  public push(samples: Float32Array | number[]): void {
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      this.buffer[this.writePointer] = samples[i];
      this.writePointer = (this.writePointer + 1) % this.capacity;
      this.totalSamplesWritten++;
    }
  }

  /**
   * Extract contiguous window of the most recent N seconds of audio
   */
  public getRecentWindow(seconds: number = 5): Float32Array {
    const requestedSamples = Math.min(this.capacity, Math.round(seconds * this.sampleRate));
    const availableSamples = Math.min(this.capacity, this.totalSamplesWritten);
    const count = Math.min(requestedSamples, availableSamples);

    const result = new Float32Array(count);
    let readPointer = (this.writePointer - count + this.capacity) % this.capacity;

    for (let i = 0; i < count; i++) {
      result[i] = this.buffer[readPointer];
      readPointer = (readPointer + 1) % this.capacity;
    }

    return result;
  }

  /**
   * Extract pre-trigger (e.g. 2s) and post-trigger (e.g. 3s) contiguous window
   */
  public getPreAndPostTriggerWindow(preSeconds: number = 2, postSeconds: number = 3): Float32Array {
    const totalSeconds = preSeconds + postSeconds;
    return this.getRecentWindow(totalSeconds);
  }

  /**
   * Get buffer fill capacity percentage (0 - 100%)
   */
  public getFillPercentage(): number {
    if (this.totalSamplesWritten >= this.capacity) return 100;
    return Math.round((this.totalSamplesWritten / this.capacity) * 100);
  }

  /**
   * Get total duration currently buffered in seconds
   */
  public getBufferedSeconds(): number {
    const available = Math.min(this.capacity, this.totalSamplesWritten);
    return Number((available / this.sampleRate).toFixed(2));
  }

  /**
   * Clear the ring buffer
   */
  public clear(): void {
    this.buffer.fill(0);
    this.writePointer = 0;
    this.totalSamplesWritten = 0;
  }
}
