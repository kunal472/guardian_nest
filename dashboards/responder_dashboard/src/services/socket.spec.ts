import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as socketIo from 'socket.io-client';
import { getSocket } from './socket';

vi.mock('socket.io-client', () => {
  const handlers: Record<string, Function> = {};
  const mockSocket = {
    id: 'mock-socket-id',
    on: vi.fn((event: string, callback: Function) => {
      handlers[event] = callback;
    }),
    emit: vi.fn(),
    off: vi.fn(),
    __trigger: (event: string, ...args: any[]) => {
      if (handlers[event]) handlers[event](...args);
    },
  };
  return {
    io: vi.fn(() => mockSocket),
  };
});

describe('socket service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates socket instance and connects event listeners', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const socket = getSocket('mock-jwt');
    expect(socket).toBeDefined();

    // Trigger connect event
    (socket as any).__trigger('connect');
    expect(logSpy).toHaveBeenCalledWith(
      '✅ Responder Dashboard connected to Guardian Event Bus:',
      'mock-socket-id',
    );

    // Trigger disconnect event
    (socket as any).__trigger('disconnect');
    expect(logSpy).toHaveBeenCalledWith(
      '⚠️ Responder Dashboard disconnected from Event Bus',
    );

    // Singleton check: calling getSocket again returns existing socket
    const socket2 = getSocket('mock-jwt-2');
    expect(socket2).toBe(socket);
  });
});
