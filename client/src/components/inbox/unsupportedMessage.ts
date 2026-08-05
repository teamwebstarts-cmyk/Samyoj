/**
 * Labels for Meta Cloud API `type: "unsupported"` inbound webhooks.
 * Keep in sync with server/src/modules/inbox/unsupported-message.ts
 */

const LABELS: Record<string, { title: string; detail: string }> = {
  poll_creation: {
    title: 'Poll',
    detail: 'WhatsApp Cloud API does not deliver poll contents to business inboxes yet.',
  },
  poll_update: {
    title: 'Poll update',
    detail: 'A poll vote/update was sent, but Cloud API cannot share the details with businesses.',
  },
  group_invite: {
    title: 'Group invite',
    detail: 'Group invites are not available to Cloud API business inboxes.',
  },
  keep_in_chat: {
    title: 'Keep in chat',
    detail: 'This Keep-in-chat event is not supported by Cloud API.',
  },
  pin: {
    title: 'Pinned message',
    detail: 'Pin events are not supported by Cloud API.',
  },
  edit: {
    title: 'Edited message',
    detail: 'Message edits are not delivered to Cloud API business inboxes yet.',
  },
  product: {
    title: 'Product message',
    detail: 'This product message type is not fully supported here.',
  },
  media_placeholder: {
    title: 'Media unavailable',
    detail: 'WhatsApp sent a media placeholder that Cloud API cannot download.',
  },
  link_preview: {
    title: 'Link preview',
    detail: 'Link-preview-only updates are not shown in the business inbox.',
  },
  gif: {
    title: 'GIF',
    detail: 'This GIF format was marked unsupported by Cloud API.',
  },
  interactive: {
    title: 'Interactive message',
    detail: 'This interactive message type is not supported here.',
  },
};

export function describeUnsupportedMessage(unsupportedType?: string | null): {
  title: string;
  detail: string;
} {
  const key = (unsupportedType || '').toLowerCase().trim();
  return (
    LABELS[key] || {
      title: 'Unsupported message',
      detail: 'This WhatsApp feature is not available through the Cloud API business inbox yet.',
    }
  );
}

/** Detect legacy `[unsupported]` / poll labels from older parser versions. */
export function isUnsupportedMessageContent(
  content?: string | null,
  metadata?: {
    isUnsupported?: boolean;
    unsupportedType?: string;
  } | null
): boolean {
  if (metadata?.isUnsupported) return true;
  if (metadata?.unsupportedType) return true;
  const c = (content || '').trim();
  if (/\(not supported in business inbox\)$/i.test(c)) return true;
  if (c === '[unsupported]') return true;
  const m = c.match(/^\[([a-z0-9_]+)\]$/i);
  if (m) {
    const inner = m[1].toLowerCase();
    return inner === 'unsupported' || inner in LABELS;
  }
  return false;
}

export function unsupportedTypeFromContent(content?: string | null): string | undefined {
  const c = (content || '').trim();
  const m = c.match(/^\[([a-z0-9_]+)\]$/i);
  if (m) return m[1].toLowerCase();
  if (/^poll\b/i.test(c)) return 'poll_creation';
  return undefined;
}
