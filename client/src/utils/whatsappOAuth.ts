import { backupAuthBeforeOAuth } from './authStorage';

export const WA_OAUTH_MESSAGE = 'samyoj:wa-oauth';
export const WA_OAUTH_POPUP_NAME = 'samyoj_meta_whatsapp_oauth';
export const WA_OAUTH_CHANNEL = 'samyoj:wa-oauth';
const WA_OAUTH_RESULT_KEY = 'samyoj_wa_oauth_result';

export type WaOAuthMessage = {
  type: typeof WA_OAUTH_MESSAGE;
  status: 'success' | 'error' | 'cancel';
  phoneNumber?: string;
  message?: string;
};

export type WaOAuthResultHandler = (message: WaOAuthMessage) => void;

/** True when this window was opened as the Meta OAuth popup (opener may be null after Facebook redirect). */
export function isOAuthPopupWindow(): boolean {
  return window.name === WA_OAUTH_POPUP_NAME;
}

export function isOAuthPopupContext(): boolean {
  return isOAuthPopupWindow() || Boolean(window.opener && !window.opener.closed);
}

/** Open Meta OAuth in a popup so the dashboard (and JWT) stay loaded. */
export function startWhatsAppOAuth(
  url: string,
  options?: { returnPath?: string }
): { mode: 'popup' | 'redirect'; popup: Window | null } {
  backupAuthBeforeOAuth(options?.returnPath || '/settings?tab=whatsapp');

  const width = 620;
  const height = 740;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=yes`;

  const popup = window.open(url, WA_OAUTH_POPUP_NAME, features);

  if (!popup || popup.closed) {
    console.warn('[wa-oauth] Popup blocked — falling back to full-page redirect');
    window.location.href = url;
    return { mode: 'redirect', popup: null };
  }

  console.info('[wa-oauth] Popup opened for Meta OAuth');
  popup.focus();
  return { mode: 'popup', popup };
}

/** Notify the opener/parent via every channel (opener is often null after Meta redirect in production). */
export function publishWaOAuthResult(payload: Omit<WaOAuthMessage, 'type'>): void {
  const message: WaOAuthMessage = { type: WA_OAUTH_MESSAGE, ...payload };

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin);
    }
  } catch {
    // ignore cross-window issues
  }

  try {
    const channel = new BroadcastChannel(WA_OAUTH_CHANNEL);
    channel.postMessage(message);
    channel.close();
  } catch {
    // BroadcastChannel unavailable
  }

  try {
    localStorage.setItem(WA_OAUTH_RESULT_KEY, JSON.stringify({ ...message, ts: Date.now() }));
  } catch {
    // private mode / quota
  }
}

export function readRecentWaOAuthResult(maxAgeMs = 120_000): WaOAuthMessage | null {
  try {
    const raw = localStorage.getItem(WA_OAUTH_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WaOAuthMessage & { ts?: number };
    if (!parsed.ts || Date.now() - parsed.ts > maxAgeMs) return null;
    if (!isWaOAuthMessage(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearWaOAuthResult(): void {
  try {
    localStorage.removeItem(WA_OAUTH_RESULT_KEY);
  } catch {
    // ignore
  }
}

export function subscribeWaOAuthResult(handler: WaOAuthResultHandler): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (!isWaOAuthMessage(event.data)) return;
    handler(event.data);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(WA_OAUTH_CHANNEL);
    channel.onmessage = (event: MessageEvent<WaOAuthMessage>) => {
      if (isWaOAuthMessage(event.data)) handler(event.data);
    };
  } catch {
    // ignore
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== WA_OAUTH_RESULT_KEY || !event.newValue) return;
    try {
      const parsed = JSON.parse(event.newValue) as WaOAuthMessage;
      if (isWaOAuthMessage(parsed)) handler(parsed);
    } catch {
      // ignore
    }
  };

  window.addEventListener('message', onMessage);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener('message', onMessage);
    window.removeEventListener('storage', onStorage);
    channel?.close();
  };
}

/** Complete OAuth in a popup: notify parent and try to close. Returns true if this is a popup flow. */
export function completeOAuthPopupFlow(payload: Omit<WaOAuthMessage, 'type'>): boolean {
  if (!isOAuthPopupContext()) return false;
  publishWaOAuthResult(payload);
  window.close();
  return true;
}

/** @deprecated Use completeOAuthPopupFlow */
export function notifyOpenerAndClose(payload: Omit<WaOAuthMessage, 'type'>) {
  completeOAuthPopupFlow(payload);
}

export function isWaOAuthMessage(data: unknown): data is WaOAuthMessage {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    (data as WaOAuthMessage).type === WA_OAUTH_MESSAGE
  );
}

export function handleWaOAuthPopupClosed(
  onResult: WaOAuthResultHandler,
  options?: { onClosedWithoutResult?: () => void }
): void {
  const recent = readRecentWaOAuthResult();
  if (recent) {
    clearWaOAuthResult();
    onResult(recent);
    return;
  }
  options?.onClosedWithoutResult?.();
}

export function consumeWaOAuthResult(handler: WaOAuthResultHandler): boolean {
  const recent = readRecentWaOAuthResult();
  if (!recent) return false;
  clearWaOAuthResult();
  handler(recent);
  return true;
}
