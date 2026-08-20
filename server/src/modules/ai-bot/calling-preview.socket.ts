import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { createModuleLogger } from '../../utils/logger';
import { CallingPreviewSession } from './calling-preview.session';

const log = createModuleLogger('calling-preview-socket');

const startSchema = z.object({
  botId: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  instructions: z.string().min(8).max(8000),
  voiceGreeting: z.string().max(500).nullable().optional(),
  voiceSpeaker: z.string().max(40).nullable().optional(),
  voiceLanguage: z.string().max(20).nullable().optional(),
  previewKnowledge: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        content: z.string().min(1).max(2000),
      })
    )
    .max(12)
    .optional(),
  whatsappNumberId: z.string().uuid().optional(),
});

const audioSchema = z.object({
  pcmBase64: z.string().min(1),
  sampleRate: z.number().int().min(8000).max(48000),
});

const sessions = new WeakMap<Socket, CallingPreviewSession>();

function cleanupSession(socket: Socket): void {
  const session = sessions.get(socket);
  if (!session) return;
  sessions.delete(socket);
  void session.close();
}

export function registerCallingPreviewHandlers(_io: Server, socket: Socket): void {
  socket.on('calling-preview:start', async (payload: unknown) => {
    cleanupSession(socket);
    const user = socket.data.user as { organizationId?: string } | undefined;
    const orgId = user?.organizationId;
    if (!orgId) {
      socket.emit('calling-preview:error', { message: 'Organization required.' });
      return;
    }

    try {
      const body = startSchema.parse(payload);
      await CallingPreviewSession.assertReady(orgId);

      const session = new CallingPreviewSession(
        {
          organizationId: orgId,
          botId: body.botId,
          name: body.name,
          instructions: body.instructions,
          voiceGreeting: body.voiceGreeting,
          voiceSpeaker: body.voiceSpeaker,
          voiceLanguage: body.voiceLanguage,
          previewKnowledge: body.previewKnowledge,
          whatsappNumberId: body.whatsappNumberId,
        },
        {
          onPartial: (text) => socket.emit('calling-preview:partial', { text }),
          onUserFinal: (text) => socket.emit('calling-preview:user', { text }),
          onAssistant: (data) => socket.emit('calling-preview:assistant', data),
          onState: (phase) => socket.emit('calling-preview:state', { phase }),
          onError: (message) => socket.emit('calling-preview:error', { message }),
        }
      );

      sessions.set(socket, session);
      await session.start();
      socket.emit('calling-preview:ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not start live preview.';
      log.warn('calling-preview:start failed', { error: message });
      socket.emit('calling-preview:error', { message });
      cleanupSession(socket);
    }
  });

  socket.on('calling-preview:audio', (payload: unknown) => {
    const session = sessions.get(socket);
    if (!session) return;
    try {
      const { pcmBase64, sampleRate } = audioSchema.parse(payload);
      const buf = Buffer.from(pcmBase64, 'base64');
      const samples = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
      session.sendPcm(samples, sampleRate);
    } catch {
      // ignore malformed chunks
    }
  });

  socket.on('calling-preview:playback-ended', () => {
    sessions.get(socket)?.notifyPlaybackEnded();
  });

  socket.on('calling-preview:stop', () => {
    cleanupSession(socket);
    socket.emit('calling-preview:stopped');
  });

  socket.on('disconnect', () => {
    cleanupSession(socket);
  });
}
