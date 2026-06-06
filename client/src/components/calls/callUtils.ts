export function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function formatCallTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function callStatusLabel(status: string): string {
  const map: Record<string, string> = {
    CONNECTED: 'Live',
    CONNECTING: 'Connecting',
    RINGING: 'Ringing',
    COMPLETED: 'Completed',
    FAILED: 'Failed',
    MISSED: 'Missed',
    REJECTED: 'Declined',
    TERMINATED: 'Ended',
  };
  return map[status] || status.charAt(0) + status.slice(1).toLowerCase();
}

export function isActiveCallStatus(status: string): boolean {
  return ['CONNECTED', 'CONNECTING', 'RINGING'].includes(status);
}

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
  );
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
