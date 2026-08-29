import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { logError } from '../utils/errors';
import { getSocketIoClientOptions, socketBaseUrl } from '../services/utils';
import { ensureFreshAccessToken } from '../services/api';
import { clearAuthTokens, hasAuthSessionHint } from '../utils/authStorage';

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

/** Engine/manager events — not product payloads. */
const INTERNAL_SOCKET_EVENTS = new Set([
  'connect',
  'disconnect',
  'connect_error',
  'reconnect',
  'reconnect_attempt',
  'reconnect_error',
  'reconnect_failed',
  'ping',
  'pong',
  'error',
]);

const INITIAL_SOCKET_STATE: SocketState = {
  status: 'disconnected',
  lastConnectedAt: null,
  reconnectAttempts: 0,
  totalDisconnects: 0,
};

type EventHandler = (event: string, data: unknown) => void;

let sharedSocket: Socket | null = null;
let subscriberCount = 0;
let reconnectAttempts = 0;
let authRefreshInFlight = false;
let sharedState: SocketState = { ...INITIAL_SOCKET_STATE };
const eventHandlers = new Set<EventHandler>();
const stateListeners = new Set<(state: SocketState) => void>();

function publishState(patch: Partial<SocketState>) {
  sharedState = { ...sharedState, ...patch };
  for (const listener of stateListeners) listener(sharedState);
}

function dispatchEvent(event: string, data: unknown) {
  for (const handler of eventHandlers) handler(event, data);
}

function attachSharedSocket(socket: Socket) {
  socket.on('connect', () => {
    reconnectAttempts = 0;
    publishState({
      status: 'connected',
      lastConnectedAt: new Date(),
      reconnectAttempts: 0,
    });
  });

  socket.on('disconnect', () => {
    publishState({
      status: 'disconnected',
      reconnectAttempts,
      totalDisconnects: sharedState.totalDisconnects + 1,
    });
  });

  socket.on('reconnect_attempt', () => {
    reconnectAttempts++;
    publishState({ status: 'connecting', reconnectAttempts });
  });

  socket.on('reconnect', () => {
    reconnectAttempts = 0;
    publishState({
      status: 'connected',
      lastConnectedAt: new Date(),
      reconnectAttempts: 0,
    });
  });

  socket.on('reconnect_error', (err) => {
    logError(err, {
      source: 'socket',
      action: 'Reconnection error',
      attempts: reconnectAttempts,
    });
  });

  socket.on('reconnect_failed', () => {
    publishState({ status: 'error', reconnectAttempts });
    logError(new Error('Socket reconnection failed after all attempts'), {
      source: 'socket',
      action: 'Reconnection failed',
      attempts: reconnectAttempts,
    });
  });

  socket.on('connect_error', (err) => {
    publishState({ status: 'error' });
    if (isAuthConnectError(err)) {
      logError(err, {
        source: 'socket',
        action: 'Connection failed',
      });
    }

    if (!isAuthConnectError(err) || authRefreshInFlight) return;

    authRefreshInFlight = true;
    void ensureFreshAccessToken()
      .then((refreshed) => {
        if (!refreshed || !sharedSocket) return;
        if (!sharedSocket.connected) sharedSocket.connect();
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

  socket.onAny((event, ...args) => {
    if (INTERNAL_SOCKET_EVENTS.has(event) || event === 'session:revoked') return;
    dispatchEvent(event, args[0]);
  });

  socket.on('session:revoked', () => {
    if (sharedSocket) sharedSocket.io.opts.reconnection = false;
    clearAuthTokens();
    void import('../utils/toast').then(({ toastWarning }) => {
      toastWarning('Your session was revoked by an administrator. Please log in again.');
    });
    setTimeout(() => {
      window.location.href = '/login';
    }, 300);
  });
}

function acquireSharedSocket(): Socket {
  if (sharedSocket) return sharedSocket;

  publishState({ status: 'connecting' });
  const socket = io(socketBaseUrl, {
    ...getSocketIoClientOptions({ reconnection: true }),
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.3,
  });
  attachSharedSocket(socket);
  sharedSocket = socket;
  return socket;
}

function releaseSharedSocket() {
  if (subscriberCount > 0 || !sharedSocket) return;
  const socket = sharedSocket;
  sharedSocket = null;
  reconnectAttempts = 0;
  authRefreshInFlight = false;
  sharedState = { ...INITIAL_SOCKET_STATE };
  socket.removeAllListeners();
  socket.disconnect();
}

/**
 * Shared Socket.IO connection. Inbox, Calls, billing toasts, etc. used to each
 * open their own socket — that flooded reconnects and dropped WebRTC mid-call.
 */
export function useSocket(onEvent?: (event: string, data: unknown) => void) {
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [state, setState] = useState<SocketState>(sharedState);

  const onMessage = useCallback((event: string, data: unknown) => {
    onEventRef.current?.(event, data);
  }, []);

  useEffect(() => {
    if (!hasAuthSessionHint()) return;

    subscriberCount += 1;
    const socket = acquireSharedSocket();
    socketRef.current = socket;
    eventHandlers.add(onMessage);
    stateListeners.add(setState);
    setState(sharedState);

    return () => {
      eventHandlers.delete(onMessage);
      stateListeners.delete(setState);
      socketRef.current = null;
      subscriberCount = Math.max(0, subscriberCount - 1);
      releaseSharedSocket();
    };
  }, [onMessage]);

  return { socketRef, state };
}
