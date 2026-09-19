/**
 * DevLogger for Responder Dashboard
 * Conditionally logs in development mode only (import.meta.env.DEV).
 */

const isDev = import.meta.env?.DEV ?? (import.meta.env?.MODE !== 'production');

export const logger = {
  debug: (...args: any[]) => {
    if (isDev) console.log('🔍 [RESPONDER-DEBUG]', ...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.log('ℹ️ [RESPONDER-INFO]', ...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('⚠️ [RESPONDER-WARN]', ...args);
  },
  error: (...args: any[]) => {
    console.error('❌ [RESPONDER-ERROR]', ...args);
  },
  socket: (...args: any[]) => {
    if (isDev) console.log('🚨 [RESPONDER-SOCKET]', ...args);
  },
};

export default logger;
