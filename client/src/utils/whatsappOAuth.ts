import { backupAuthBeforeOAuth } from './authStorage';

export const WA_OAUTH_MESSAGE = 'samyoj:wa-oauth';
export const WA_OAUTH_POPUP_NAME = 'samyoj_meta_whatsapp_oauth';
export const WA_OAUTH_CHANNEL = 'samyoj:wa-oauth';
export const WA_OAUTH_CALLBACK_PATH = '/settings/whatsapp/callback';
export const WA_OAUTH_POPUP_CALLBACK_PATH = '/settings/whatsapp/callback/popup';
const WA_OAUTH_POPUP_MARKER_KEY = 'samyoj_wa_oauth_popup_marker';
const WA_OAUTH_RESULT_KEY = 'samyoj_wa_oauth_result';

export type WaOAuthMessage = {
  type: typeof WA_OAUTH_MESSAGE;
  status: 'success' | 'error' | 'cancel';
  phoneNumber?: string;
  message?: string;
};

export type WaOAuthResultHandler = (message: WaOAuthMessage) => void;

/** Dedicated popup callback — treat as popup even if Facebook cleared window.name / opener. */
export function isWhatsAppPopupCallbackPath(pathname: string): boolean {
  return pathname === WA_OAUTH_POPUP_CALLBACK_PATH || pathname === WA_OAUTH_CALLBACK_PATH;
}

/**
 * True only for a window script-opened as the OAuth popup.
 * The Embedded Signup callback can load in the main tab; that tab must not call window.close().
 */
export function isOAuthPopupWindow(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.name === WA_OAUTH_POPUP_NAME) return true;
  // A leftover marker must not make the main tab close itself after Finish.
  return (
    window.location.pathname === WA_OAUTH_POPUP_CALLBACK_PATH &&
    Boolean(window.opener && !window.opener.closed)
  );
}

export function isOAuthPopupContext(): boolean {
  return isOAuthPopupWindow() || Boolean(window.opener && !window.opener.closed);
}

/** Use a dedicated callback path so popup intent survives Meta's cross-origin redirect. */
export function getWhatsAppOAuthRedirectUri(): string {
  return `${window.location.origin}${WA_OAUTH_POPUP_CALLBACK_PATH}`;
}

function setPopupMarker() {
  try {
    localStorage.setItem(WA_OAUTH_POPUP_MARKER_KEY, String(Date.now()));
  } catch {
    // Private mode / quota; window.name remains the fallback signal.
  }
}

function clearPopupMarker() {
  try {
    localStorage.removeItem(WA_OAUTH_POPUP_MARKER_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/** Open Meta OAuth in a popup so the dashboard (and JWT) stay loaded. */
export function startWhatsAppOAuth(
  url: string,
  options?: { returnPath?: string }
): { mode: 'popup' | 'redirect'; popup: Window | null } {
  backupAuthBeforeOAuth(options?.returnPath || '/settings?tab=whatsapp');
  setPopupMarker();

  const width = 620;
  const height = 740;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes,status=yes`;

  const popup = window.open(url, WA_OAUTH_POPUP_NAME, features);

  if (!popup || popup.closed) {
    clearPopupMarker();
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
  clearPopupMarker();
  try {
    window.close();
  } catch {
    // Brave / popup policy may block close; parent still got the result.
  }
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      // ignore
    }
  }, 250);
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
  clearPopupMarker();
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
