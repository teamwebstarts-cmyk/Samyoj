import { normalizeError } from '../../utils/errors';

function isSensitive(message: string) {
  return /SARVAM|AZURE|API_KEY|\.env|api-subscription-key/i.test(message);
}

export function supportChatErrorMessage(err: unknown): string {
  const n = normalizeError(err);
  if (n.status === 401) return 'Sign in again to use Support.';
  if (n.isNetworkError) return 'Could not reach Support. Check your connection, then try again.';
  if (n.code === 'HELP_CENTER_DISABLED' || n.status === 403 && /turned off/i.test(n.message)) {
    return 'Help assistant is turned off for this workspace.';
  }
  if (n.code === 'HELP_CENTER_DAILY_CAP') {
    return 'Help assistant limit for today — try tomorrow, or ask your platform admin.';
  }
  if (n.status === 429 && /monthly|token/i.test(n.message)) {
    return 'Monthly AI token limit reached for this workspace.';
  }
  if (n.status === 429) return 'The assistant is busy. Try again in a moment.';
  if (n.status === 504) return 'The assistant took too long. Try again.';
  if (n.status === 400) return n.message || 'Ask a question about using Samyoj.';
  if ((n.status && n.status >= 500) || isSensitive(n.message)) {
    return 'The assistant could not reply. Try again.';
  }
  return n.message || 'Could not reach the assistant. Try again.';
}
