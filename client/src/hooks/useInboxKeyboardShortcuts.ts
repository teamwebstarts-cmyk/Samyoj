import { useEffect } from 'react';

export interface InboxShortcutHandlers {
  onFocusSearch?: () => void;
  onCloseChat?: () => void;
  onOpenDetails?: () => void;
  /** F4: open the shortcuts overlay when the user presses `?`. */
  onOpenShortcutsOverlay?: () => void;
  /** F5: open / focus the ⌘K command palette. */
  onOpenCommandPalette?: () => void;
  /** Focus the message composer when `/` is pressed (chat selected). */
  onFocusComposer?: () => void;
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for Inbox power users.
 *  R — focus conversation search
 *  Esc — close chat / deselect
 *  D — toggle details panel
 *  ? — open shortcuts overlay (F4)
 *  ⌘K / Ctrl+K — open command palette (F5)
 *  / — focus composer
 */
export function useInboxKeyboardShortcuts({
  onFocusSearch,
  onCloseChat,
  onOpenDetails,
  onOpenShortcutsOverlay,
  onOpenCommandPalette,
  onFocusComposer,
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

      // Cmd/Ctrl+K — palette (works even while typing, but not when the modal
      // itself has focus — that's handled by the palette's own listener).
      const isModK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      if (isModK) {
        e.preventDefault();
        onOpenCommandPalette?.();
        return;
      }

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
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onOpenShortcutsOverlay?.();
      }
      // Plain `/` focuses composer — skip when Shift is held (that's `?`).
      if (e.key === '/' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onFocusComposer?.();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    enabled,
    onFocusSearch,
    onCloseChat,
    onOpenDetails,
    onOpenShortcutsOverlay,
    onOpenCommandPalette,
    onFocusComposer,
  ]);
}
