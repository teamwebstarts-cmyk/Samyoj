import { Server } from 'socket.io';

let io: Server | null = null;

export function setRealtimeIO(server: Server) {
  io = server;
}

export function emitToOrg(organizationId: string, event: string, data: unknown) {
  io?.to(`org:${organizationId}`).emit(event, data);
}
