export function formatDuration(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatCallTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  if (isYesterday) return 'Yesterday';

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 1 && diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** List title: contact name, or a short unknown label — never a full +91 line. */
export function callListTitle(name?: string | null, phone?: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length >= 4) return `Unknown · ${digits.slice(-4)}`;
  return 'Unknown';
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (phone.startsWith('+')) return phone;
  return digits ? `+${digits}` : phone;
}

/** List / stage badge label per with-content UI spec. */
export function callStatusLabel(status: string): string {
  if (isActiveCallStatus(status)) return 'LIVE';
  if (status === 'MISSED' || status === 'REJECTED') return 'Missed';
  if (status === 'COMPLETED' || status === 'TERMINATED') return 'Completed';
  if (status === 'FAILED') return 'Failed';
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function callStatusTone(status: string): 'live' | 'missed' | 'completed' | 'failed' | 'neutral' {
  if (isActiveCallStatus(status)) return 'live';
  if (status === 'MISSED' || status === 'REJECTED') return 'missed';
  if (status === 'COMPLETED' || status === 'TERMINATED') return 'completed';
  if (status === 'FAILED') return 'failed';
  return 'neutral';
}

export function isActiveCallStatus(status: string): boolean {
  return ['CONNECTED', 'CONNECTING', 'RINGING'].includes(status);
}

/** Phone Recents kind: incoming blue, outgoing green, missed red. */
export type CallRecentsKind = 'live' | 'missed' | 'incoming' | 'outgoing' | 'failed';

export function callRecentsKind(direction?: string, status?: string): CallRecentsKind {
  const value = status || '';
  if (isActiveCallStatus(value)) return 'live';
  if (value === 'FAILED') return 'failed';
  if (value === 'MISSED' || value === 'REJECTED') return 'missed';
  return direction === 'BUSINESS_INITIATED' ? 'outgoing' : 'incoming';
}

export function callRecentsLabel(kind: CallRecentsKind): string {
  if (kind === 'live') return 'Live';
  if (kind === 'missed') return 'Missed';
  if (kind === 'failed') return 'Failed';
  if (kind === 'outgoing') return 'Outgoing';
  return 'Incoming';
}

/** iOS / WhatsApp Calls palette. */
export const CALL_RECENTS_COLOR: Record<CallRecentsKind, string> = {
  live: 'text-emerald-600 dark:text-emerald-400',
  incoming: 'text-[#007AFF] dark:text-sky-400',
  outgoing: 'text-[#34C759] dark:text-emerald-400',
  missed: 'text-[#FF3B30] dark:text-rose-400',
  failed: 'text-amber-500 dark:text-amber-400',
};


export function normalizeTranscript(
  transcript: unknown
): Array<{ role: string; text: string; at: string }> {
  if (!transcript) return [];
  let value: unknown = transcript;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is { role: string; text: string; at: string } =>
      Boolean(entry && typeof entry === 'object' && typeof (entry as { text?: string }).text === 'string')
  ).map((entry) => ({
    role: typeof entry.role === 'string' ? entry.role : 'assistant',
    text: entry.text,
    at: typeof entry.at === 'string' ? entry.at : new Date().toISOString(),
  }));
}

export function transcriptPreview(transcript: unknown): string {
  const entries = normalizeTranscript(transcript);
  if (!entries.length) return 'No conversation yet';
  const last = [...entries].reverse().find((e) => e.text?.trim());
  if (!last) return 'No conversation yet';
  const prefix = last.role === 'user' ? '' : 'You: ';
  const text = last.text.trim();
  return prefix + (text.length > 48 ? `${text.slice(0, 48)}…` : text);
}

export function formatBubbleTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}
