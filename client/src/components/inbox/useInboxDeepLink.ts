import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inboxApi } from '../../services/api';
import type { Conversation } from '../../types';

interface DeepLinkDeps {
  upsertConversation: (conv: Conversation) => void;
  openConversation: (conv: Conversation) => Promise<void>;
}

/** Handles ?conversation=<id> deep links (e.g. from Tickets or Contacts pages). */
export function useInboxDeepLink({ upsertConversation, openConversation }: DeepLinkDeps) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (!conversationId) return;
    let cancelled = false;
    inboxApi
      .get(conversationId)
      .then(({ data }) => {
        if (cancelled) return;
        const conv = data.data as Conversation;
        upsertConversation(conv);
        return openConversation(conv);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);
}
