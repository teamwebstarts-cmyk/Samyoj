import { useCallback, useEffect, useRef, useState } from 'react';
import { whatsappApi } from '../services/api';
import {
  getWhatsAppOAuthRedirectUri,
  handleWaOAuthPopupClosed,
  startWhatsAppOAuth,
} from '../utils/whatsappOAuth';
import { toastError, toastSuccess } from '../utils/toast';
import { sanitizeUserErrorMessage } from '../utils/errors';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useWaOAuthPopupListener } from './useWaOAuthPopupListener';

function pickConnectUrl(payload: unknown): string {
  if (payload && typeof payload === 'object' && typeof (payload as { url?: unknown }).url === 'string') {
    return (payload as { url: string }).url;
  }
  return '';
}

/** Shared Connect WhatsApp OAuth (popup + refresh) for Dashboard / Settings-style CTAs. */
export function useWhatsAppConnectOAuth(options?: {
  returnPath?: string;
  onConnected?: () => void;
  prefetch?: boolean;
}) {
  const { refreshNumbers } = useWhatsAppNumber();
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const returnPath = options?.returnPath || '/';
  const prefetch = options?.prefetch !== false;
  const popupPollRef = useRef<number | null>(null);
  const connectingRef = useRef(false);
  const onConnectedRef = useRef(options?.onConnected);
  onConnectedRef.current = options?.onConnected;

  const clearPopupPoll = useCallback(() => {
    if (popupPollRef.current !== null) {
      window.clearInterval(popupPollRef.current);
      popupPollRef.current = null;
    }
  }, []);

  const handleOAuthResult = useCallback(
    (data: { status: string; message?: string }) => {
      clearPopupPoll();
      connectingRef.current = false;
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
      toastError(sanitizeUserErrorMessage(data.message || 'WhatsApp connection failed'));
    },
    [clearPopupPoll, refreshNumbers]
  );

  useEffect(() => {
    if (!connecting) return;
    const tick = () => {
      void refreshNumbers({ silent: true });
    };
    const interval = window.setInterval(tick, 2000);
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [connecting, refreshNumbers]);

  useEffect(() => {
    if (!prefetch) return;
    let cancelled = false;
    void (async () => {
      try {
        const redirectUri = getWhatsAppOAuthRedirectUri();
        const { data } = await whatsappApi.connectUrl(redirectUri);
        if (!cancelled) setConnectUrl(pickConnectUrl(data?.data));
      } catch {
        if (!cancelled) setConnectUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefetch]);

  useEffect(() => clearPopupPoll, [clearPopupPoll]);

  useWaOAuthPopupListener(handleOAuthResult);

  const connect = useCallback(() => {
    if (connectingRef.current) return;

    const start = (url: string) => {
      connectingRef.current = true;
      setConnecting(true);
      const { mode, popup } = startWhatsAppOAuth(url, { returnPath });
      if (mode === 'redirect') return;
      clearPopupPoll();
      popupPollRef.current = window.setInterval(() => {
        if (popup && popup.closed) {
          clearPopupPoll();
          handleWaOAuthPopupClosed(handleOAuthResult, {
            onClosedWithoutResult: () => {
              connectingRef.current = false;
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

    connectingRef.current = true;
    void (async () => {
      try {
        const redirectUri = getWhatsAppOAuthRedirectUri();
        const { data } = await whatsappApi.connectUrl(redirectUri);
        const url = pickConnectUrl(data?.data);
        if (!url) {
          connectingRef.current = false;
          toastError('Could not start WhatsApp connection. Please try again.');
          return;
        }
        setConnectUrl(url);
        start(url);
      } catch {
        connectingRef.current = false;
        toastError('Could not start WhatsApp connection. Please try again.');
      }
    })();
  }, [connectUrl, returnPath, clearPopupPoll, handleOAuthResult, refreshNumbers]);

  return { connect, connecting };
}
