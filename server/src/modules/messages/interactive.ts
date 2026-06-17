import type { SendMessagePayload } from '../whatsapp/meta.service';

export interface ReplyButton {
  id: string;
  title: string;
}

export interface ListSection {
  title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

export interface ProductSection {
  title?: string;
  productRetailerIds: string[];
}

export interface CarouselCard {
  cardIndex: number;
  type: 'cta_url' | 'quick_reply';
  headerImageUrl?: string;
  headerVideoUrl?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  buttons?: ReplyButton[];
}

export interface LtoOffer {
  text: string;
  expirationTimeMs: number;
}

export type InteractiveMessageMode =
  | 'reply'
  | 'cta_url'
  | 'cta_call'
  | 'list'
  | 'product'
  | 'product_list'
  | 'catalog_message'
  | 'carousel'
  | 'lto';

export interface InteractiveMessageOptions {
  mode: InteractiveMessageMode;
  body: string;
  header?: string;
  footer?: string;
  buttons?: ReplyButton[];
  ctaLabel?: string;
  ctaUrl?: string;
  ctaPhone?: string;
  listButtonLabel?: string;
  listSections?: ListSection[];
  catalogId?: string;
  productRetailerId?: string;
  productSections?: ProductSection[];
  thumbnailProductRetailerId?: string;
  carouselCards?: CarouselCard[];
  lto?: LtoOffer;
}

export class InteractiveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InteractiveValidationError';
  }
}

const CORE_LIMITS = {
  header: 60,
  body: 1024,
  footer: 60,
  buttonTitle: 20,
  buttonId: 256,
  listButtonLabel: 20,
  sectionTitle: 24,
  rowTitle: 24,
  rowDescription: 72,
  rowId: 200,
  maxButtons: 3,
  maxSections: 10,
  maxRowsPerSection: 10,
  maxTotalRows: 10,
  ctaDisplayText: 20,
} as const;

type CoreInteractiveMode = 'reply' | 'cta_url' | 'cta_call' | 'list';

function assertMaxLength(value: string, max: number, field: string) {
  if (value.length > max) {
    throw new InteractiveValidationError(`${field} must be at most ${max} characters`);
  }
}

function buildHeaderFooter(options: Pick<InteractiveMessageOptions, 'header' | 'footer'>) {
  const header = options.header?.trim();
  const footer = options.footer?.trim();
  return {
    ...(header ? { header: { type: 'text' as const, text: header } } : {}),
    ...(footer ? { footer: { text: footer } } : {}),
  };
}

export function validateInteractive(options: InteractiveMessageOptions): void {
  const mode = options.mode;

  if (mode === 'carousel') {
    const cards = options.carouselCards || [];
    if (cards.length < 2) {
      throw new InteractiveValidationError('Carousel messages require at least 2 cards');
    }
    if (cards.length > 10) {
      throw new InteractiveValidationError('Carousel messages cannot exceed 10 cards');
    }
    return;
  }

  if (mode === 'product_list') {
    const totalProducts = (options.productSections || []).reduce(
      (sum, s) => sum + s.productRetailerIds.length,
      0
    );
    if (totalProducts > 30) {
      throw new InteractiveValidationError('Product list messages cannot exceed 30 products');
    }
    return;
  }

  if (mode === 'product' || mode === 'catalog_message' || mode === 'lto') {
    return;
  }

  const coreMode = mode as CoreInteractiveMode;
  if (!['reply', 'cta_url', 'cta_call', 'list'].includes(coreMode)) return;

  const header = options.header?.trim();
  const body = options.body?.trim();
  const footer = options.footer?.trim();

  if (!body) {
    throw new InteractiveValidationError('Body text is required');
  }

  if (header) assertMaxLength(header, CORE_LIMITS.header, 'Header');
  assertMaxLength(body, CORE_LIMITS.body, 'Body');
  if (footer) assertMaxLength(footer, CORE_LIMITS.footer, 'Footer');

  switch (coreMode) {
    case 'reply': {
      const buttons = options.buttons?.filter((btn) => btn.title.trim()) || [];
      if (buttons.length < 1) {
        throw new InteractiveValidationError('At least one reply button is required');
      }
      if (buttons.length > CORE_LIMITS.maxButtons) {
        throw new InteractiveValidationError(
          `Reply messages allow at most ${CORE_LIMITS.maxButtons} buttons`
        );
      }
      for (const btn of buttons) {
        if (!btn.id.trim()) {
          throw new InteractiveValidationError('Each reply button needs an id');
        }
        assertMaxLength(btn.id.trim(), CORE_LIMITS.buttonId, 'Button id');
        assertMaxLength(btn.title.trim(), CORE_LIMITS.buttonTitle, 'Button title');
      }
      break;
    }
    case 'cta_url': {
      const url = options.ctaUrl?.trim();
      if (!url) throw new InteractiveValidationError('CTA URL is required');
      if (!url.startsWith('https://')) {
        throw new InteractiveValidationError('CTA URL must use https://');
      }
      assertMaxLength((options.ctaLabel || 'Open link').trim(), CORE_LIMITS.ctaDisplayText, 'CTA label');
      break;
    }
    case 'cta_call': {
      const phone = options.ctaPhone?.trim();
      if (!phone) throw new InteractiveValidationError('CTA phone number is required');
      const tel = phone.replace(/[^\d+]/g, '');
      if (!/^\+?\d{8,15}$/.test(tel)) {
        throw new InteractiveValidationError('CTA phone number must be valid E.164');
      }
      assertMaxLength((options.ctaLabel || 'Call us').trim(), CORE_LIMITS.ctaDisplayText, 'CTA label');
      break;
    }
    case 'list': {
      const sections = options.listSections || [];
      if (!sections.length) {
        throw new InteractiveValidationError('List message requires at least one section');
      }
      if (sections.length > CORE_LIMITS.maxSections) {
        throw new InteractiveValidationError(
          `List messages allow at most ${CORE_LIMITS.maxSections} sections`
        );
      }

      const totalRows = sections.reduce((sum, section) => sum + section.rows.length, 0);
      if (totalRows < 1) {
        throw new InteractiveValidationError('List message requires at least one row');
      }
      if (totalRows > CORE_LIMITS.maxTotalRows) {
        throw new InteractiveValidationError(
          `List messages allow at most ${CORE_LIMITS.maxTotalRows} rows total (got ${totalRows})`
        );
      }

      assertMaxLength(
        (options.listButtonLabel || 'Menu').trim(),
        CORE_LIMITS.listButtonLabel,
        'List button label'
      );

      for (const section of sections) {
        if (section.title) {
          assertMaxLength(section.title.trim(), CORE_LIMITS.sectionTitle, 'Section title');
        }
        if (section.rows.length > CORE_LIMITS.maxRowsPerSection) {
          throw new InteractiveValidationError(
            `Each list section allows at most ${CORE_LIMITS.maxRowsPerSection} rows`
          );
        }
        for (const row of section.rows) {
          if (!row.id.trim()) throw new InteractiveValidationError('Each list row needs an id');
          if (!row.title.trim()) throw new InteractiveValidationError('Each list row needs a title');
          assertMaxLength(row.id.trim(), CORE_LIMITS.rowId, 'Row id');
          assertMaxLength(row.title.trim(), CORE_LIMITS.rowTitle, 'Row title');
          if (row.description?.trim()) {
            assertMaxLength(row.description.trim(), CORE_LIMITS.rowDescription, 'Row description');
          }
        }
      }
      break;
    }
  }
}

export function buildInteractivePayload(
  phone: string,
  options: InteractiveMessageOptions
): SendMessagePayload {
  const isCoreMode = ['reply', 'cta_url', 'cta_call', 'list'].includes(options.mode);
  if (isCoreMode) {
    validateInteractive(options);
  }

  const body = isCoreMode ? options.body.trim() : options.body.slice(0, 1024);
  const chrome = isCoreMode ? buildHeaderFooter(options) : {};

  if (options.mode === 'product' && options.catalogId && options.productRetailerId) {
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text: body },
        action: {
          catalog_id: options.catalogId,
          product_retailer_id: options.productRetailerId,
        },
      },
    };
  }

  if (options.mode === 'product_list' && options.catalogId && options.productSections?.length) {
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'product_list',
        ...(options.header ? { header: { type: 'text', text: options.header.slice(0, 60) } } : {}),
        body: { text: body },
        ...(options.footer ? { footer: { text: options.footer.slice(0, 60) } } : {}),
        action: {
          catalog_id: options.catalogId,
          sections: options.productSections.slice(0, 10).map((section) => ({
            title: section.title?.slice(0, 24),
            product_items: section.productRetailerIds.slice(0, 30).map((id) => ({
              product_retailer_id: id,
            })),
          })),
        },
      },
    };
  }

  if (options.mode === 'catalog_message' && options.catalogId) {
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'catalog_message',
        body: { text: body },
        action: {
          name: 'catalog_message',
          parameters: {
            ...(options.thumbnailProductRetailerId
              ? { thumbnail_product_retailer_id: options.thumbnailProductRetailerId }
              : {}),
          },
        },
      },
    };
  }

  if (options.mode === 'carousel' && options.carouselCards?.length) {
    const cards = options.carouselCards.slice(0, 10);

    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'carousel',
        body: { text: body },
        action: {
          cards: cards.map((card, index) => {
            const cardIndex = card.cardIndex ?? index;
            if (card.type === 'cta_url' && card.ctaUrl) {
              return {
                card_index: cardIndex,
                type: 'cta_url',
                ...(card.headerImageUrl
                  ? { header: { type: 'image', image: { link: card.headerImageUrl } } }
                  : card.headerVideoUrl
                    ? { header: { type: 'video', video: { link: card.headerVideoUrl } } }
                    : {}),
                body: { text: card.body.slice(0, 160) },
                action: {
                  name: 'cta_url',
                  parameters: {
                    display_text: (card.ctaLabel || 'View').slice(0, 20),
                    url: card.ctaUrl,
                  },
                },
              };
            }
            return {
              card_index: cardIndex,
              type: 'quick_reply',
              ...(card.headerImageUrl
                ? { header: { type: 'image', image: { link: card.headerImageUrl } } }
                : {}),
              body: { text: card.body.slice(0, 160) },
              action: {
                buttons: (card.buttons || []).slice(0, 3).map((btn) => ({
                  type: 'reply',
                  reply: { id: btn.id, title: btn.title.slice(0, 20) },
                })),
              },
            };
          }),
        },
      },
    };
  }

  if (options.mode === 'lto' && options.lto) {
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'limited_time_offer',
        body: { text: body },
        action: {
          name: 'limited_time_offer',
          parameters: {
            limited_time_offer: {
              text: options.lto.text.slice(0, 16),
              expiration_time_ms: options.lto.expirationTimeMs,
            },
          },
        },
      },
    };
  }

  if (options.mode === 'cta_url' && options.ctaUrl) {
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: body },
        ...chrome,
        action: {
          name: 'cta_url',
          parameters: {
            display_text: (options.ctaLabel || 'Open link').trim(),
            url: options.ctaUrl.trim(),
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
        ...chrome,
        action: {
          name: 'cta_url',
          parameters: {
            display_text: (options.ctaLabel || 'Call us').trim(),
            url: `tel:${tel}`,
          },
        },
      },
    };
  }

  if (options.mode === 'list' && options.listSections?.length) {
    return {
      to: phone,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        ...chrome,
        action: {
          button: (options.listButtonLabel || 'Menu').trim(),
          sections: options.listSections.map((section) => ({
            ...(section.title?.trim() ? { title: section.title.trim() } : {}),
            rows: section.rows.map((row) => ({
              id: row.id.trim(),
              title: row.title.trim(),
              ...(row.description?.trim() ? { description: row.description.trim() } : {}),
            })),
          })),
        },
      },
    };
  }

  const replyButtons = (options.buttons || []).filter((btn) => btn.title.trim());

  return {
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      ...chrome,
      action: {
        buttons: (isCoreMode ? replyButtons : replyButtons.slice(0, 3)).map((btn) => ({
          type: 'reply' as const,
          reply: {
            id: btn.id.trim(),
            title: isCoreMode ? btn.title.trim() : btn.title.slice(0, 20),
          },
        })),
      },
    },
  };
}
