import { useCallback, useEffect, useRef, useState } from 'react';

const keyFor = (conversationId: string) => `inbox:draft:${conversationId}`;

function readDraft(conversationId: string): string {
  try {
    return localStorage.getItem(keyFor(conversationId)) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(conversationId: string, value: string) {
  try {
    if (value.trim()) localStorage.setItem(keyFor(conversationId), value);
    else localStorage.removeItem(keyFor(conversationId));
  } catch {
    /* localStorage unavailable — drafts simply don't persist */
  }
}

/**
 * Per-conversation composer draft persisted to localStorage:
 * - Real-time debounced save (300ms) so text survives page reloads and tab closures
 * - Instantly flushed on conversation switch
 * - Automatically restored when returning to a conversation
 * - Removed immediately on message send via clearDraft()
 */
export function useDraft(conversationId: string | undefined) {
  const [draft, setDraftState] = useState('');
  const draftRef = useRef('');
  const prevIdRef = useRef<string | undefined>(undefined);
  const debounceTimerRef = useRef<number | null>(null);

  // Set draft state and schedule debounced localStorage write
  const setDraft = useCallback((value: string) => {
    draftRef.current = value;
    setDraftState(value);

    if (!conversationId) return;

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      writeDraft(conversationId, value);
      debounceTimerRef.current = null;
    }, 300);
  }, [conversationId]);

  // Handle conversation switching
  useEffect(() => {
    const prev = prevIdRef.current;
    prevIdRef.current = conversationId;

    // Flush any pending write for previous conversation
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (prev && prev !== conversationId) {
      writeDraft(prev, draftRef.current);
    }

    // Restore draft for newly selected conversation
    const restored = conversationId ? readDraft(conversationId) : '';
    draftRef.current = restored;
    setDraftState(restored);
  }, [conversationId]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (conversationId && draftRef.current) {
        writeDraft(conversationId, draftRef.current);
      }
    };
  }, [conversationId]);

  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    draftRef.current = '';
    setDraftState('');
    if (conversationId) writeDraft(conversationId, '');
  }, [conversationId]);

  return { draft, setDraft, clearDraft };
}

