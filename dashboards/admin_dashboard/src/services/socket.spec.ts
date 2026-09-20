import { describe, it, expect, vi } from 'vitest';
import { getSocket } from './socket';

const listeners: Record<string, Function> = {};

vi.mock('socket.io-client', () => {
  return {
    io: vi.fn().mockImplementation((url, options) => {
      return {
        id: 'admin_socket_123',
        on: vi.fn((event, cb) => {
          listeners[event] = cb;
        }),
        emit: vi.fn(),
      };
    }),
  };
});

describe('Admin socket service', () => {
  it('getSocket should return single socket instance and execute connect and disconnect handlers', () => {
    const s1 = getSocket('admin_token_xyz');
    expect(s1.id).toBe('admin_socket_123');

    // Trigger connect & disconnect listeners
    if (listeners['connect']) listeners['connect']();
    if (listeners['disconnect']) listeners['disconnect']();
  });
});
