import { useCallback, useEffect, useState } from 'react';

/** Match WhatsApp Inbox: docked slide panel on md+, bottom sheet overlay on mobile. */
export function useChannelDetailsToggle(conversationId: string | null) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    setPanelOpen(false);
    setOverlayOpen(false);
  }, [conversationId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => {
      if (mq.matches) {
        setPanelOpen((wasOpen) => {
          if (wasOpen) setOverlayOpen(true);
          return wasOpen;
        });
        return;
      }
      setOverlayOpen((wasOverlay) => {
        if (wasOverlay) setPanelOpen(true);
        return false;
      });
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const toggle = useCallback(() => {
    if (!conversationId) return;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (mobile) {
      setOverlayOpen((prev) => {
        const next = !prev;
        setPanelOpen(next);
        return next;
      });
      return;
    }
    setOverlayOpen(false);
    setPanelOpen((prev) => !prev);
  }, [conversationId]);

  const close = useCallback(() => {
    setPanelOpen(false);
    setOverlayOpen(false);
  }, []);

  return { panelOpen, setPanelOpen, overlayOpen, toggle, close };
}
