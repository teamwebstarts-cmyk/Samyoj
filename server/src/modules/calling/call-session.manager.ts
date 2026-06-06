import { AiVoiceCallSession } from './ai-voice-agent';
import type { ActiveCallContext } from './types';

const activeSessions = new Map<string, AiVoiceCallSession>();

export function registerCallSession(metaCallId: string, session: AiVoiceCallSession): void {
  activeSessions.set(metaCallId, session);
}

export function getCallSession(metaCallId: string): AiVoiceCallSession | undefined {
  return activeSessions.get(metaCallId);
}

export function removeCallSession(metaCallId: string): void {
  activeSessions.delete(metaCallId);
}

export async function endCallSession(metaCallId: string, reason?: string): Promise<void> {
  const session = activeSessions.get(metaCallId);
  if (!session) return;
  await session.end(reason);
  activeSessions.delete(metaCallId);
}

export function listActiveCallIds(): string[] {
  return Array.from(activeSessions.keys());
}

export function getActiveSessionCount(): number {
  return activeSessions.size;
}

export type { ActiveCallContext };
