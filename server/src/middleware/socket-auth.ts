import type { Socket } from 'socket.io';
import { logError } from '../errors';
import { verifyAccessToken } from '../utils/jwt';
import { hasActiveOrgMembership } from './auth';

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
