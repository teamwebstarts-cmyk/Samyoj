import type { SendMessagePayload } from '../whatsapp/meta.service';

export interface ReplyButton {
  id: string;
  title: string;
}

export interface ListSection {
  title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

export interface InteractiveMessageOptions {
  mode: 'reply' | 'cta_url' | 'cta_call' | 'list';
  body: string;
  buttons?: ReplyButton[];
  ctaLabel?: string;
  ctaUrl?: string;
  ctaPhone?: string;
  listButtonLabel?: string;
  listSections?: ListSection[];
}

export function buildInteractivePayload(
  phone: string,
  options: InteractiveMessageOptions
): SendMessagePayload {
  const body = options.body.slice(0, 1024);

  if (options.mode === 'cta_url' && options.ctaUrl) {
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: body },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: (options.ctaLabel || 'Open link').slice(0, 20),
            url: options.ctaUrl,
          },
        },
      },
    };
  }

  if (options.mode === 'cta_call' && options.ctaPhone) {
    const tel = options.ctaPhone.replace(/[^\d+]/g, '');
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: body },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: (options.ctaLabel || 'Call us').slice(0, 20),
            url: `tel:${tel}`,
          },
        },
      },
    };
  }

  if (options.mode === 'list' && options.listSections?.length) {
    const rows = options.listSections.flatMap((s) => s.rows).slice(0, 10);
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: (options.listButtonLabel || 'Menu').slice(0, 20),
          sections: options.listSections.map((section) => ({
            title: section.title?.slice(0, 24),
            rows: section.rows.slice(0, 10).map((row) => ({
              id: row.id,
              title: row.title.slice(0, 24),
              ...(row.description ? { description: row.description.slice(0, 72) } : {}),
            })),
          })),
        },
      },
    };
  }

  return {
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: (options.buttons || []).slice(0, 3).map((btn) => ({
          type: 'reply' as const,
          reply: { id: btn.id, title: btn.title.slice(0, 20) },
        })),
      },
    },
  };
}
