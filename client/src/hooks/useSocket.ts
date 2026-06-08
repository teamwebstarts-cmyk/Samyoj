import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { logError } from '../utils/errors';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function useSocket(onMessage?: (event: string, data: unknown) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      logError(err, { source: 'socket', action: 'Connection failed' });
    });

    socket.on('error', (err) => {
      logError(err, { source: 'socket', action: 'Socket error' });
    });

    if (onMessage) {
      socket.on('message:new', (data) => onMessage('message:new', data));
      socket.on('message:status', (data) => onMessage('message:status', data));
      socket.on('call:incoming', (data) => onMessage('call:incoming', data));
      socket.on('call:ring', (data) => onMessage('call:ring', data));
      socket.on('call:ring_timeout', (data) => onMessage('call:ring_timeout', data));
      socket.on('call:declined', (data) => onMessage('call:declined', data));
      socket.on('call:updated', (data) => onMessage('call:updated', data));
      socket.on('call:transcript', (data) => onMessage('call:transcript', data));
      socket.on('conversation:handoff', (data) => onMessage('conversation:handoff', data));
      socket.on('conversation:assigned', (data) => onMessage('conversation:assigned', data));
      socket.on('conversation:bot', (data) => onMessage('conversation:bot', data));
      socket.on('campaign:status', (data) => onMessage('campaign:status', data));
      socket.on('campaign:progress', (data) => onMessage('campaign:progress', data));
    }

    return () => {
      socket.disconnect();
    };
  }, [onMessage]);

  return socketRef;
}
