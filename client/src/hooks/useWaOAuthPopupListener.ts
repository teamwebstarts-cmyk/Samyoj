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
    const wrapped: WaOAuthResultHandler = (message: WaOAuthMessage) => {
      clearWaOAuthResult();
      handlerRef.current(message);
    };
    return subscribeWaOAuthResult(wrapped);
  }, []);
}
