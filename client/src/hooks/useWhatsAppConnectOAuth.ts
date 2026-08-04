import { useCallback, useEffect, useRef, useState } from 'react';
import { whatsappApi } from '../services/api';
import { isWaOAuthMessage, startWhatsAppOAuth } from '../utils/whatsappOAuth';
import { toastError, toastSuccess } from '../utils/toast';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';

function pickConnectUrl(payload: unknown): string {
  if (payload && typeof payload === 'object' && typeof (payload as { url?: unknown }).url === 'string') {
    return (payload as { url: string }).url;
  }
  return '';
}

/** Shared Connect WhatsApp OAuth (popup + refresh) for Dashboard / Settings-style CTAs. */
export function useWhatsAppConnectOAuth(options?: { returnPath?: string; onConnected?: () => void }) {
  const { refreshNumbers } = useWhatsAppNumber();
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const returnPath = options?.returnPath || '/';
  const onConnectedRef = useRef(options?.onConnected);
  onConnectedRef.current = options?.onConnected;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const redirectUri = `${window.location.origin}/settings/whatsapp/callback`;
        const { data } = await whatsappApi.connectUrl(redirectUri);
        if (!cancelled) setConnectUrl(pickConnectUrl(data?.data));
      } catch {
        if (!cancelled) setConnectUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!isWaOAuthMessage(event.data)) return;
      setConnecting(false);
      if (event.data.status === 'success') {
        toastSuccess(event.data.message || 'WhatsApp connected');
        void refreshNumbers({ silent: true }).then(() => onConnectedRef.current?.());
        return;
      }
      if (event.data.status === 'cancel') {
        toastSuccess(event.data.message || 'Connection cancelled — you are still signed in.');
        return;
      }
      toastError(event.data.message || 'WhatsApp connection failed');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshNumbers]);

  const connect = useCallback(() => {
    const start = (url: string) => {
      setConnecting(true);
      const { mode, popup } = startWhatsAppOAuth(url, { returnPath });
      if (mode === 'redirect') return;
      const poll = window.setInterval(() => {
        if (popup && popup.closed) {
          window.clearInterval(poll);
          setConnecting(false);
        }
      }, 500);
    };

    if (connectUrl) {
      start(connectUrl);
      return;
    }

    void (async () => {
      try {
        const redirectUri = `${window.location.origin}/settings/whatsapp/callback`;
        const { data } = await whatsappApi.connectUrl(redirectUri);
        const url = pickConnectUrl(data?.data);
        if (!url) {
          toastError('Could not start WhatsApp connection. Please try again.');
          return;
        }
        setConnectUrl(url);
        start(url);
      } catch {
        toastError('Could not start WhatsApp connection. Please try again.');
      }
    })();
  }, [connectUrl, returnPath]);

  return { connect, connecting };
}
