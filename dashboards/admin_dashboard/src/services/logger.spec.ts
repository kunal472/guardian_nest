import { describe, it, expect, vi } from 'vitest';
import { logger } from './logger';

describe('Admin logger service', () => {
  it('should format and forward logs to console', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    logger.socket('socket message');

    expect(errSpy).toHaveBeenCalledWith('❌ [ADMIN-ERROR]', 'error message');
  });
});
