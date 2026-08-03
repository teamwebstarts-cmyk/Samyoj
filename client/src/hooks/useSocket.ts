import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { logError } from '../utils/errors';
import { socketBaseUrl } from '../services/utils';

export type SocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SocketState {
  status: SocketConnectionStatus;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  totalDisconnects: number;
}

/**
 * Hook that manages a Socket.IO connection with reconnection, status tracking,
 * and structured error logging.
 *
 * Returns:
 *  - socketRef: mutable ref to the Socket instance
 *  - state: live connection state (status, reconnect count, etc.)
 *  - onMessage: stable callback for listening to events (avoids re-registering
 *    handlers when the parent component re-renders)
 */
export function useSocket(onEvent?: (event: string, data: unknown) => void) {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [state, setState] = useState<SocketState>({
    status: 'disconnected',
    lastConnectedAt: null,
    reconnectAttempts: 0,
    totalDisconnects: 0,
  });

  const onMessage = useCallback((event: string, data: unknown) => {
    onEventRef.current?.(event, data);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    setState((prev) => ({ ...prev, status: 'connecting' }));

    const socket = io(socketBaseUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.3,
    });

    socketRef.current = socket;

    let reconnectAttempts = 0;

    socket.on('connect', () => {
      console.info('[socket] Connected', { id: socket.id });
      reconnectAttempts = 0;
      setState((prev) => ({
        status: 'connected',
        lastConnectedAt: new Date(),
        reconnectAttempts: 0,
        totalDisconnects: prev.totalDisconnects,
      }));
    });

    socket.on('disconnect', (reason) => {
      console.warn('[socket] Disconnected', { reason });
      setState((prev) => ({
        status: 'disconnected',
        lastConnectedAt: prev.lastConnectedAt,
        reconnectAttempts,
        totalDisconnects: prev.totalDisconnects + 1,
      }));
    });

    socket.on('reconnect_attempt', () => {
      reconnectAttempts++;
      setState((prev) => ({
        ...prev,
        status: 'connecting',
        reconnectAttempts,
      }));
    });

    socket.on('reconnect', () => {
      console.info('[socket] Reconnected after %d attempts', reconnectAttempts);
      reconnectAttempts = 0;
      setState((prev) => ({
        status: 'connected',
        lastConnectedAt: new Date(),
        reconnectAttempts: 0,
        totalDisconnects: prev.totalDisconnects,
      }));
    });

    socket.on('reconnect_error', (err) => {
      logError(err, {
        source: 'socket',
        action: 'Reconnection error',
        attempts: reconnectAttempts,
      });
    });

    socket.on('reconnect_failed', () => {
      setState((prev) => ({
        ...prev,
        status: 'error',
        reconnectAttempts,
      }));
      logError(new Error('Socket reconnection failed after all attempts'), {
        source: 'socket',
        action: 'Reconnection failed',
        attempts: reconnectAttempts,
      });
    });

    socket.on('connect_error', (err) => {
      setState((prev) => ({ ...prev, status: 'error' }));
      logError(err, {
        source: 'socket',
        action: 'Connection failed',
      });
    });

    // Register real-time event handlers via the stable callback
    const events = [
      'message:new',
      'message:status',
      'call:incoming',
      'call:ring',
      'call:ring_timeout',
      'call:declined',
      'call:updated',
      'call:transcript',
      'conversation:handoff',
      'conversation:assigned',
      'conversation:bot',
      'conversation:read',
      'conversation:status',
      'conversation:snooze',
      'conversation:updated',
      'conversation:presence',
      'conversation:presence:left',
      'campaign:status',
      'campaign:progress',
      'alert:new',
      'template:status',
      'whatsapp:quality',
      'whatsapp:account-alert',
    ];

    for (const event of events) {
      socket.on(event, (data) => onMessage(event, data));
    }

    return () => {
      socketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [onMessage]);

  return { socketRef, state };
}