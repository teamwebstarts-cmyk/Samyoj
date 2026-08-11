import { useCallback, useEffect, useRef, useState } from 'react';
import { whatsappApi } from '../services/api';
import { handleWaOAuthPopupClosed, startWhatsAppOAuth } from '../utils/whatsappOAuth';
import { toastError, toastSuccess } from '../utils/toast';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useWaOAuthPopupListener } from './useWaOAuthPopupListener';

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

  const handleOAuthResult = useCallback(
    (data: { status: string; message?: string }) => {
      setConnecting(false);
      if (data.status === 'success') {
        toastSuccess(data.message || 'WhatsApp connected');
        void refreshNumbers({ silent: true }).then(() => onConnectedRef.current?.());
        return;
      }
      if (data.status === 'cancel') {
        toastSuccess(data.message || 'Connection cancelled — you are still signed in.');
        return;
      }
      toastError(data.message || 'WhatsApp connection failed');
    },
    [refreshNumbers]
  );

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

  useWaOAuthPopupListener(handleOAuthResult);

  const connect = useCallback(() => {
    const start = (url: string) => {
      setConnecting(true);
      const { mode, popup } = startWhatsAppOAuth(url, { returnPath });
      if (mode === 'redirect') return;
      const poll = window.setInterval(() => {
        if (popup && popup.closed) {
          window.clearInterval(poll);
          handleWaOAuthPopupClosed(handleOAuthResult, {
            onClosedWithoutResult: () => {
              setConnecting(false);
              void refreshNumbers({ silent: true });
            },
          });
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
  }, [connectUrl, returnPath, handleOAuthResult, refreshNumbers]);

  return { connect, connecting };
}
