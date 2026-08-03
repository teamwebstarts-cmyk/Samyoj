import { toastInbox, type InboxToastIcon } from '../../utils/toast';

export type ChatNoticeTone = 'lavender' | 'amber' | 'orange';

export type ChatNoticePayload = {
  kind:
    | 'bot-on'
    | 'bot-off'
    | 'favorite-on'
    | 'favorite-off'
    | 'media-limit'
    | 'send-error';
  message: string;
  tone?: ChatNoticeTone;
  icon?: InboxToastIcon;
  actionLabel?: string;
  onAction?: () => void;
};

type Handler = (payload: ChatNoticePayload) => void;

const handlers = new Map<string, Set<Handler>>();

/**
 * Push an in-chat ephemeral notice when the conversation pane is open.
 * Falls back to the global Inbox toast when no subscriber is mounted
 * (e.g. context-menu action on a non-open conversation).
 */
export function emitChatNotice(conversationId: string, payload: ChatNoticePayload) {
  const set = handlers.get(conversationId);
  if (!set || set.size === 0) {
    toastInbox(payload.message, {
      icon: payload.icon,
      actionLabel: payload.actionLabel,
      onAction: payload.onAction,
    });
    return;
  }
  set.forEach((handler) => handler(payload));
}

export function subscribeChatNotice(conversationId: string, handler: Handler) {
  let set = handlers.get(conversationId);
  if (!set) {
    set = new Set();
    handlers.set(conversationId, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
    if (set!.size === 0) handlers.delete(conversationId);
  };
}

export function dismissStorageKey(conversationId: string, kind: string) {
  return `inbox:notice-dismissed:${conversationId}:${kind}`;
}

export function isNoticeDismissed(conversationId: string, kind: string): boolean {
  try {
    return sessionStorage.getItem(dismissStorageKey(conversationId, kind)) === '1';
  } catch {
    return false;
  }
}

export function setNoticeDismissed(conversationId: string, kind: string, dismissed: boolean) {
  try {
    const key = dismissStorageKey(conversationId, kind);
    if (dismissed) sessionStorage.setItem(key, '1');
    else sessionStorage.removeItem(key);
  } catch {
    /* private mode / blocked storage — ignore */
  }
}
