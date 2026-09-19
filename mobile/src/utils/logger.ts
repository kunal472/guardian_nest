/**
 * DevLogger - Zero-overhead, development-only logging utility for Guardian Mobile
 * Completely silences verbose debug & trace output in production builds to preserve performance.
 */

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

export const logger = {
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.log('[INFO]', ...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args: any[]) => {
    // Errors are always reported
    console.error('[ERROR]', ...args);
  },
  hardware: (...args: any[]) => {
    if (isDev) {
      console.log('⚡ [HARDWARE]', ...args);
    }
  },
  telemetry: (...args: any[]) => {
    if (isDev) {
      console.log('🛰️ [TELEMETRY]', ...args);
    }
  },
  biometrics: (...args: any[]) => {
    if (isDev) {
      console.log('🗣️ [BIOMETRICS]', ...args);
    }
  },
};

export default logger;
