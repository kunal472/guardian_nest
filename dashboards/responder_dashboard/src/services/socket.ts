import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('✅ Responder Dashboard connected to Guardian Event Bus:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Responder Dashboard disconnected from Event Bus');
    });
  }
  return socket;
}
