export const CHANNEL_OAUTH_MESSAGE = 'samyoj:channel-oauth';
export const FACEBOOK_OAUTH_POPUP = 'samyoj_facebook_oauth';
export const GMAIL_OAUTH_POPUP = 'samyoj_gmail_oauth';
const CHANNEL_OAUTH_RESULT_KEY = 'samyoj_channel_oauth_result';

export type ChannelOAuthResult = {
  type: typeof CHANNEL_OAUTH_MESSAGE;
  channel: 'facebook' | 'gmail';
  status: 'success' | 'error' | 'cancel';
  message?: string;
};

function popupFeatures(): string {
  const width = 620;
  const height = 740;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  return `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;
}

/** Opens the provider in a new window. Returns false when the browser blocks it. */
export function openChannelOAuthPopup(url: string, name: string, markerKey: string): boolean {
  const popup = window.open('about:blank', name, popupFeatures());
  if (!popup || popup.closed) return false;
  try {
    popup.sessionStorage.setItem(markerKey, '1');
  } catch {
    /* about:blank may not allow storage; window.name still survives navigation */
  }
  popup.location.href = url;
  popup.focus();
  return true;
}

export function isChannelPopup(name: string, markerKey: string): boolean {
  if (typeof window === 'undefined') return false;
  if (window.name === name) return true;
  try {
    return sessionStorage.getItem(markerKey) === '1';
  } catch {
    return false;
  }
}

export function publishChannelOAuthResult(payload: Omit<ChannelOAuthResult, 'type'>): void {
  const message: ChannelOAuthResult = { type: CHANNEL_OAUTH_MESSAGE, ...payload };
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(message, window.location.origin);
    }
  } catch {
    /* opener can be gone after the provider redirect */
  }
  try {
    const channel = new BroadcastChannel(CHANNEL_OAUTH_MESSAGE);
    channel.postMessage(message);
    channel.close();
  } catch {
    /* BroadcastChannel unavailable */
  }
  try {
    localStorage.setItem(CHANNEL_OAUTH_RESULT_KEY, JSON.stringify({ ...message, ts: Date.now() }));
  } catch {
    /* private mode */
  }
}

export function subscribeChannelOAuthResult(handler: (message: ChannelOAuthResult) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (!isChannelOAuthResult(event.data)) return;
    handler(event.data);
  };
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_OAUTH_MESSAGE);
    channel.onmessage = (event: MessageEvent<ChannelOAuthResult>) => {
      if (isChannelOAuthResult(event.data)) handler(event.data);
    };
  } catch {
    /* ignore */
  }
  window.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('message', onMessage);
    channel?.close();
  };
}

function isChannelOAuthResult(data: unknown): data is ChannelOAuthResult {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    (data as ChannelOAuthResult).type === CHANNEL_OAUTH_MESSAGE
  );
}

export function finishChannelPopup(
  name: string,
  markerKey: string,
  payload: Omit<ChannelOAuthResult, 'type'>
): boolean {
  if (!isChannelPopup(name, markerKey)) return false;
  try {
    sessionStorage.removeItem(markerKey);
  } catch {
    /* ignore */
  }
  publishChannelOAuthResult(payload);
  window.setTimeout(() => {
    try {
      window.close();
    } catch {
      /* popup policy */
    }
  }, 200);
  return true;
}
