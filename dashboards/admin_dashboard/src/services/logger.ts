/**
 * DevLogger for Admin Dashboard
 * Conditionally logs in development mode only (import.meta.env.DEV).
 */

const isDev = import.meta.env?.DEV ?? (import.meta.env?.MODE !== 'production');

export const logger = {
  debug: (...args: any[]) => {
    if (isDev) console.log('🔍 [ADMIN-DEBUG]', ...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.log('ℹ️ [ADMIN-INFO]', ...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn('⚠️ [ADMIN-WARN]', ...args);
  },
  error: (...args: any[]) => {
    console.error('❌ [ADMIN-ERROR]', ...args);
  },
  socket: (...args: any[]) => {
    if (isDev) console.log('🔌 [ADMIN-SOCKET]', ...args);
  },
};

export default logger;
