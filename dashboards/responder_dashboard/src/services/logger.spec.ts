import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from './logger';

describe('logger service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs debug messages', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('test debug', { data: 123 });
    expect(logSpy).toHaveBeenCalledWith('🔍 [RESPONDER-DEBUG]', 'test debug', { data: 123 });
  });

  it('logs info messages', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test info');
    expect(logSpy).toHaveBeenCalledWith('ℹ️ [RESPONDER-INFO]', 'test info');
  });

  it('logs warn messages', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('test warn');
    expect(warnSpy).toHaveBeenCalledWith('⚠️ [RESPONDER-WARN]', 'test warn');
  });

  it('logs error messages', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test error');
    expect(errorSpy).toHaveBeenCalledWith('❌ [RESPONDER-ERROR]', 'test error');
  });

  it('logs socket messages', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.socket('test socket');
    expect(logSpy).toHaveBeenCalledWith('🚨 [RESPONDER-SOCKET]', 'test socket');
  });
});
