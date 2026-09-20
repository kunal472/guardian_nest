import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { of, throwError, lastValueFrom } from 'rxjs';

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    interceptor = new HttpLoggingInterceptor();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should ignore non-http context and pass through', async () => {
    const mockContext: any = {
      getType: () => 'rpc',
    };
    const mockNext: any = {
      handle: () => of({ data: 'rpc-data' }),
    };

    const stream$ = interceptor.intercept(mockContext, mockNext);
    const result = await lastValueFrom(stream$);
    expect(result).toEqual({ data: 'rpc-data' });
  });

  it('should log http request on success in dev mode', async () => {
    const mockReq = { method: 'GET', url: '/api/incidents', ip: '127.0.0.1' };
    const mockRes = { statusCode: 200 };
    const mockContext: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    };
    const mockNext: any = {
      handle: () => of({ success: true }),
    };

    const stream$ = interceptor.intercept(mockContext, mockNext);
    const result = await lastValueFrom(stream$);
    expect(result).toEqual({ success: true });
  });

  it('should handle request with fallback statusCode and missing ip', async () => {
    const mockReq = { method: 'GET', url: '/api/incidents' };
    const mockRes = {};
    const mockContext: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    };
    const mockNext: any = {
      handle: () => of({ ok: true }),
    };

    const stream$ = interceptor.intercept(mockContext, mockNext);
    const result = await lastValueFrom(stream$);
    expect(result).toEqual({ ok: true });
  });

  it('should log http request on error and propagate error with fallback status', async () => {
    const mockReq = { method: 'POST', url: '/api/incidents', ip: '127.0.0.1' };
    const mockRes = { statusCode: 500 };
    const mockContext: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    };
    const testError: any = new Error('Database Error');
    const mockNext: any = {
      handle: () => throwError(() => testError),
    };

    const stream$ = interceptor.intercept(mockContext, mockNext);
    await expect(lastValueFrom(stream$)).rejects.toThrow('Database Error');
  });
});
