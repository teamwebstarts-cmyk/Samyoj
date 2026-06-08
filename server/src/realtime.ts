import { Server } from 'socket.io';

let io: Server | null = null;

export function setRealtimeIO(server: Server) {
  io = server;
}

export function emitToOrg(organizationId: string, event: string, data: unknown) {
  io?.to(`org:${organizationId}`).emit(event, data);
}

export function emitToUser(userId: string, event: string, data: unknown) {
  io?.to(`user:${userId}`).emit(event, data);
}

export function emitToUsers(userIds: string[], event: string, data: unknown) {
  for (const userId of userIds) {
    emitToUser(userId, event, data);
  }
}
