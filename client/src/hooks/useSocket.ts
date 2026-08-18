import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { logError } from '../utils/errors';
import { socketBaseUrl } from '../services/utils';
import { ensureFreshAccessToken } from '../services/api';
import { clearAuthTokens, getAccessToken, getRefreshToken } from '../utils/authStorage';
import { getActiveWhatsappNumberId } from '../services/api';

export type SocketConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface SocketState {
  status: SocketConnectionStatus;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  totalDisconnects: number;
}

function isAuthConnectError(err: Error): boolean {
  const msg = err?.message || '';
  return (
    msg === 'Invalid token' ||
    msg === 'Authentication required' ||
    /jwt expired|jwt malformed|invalid token|unauthorized/i.test(msg)
  );
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
    // Need at least a refresh token — access JWT may already be expired (15m).
    if (!getAccessToken() && !getRefreshToken()) return;

    setState((prev) => ({ ...prev, status: 'connecting' }));

    let disposed = false;
    let authRefreshInFlight = false;
    let reconnectAttempts = 0;

    const socket = io(socketBaseUrl, {
      // Read the latest access token on every handshake/reconnect. A static
      // string captured at mount stays expired after the axios interceptor
      // refreshes localStorage — that killed Inbox realtime after ~15m.
      auth: (cb) => {
        cb({
          token: getAccessToken() || '',
          whatsappNumberId: getActiveWhatsappNumberId() || undefined,
        });
      },
      withCredentials: true,
      // Dev: polling first (Vite WS proxy is flaky). Prod: websocket first so
      // antivirus XHR wrappers do not wrap Engine.IO long-polls.
      transports: import.meta.env.DEV ? ['polling', 'websocket'] : ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.3,
    });

    socketRef.current = socket;

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

      if (!isAuthConnectError(err) || authRefreshInFlight || disposed) return;

      authRefreshInFlight = true;
      void ensureFreshAccessToken()
        .then((fresh) => {
          if (disposed || !fresh) return;
          // Next handshake reads the new token via the auth callback.
          if (!socket.connected) {
            socket.connect();
          }
        })
        .catch((refreshErr) => {
          logError(refreshErr, {
            source: 'socket',
            action: 'Token refresh after auth failure',
          });
        })
        .finally(() => {
          authRefreshInFlight = false;
        });
    });

    // Register real-time event handlers via the stable callback
    const events = [
      'message:new',
      'message:status',
      'message:reaction',
      'call:incoming',
      'call:ring',
      'call:ring_timeout',
      'call:declined',
      'call:updated',
      'call:transcript',
      'call:dtmf',
      'call:outbound_initiated',
      'call:outbound_connected',
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
      'order:new',
      'order:updated',
      'ticket:new',
      'ticket:updated',
    ];

    for (const event of events) {
      socket.on(event, (data) => onMessage(event, data));
    }

    // Handle server-initiated session revocation (admin removed user from org).
    // The server emits this just before disconnecting the socket.
    socket.on('session:revoked', () => {
      disposed = true;
      socket.io.opts.reconnection = false;
      clearAuthTokens();
      // Dynamic import to avoid circular dependency and keep toast as a side-effect.
      void import('../utils/toast').then(({ toastWarning }) => {
        toastWarning('Your session was revoked by an administrator. Please log in again.');
      });
      // Small delay so the toast renders before navigating away.
      setTimeout(() => {
        window.location.href = '/login';
      }, 300);
    });

    return () => {
      disposed = true;
      socketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [onMessage]);

  return { socketRef, state };
}
