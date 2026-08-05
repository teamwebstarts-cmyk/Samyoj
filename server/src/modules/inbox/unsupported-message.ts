/**
 * Meta Cloud API delivers many consumer WhatsApp features as
 * `type: "unsupported"` (error 131051) — e.g. polls.
 * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/unsupported
 */

export const META_UNSUPPORTED_LABELS: Record<string, { title: string; detail: string }> = {
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
  list: {
    title: 'List message',
    detail: 'This list interaction was marked unsupported by Cloud API.',
  },
  button: {
    title: 'Button message',
    detail: 'This button interaction was marked unsupported by Cloud API.',
  },
  interactive: {
    title: 'Interactive message',
    detail: 'This interactive message type is not supported by Cloud API for businesses.',
  },
  location: {
    title: 'Location',
    detail: 'This location payload was marked unsupported by Cloud API.',
  },
  order: {
    title: 'Order',
    detail: 'This order payload was marked unsupported by Cloud API.',
  },
  reaction: {
    title: 'Reaction',
    detail: 'This reaction event was marked unsupported by Cloud API.',
  },
  hsm: {
    title: 'Template message',
    detail: 'This template/HSM payload was marked unsupported.',
  },
  errors: {
    title: 'Unavailable message',
    detail: 'WhatsApp could not deliver this message to the business inbox.',
  },
  image: {
    title: 'Image',
    detail: 'This image was marked unsupported by Cloud API.',
  },
};

export function describeUnsupportedType(unsupportedType?: string | null): {
  title: string;
  detail: string;
  content: string;
} {
  const key = (unsupportedType || '').toLowerCase().trim();
  const known = key ? META_UNSUPPORTED_LABELS[key] : undefined;
  if (known) {
    return {
      title: known.title,
      detail: known.detail,
      content: `${known.title} (not supported in business inbox)`,
    };
  }
  return {
    title: 'Unsupported message',
    detail:
      'This WhatsApp feature is not available through the Cloud API business inbox yet.',
    content: 'Unsupported WhatsApp message',
  };
}
