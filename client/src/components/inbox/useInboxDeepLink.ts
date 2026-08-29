import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { inboxApi } from '../../services/api';
import type { Conversation } from '../../types';

interface DeepLinkDeps {
  upsertConversation: (conv: Conversation) => void;
  openConversation: (conv: Conversation) => Promise<void>;
  ready: boolean;
}

/** Handles ?conversation=<id> deep links (e.g. from Tickets, Contacts, or campaign retarget). */
export function useInboxDeepLink({ upsertConversation, openConversation, ready }: DeepLinkDeps) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (!conversationId) return;
    if (!ready) return;
    let cancelled = false;
    let clearQuery = false;
    inboxApi
      .get(conversationId)
      .then(({ data }) => {
        if (cancelled) return;
        const conv = data.data as Conversation;
        upsertConversation(conv);
        clearQuery = true;
        return openConversation(conv);
      })
      .catch((error) => {
        console.error(error);
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 404) clearQuery = true;
      })
      .finally(() => {
        if (!cancelled && clearQuery) setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams, ready]);
}
