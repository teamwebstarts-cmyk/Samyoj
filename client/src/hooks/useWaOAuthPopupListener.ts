import { useEffect, useRef } from 'react';
import {
  clearWaOAuthResult,
  type WaOAuthMessage,
  type WaOAuthResultHandler,
  subscribeWaOAuthResult,
} from '../utils/whatsappOAuth';

/** Listen for WhatsApp OAuth results from popup (postMessage + BroadcastChannel + storage). */
export function useWaOAuthPopupListener(handler: WaOAuthResultHandler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    // ponytail: popup publishes via 3 channels; dedupe identical results or one failure shows 3 toasts.
    let lastKey = '';
    let lastAt = 0;
    const wrapped: WaOAuthResultHandler = (message: WaOAuthMessage) => {
      clearWaOAuthResult();
      const key = `${message.status}|${message.message || ''}|${message.phoneNumber || ''}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < 3000) return;
      lastKey = key;
      lastAt = now;
      handlerRef.current(message);
    };
    return subscribeWaOAuthResult(wrapped);
  }, []);
}
