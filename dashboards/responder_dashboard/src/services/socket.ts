import { io, Socket } from 'socket.io-client';

export function getSocketBaseUrl(): string {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost'
  ) {
    return `http://${window.location.hostname}:3000`;
  }
  return 'http://localhost:3000';
}

let socket: Socket | null = null;

export function getSocket(token?: string): Socket {
  const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('guardian_responder_token') || '' : '');
  const socketUrl = getSocketBaseUrl();

  if (!socket) {
    socket = io(socketUrl, {
      auth: { token: activeToken },
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('✅ Responder Dashboard connected to Guardian Event Bus:', socket?.id);
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Responder Dashboard disconnected from Event Bus');
    });
  } else if (activeToken && socket.auth && (socket.auth as any).token !== activeToken) {
    (socket.auth as any).token = activeToken;
    if (!socket.connected) {
      socket.connect();
    }
  }
  return socket;
}
