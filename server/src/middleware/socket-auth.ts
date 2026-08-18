import type { Socket } from 'socket.io';
import { logError } from '../errors';
import logger from '../utils/logger';
import { verifyAccessToken } from '../utils/jwt';
import { hasActiveOrgMembership } from './auth';

const MEMBERSHIP_CHECK_INTERVAL_MS = 60_000;

/**
 * Socket.IO handshake auth: JWT plus the same OrganizationUser check as HTTP requireOrg.
 * Revoked / removed members must not join org:{jwtOrgId}.
 */
export async function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): Promise<void> {
  const token = socket.handshake.auth?.token;
  if (!token || typeof token !== 'string') {
    logError(new Error('Authentication required'), { source: 'socket', path: '/connect' });
    return next(new Error('Authentication required'));
  }

  let user;
  try {
    user = verifyAccessToken(token);
  } catch (err) {
    logError(err, { source: 'socket', path: '/connect' });
    return next(new Error('Invalid token'));
  }

  try {
    if (user.organizationId && !(await hasActiveOrgMembership(user.userId, user.organizationId))) {
      logError(new Error('Not a member of this organization'), { source: 'socket', path: '/connect' });
      return next(new Error('Not a member of this organization'));
    }
    socket.data.user = user;
    next();
  } catch (err) {
    logError(err, { source: 'socket', path: '/connect' });
    next(err instanceof Error ? err : new Error('Authentication failed'));
  }
}

/**
 * Periodically re-verify that the connected socket's user still has active org
 * membership. If the user was removed from the org (or the org itself was
 * deleted), the socket is disconnected. Runs every MEMBERSHIP_CHECK_INTERVAL_MS.
 * The interval is cleared automatically on socket disconnect.
 */
export function startMembershipGuard(socket: Socket): void {
  const user = socket.data.user as { userId?: string; organizationId?: string } | undefined;
  if (!user?.userId || !user?.organizationId) return;

  // API keys are system-bound, not OrganizationUser rows — skip periodic check.
  if (user.userId === 'api-key') return;

  const { userId, organizationId } = user;

  const interval = setInterval(async () => {
    try {
      const member = await hasActiveOrgMembership(userId, organizationId);
      if (!member) {
        logger.warn('Socket disconnected: org membership revoked', {
          source: 'socket-membership-guard',
          userId,
          organizationId,
          socketId: socket.id,
        });
        socket.emit('session:revoked', { reason: 'membership_revoked' });
        socket.disconnect(true);
      }
    } catch (err) {
      // Transient DB errors are not grounds for disconnect — log and retry next tick.
      logError(err, { source: 'socket', path: 'membership-guard', userId, organizationId });
    }
  }, MEMBERSHIP_CHECK_INTERVAL_MS);

  interval.unref();

  socket.on('disconnect', () => {
    clearInterval(interval);
  });
}
