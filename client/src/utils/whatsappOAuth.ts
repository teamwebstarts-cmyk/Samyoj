import { backupAuthBeforeOAuth } from './authStorage';

export const WA_OAUTH_MESSAGE = 'samyoj:wa-oauth';

export type WaOAuthMessage = {
  type: typeof WA_OAUTH_MESSAGE;
  status: 'success' | 'error' | 'cancel';
  phoneNumber?: string;
  message?: string;
};

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

  const popup = window.open(url, 'samyoj_meta_whatsapp_oauth', features);

  if (!popup || popup.closed) {
    console.warn('[wa-oauth] Popup blocked — falling back to full-page redirect');
    window.location.href = url;
    return { mode: 'redirect', popup: null };
  }

  console.info('[wa-oauth] Popup opened for Meta OAuth');
  popup.focus();
  return { mode: 'popup', popup };
}

export function notifyOpenerAndClose(payload: Omit<WaOAuthMessage, 'type'>) {
  const message: WaOAuthMessage = { type: WA_OAUTH_MESSAGE, ...payload };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin);
    }
  } catch {
    // ignore cross-window issues
  }
  window.close();
}

export function isWaOAuthMessage(data: unknown): data is WaOAuthMessage {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    (data as WaOAuthMessage).type === WA_OAUTH_MESSAGE
  );
}
