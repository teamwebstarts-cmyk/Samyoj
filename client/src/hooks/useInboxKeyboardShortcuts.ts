import { useEffect } from 'react';

interface InboxShortcutHandlers {
  onFocusSearch?: () => void;
  onCloseChat?: () => void;
  onOpenDetails?: () => void;
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for Inbox power users.
 * R — focus conversation search
 * Esc — close chat / deselect
 * D — toggle details panel
 */
export function useInboxKeyboardShortcuts({
  onFocusSearch,
  onCloseChat,
  onOpenDetails,
  enabled = true,
}: InboxShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (e.key === 'Escape' && onCloseChat) {
        onCloseChat();
        return;
      }

      if (isTyping) return;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onFocusSearch?.();
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onOpenDetails?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onFocusSearch, onCloseChat, onOpenDetails]);
}
