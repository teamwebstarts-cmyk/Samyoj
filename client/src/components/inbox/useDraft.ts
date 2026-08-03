import { useCallback, useEffect, useRef, useState } from 'react';

const keyFor = (conversationId: string) => `inbox:draft:${conversationId}`;

function readDraft(conversationId: string): string {
  try {
    return sessionStorage.getItem(keyFor(conversationId)) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(conversationId: string, value: string) {
  try {
    if (value.trim()) sessionStorage.setItem(keyFor(conversationId), value);
    else sessionStorage.removeItem(keyFor(conversationId));
  } catch {
    /* sessionStorage unavailable — drafts simply don't persist */
  }
}

/**
 * Per-conversation composer draft persisted to sessionStorage: saved when the
 * agent switches chats, restored when they come back, cleared on send.
 */
export function useDraft(conversationId: string | undefined) {
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const prevIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const prev = prevIdRef.current;
    prevIdRef.current = conversationId;
    if (prev && prev !== conversationId) {
      writeDraft(prev, draftRef.current);
    }
    const restored = conversationId ? readDraft(conversationId) : '';
    draftRef.current = restored;
    setDraft(restored);
  }, [conversationId]);

  const clearDraft = useCallback(() => {
    draftRef.current = '';
    setDraft('');
    if (conversationId) writeDraft(conversationId, '');
  }, [conversationId]);

  return { draft, setDraft, clearDraft };
}
