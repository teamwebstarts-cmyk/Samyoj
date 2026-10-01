import crypto from 'crypto';

const BG_CYCLE = ['maroon', 'cream', 'gold', 'premium', 'minimal'] as const;
const ART_CYCLE = ['bottle', 'bottles', 'flowers', 'gift', 'diyas', 'none'] as const;
const KIND_CYCLE = ['hook', 'value', 'benefits', 'gifts', 'close', 'extra'] as const;

function sid(prefix = 'el'): string {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function parseSlideCount(brief: string): number {
  const m = brief.match(/(\d+)\s*[- ]?slide/i);
  if (m) return Math.min(10, Math.max(2, Number.parseInt(m[1], 10)));
  return 5;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function buildSlide(
  kind: string,
  bg: string,
  art: string,
  layout: 'left' | 'center',
  copy: { headline: string; sub: string; offer?: string; cta?: string },
) {
  const elements: Array<Record<string, string>> = [
    { id: sid(), role: 'headline', label: 'Headline', text: copy.headline || 'Your headline' },
    { id: sid(), role: 'sub', label: 'Subheadline', text: copy.sub || '' },
  ];
  if (copy.offer) elements.push({ id: sid(), role: 'offer', label: 'Offer', text: copy.offer });
  if (copy.cta) elements.push({ id: sid(), role: 'cta', label: 'CTA', text: copy.cta });
  return {
    id: sid('sl'),
    kind,
    bg,
    art,
    layout,
    image: null,
    variant: 0,
    elements,
  };
}

function normalizeCarouselSlides(
  raw: unknown,
  brief: string,
): Array<{ headline: string; sub: string; offer?: string; cta?: string }> {
  const want = parseSlideCount(brief);
  const list = Array.isArray(raw) ? raw : [];
  const slides = list
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        headline: str(row.headline),
        sub: str(row.sub),
        offer: str(row.offer) || undefined,
        cta: str(row.cta) || undefined,
      };
    })
    .filter((s) => s.headline || s.sub);

  while (slides.length < want) {
    slides.push({
      headline: slides[0]?.headline || 'Special offer',
      sub: slides[0]?.sub || 'Visit us this weekend',
      offer: undefined,
      cta: undefined,
    });
  }
  return slides.slice(0, want);
}

export function assembleStudioPack(
  raw: Record<string, unknown>,
  opts: {
    brief: string;
    language: string;
    outputs: string[];
    packId: string;
    photoNames?: string[];
  },
): Record<string, unknown> {
  const ctxRaw = (raw.ctx && typeof raw.ctx === 'object' ? raw.ctx : {}) as Record<string, unknown>;
  const ctx = {
    occasion: str(ctxRaw.occasion) || null,
    pct: numOrNull(ctxRaw.pct),
    place: str(ctxRaw.place) || null,
  };

  const pack: Record<string, unknown> = {
    id: opts.packId,
    name: str(raw.name) || opts.brief.slice(0, 40),
    brief: opts.brief,
    language: opts.language,
    outputs: opts.outputs,
    photos: (opts.photoNames || []).map((name) => ({
      id: sid('ph'),
      name,
      url: '',
      size: 0,
    })),
    ctx,
    copyVariant: 0,
    handedOff: {},
  };

  const hasIg = opts.outputs.some((o) => o === 'ig_carousel' || o === 'ig_image');
  if (hasIg) {
    const ig = (raw.instagram && typeof raw.instagram === 'object' ? raw.instagram : {}) as Record<
      string,
      unknown
    >;
    pack.instagram = {
      caption: str(ig.caption),
      hashtags: str(ig.hashtags),
    };
  }

  if (opts.outputs.includes('ig_carousel')) {
    const copies = normalizeCarouselSlides(raw.carouselSlides, opts.brief);
    pack.carousel = copies.map((copy, i) =>
      buildSlide(
        KIND_CYCLE[Math.min(i, KIND_CYCLE.length - 1)],
        BG_CYCLE[i % BG_CYCLE.length],
        'none',
        i % 2 === 0 ? 'left' : 'center',
        copy,
      ),
    );
  }

  if (opts.outputs.includes('ig_image')) {
    const imageCopy = (raw.imageCopy && typeof raw.imageCopy === 'object'
      ? raw.imageCopy
      : {}) as Record<string, unknown>;
    const headline = str(imageCopy.headline) || str(raw.name) || 'Glow naturally';
    const sub = str(imageCopy.sub) || 'Premium skincare';
    pack.image = {
      selected: 0,
      options: [0, 1, 2].map((i) =>
        buildSlide('image', BG_CYCLE[i % BG_CYCLE.length], 'none', i === 1 ? 'left' : 'center', {
          headline,
          sub,
          offer: ctx.pct ? `${ctx.pct}% OFF` : undefined,
        }),
      ),
    };
  }

  if (opts.outputs.includes('whatsapp')) {
    const wa = (raw.whatsapp && typeof raw.whatsapp === 'object' ? raw.whatsapp : {}) as Record<string, unknown>;
    const examples =
      wa.examples && typeof wa.examples === 'object' ? (wa.examples as Record<string, string>) : { '1': 'Customer' };
    pack.whatsapp = {
      name: str(wa.name, 'marketing_offer').replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 40),
      category: 'Marketing',
      language: opts.language,
      header: { type: 'IMAGE', source: 'Image' },
      body: str(wa.body),
      footer: str(wa.footer, 'Reply STOP to opt out'),
      buttons: [
        {
          id: sid('btn'),
          label: str(wa.buttonLabel, 'Shop now'),
          type: 'URL',
          url: str(wa.buttonUrl, 'https://example.com'),
        },
      ],
      examples,
    };
  }

  if (opts.outputs.includes('email')) {
    const em = (raw.email && typeof raw.email === 'object' ? raw.email : {}) as Record<string, unknown>;
    pack.email = {
      subject: str(em.subject),
      body: str(em.body),
    };
  }

  return pack;
}
