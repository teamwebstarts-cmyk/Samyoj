import { buildCopy, refineText } from "./copy";
import type {
  ArtKey,
  BgKey,
  Channel,
  Draft,
  HandoffPayload,
  Language,
  OutputId,
  Pack,
  PackContext,
  Photo,
  Slide,
  SlideElement,
  SlideKind,
  VisualSet,
} from "./types";
import { emailPosterUrlFromPack } from "../../../utils/studioHandoffMedia";

export const MAX_BRIEF = 2000;
export const MIN_SLIDES = 2;
export const MAX_SLIDES = 10;
export const MAX_PHOTOS = 10;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const IG_LIMIT = 2200;
/** Image outputs are generated posters: users pick/regenerate/variant — no editing. */
export const MAX_IMAGE_OPTIONS = 6;

export const uid = () => Math.random().toString(36).slice(2, 9);

/* ------------------------------------------------------------------ */
/* Static mock data                                                    */
/* ------------------------------------------------------------------ */

export const mockBrief =
  "Diwali 20% off this weekend for our Jaipur store. Create a 5-slide Instagram carousel, a WhatsApp marketing template and an email with a special offer. Use warm festive colors, diyas and premium skincare product photos.";

export const mockBriefOutputs: OutputId[] = ["ig_carousel", "whatsapp", "email"];

export const OUTPUT_OPTIONS: { id: OutputId; title: string; desc: string; channel: Channel }[] = [
  { id: "ig_image", title: "Instagram Image", desc: "Generated image + starting caption", channel: "instagram" },
  { id: "ig_carousel", title: "Instagram Carousel", desc: "Multiple slides + caption", channel: "instagram" },
  { id: "whatsapp", title: "WhatsApp Template", desc: "Template structure + copy", channel: "whatsapp" },
  { id: "email", title: "Email", desc: "Subject + body", channel: "email" },
];

export const LANGUAGES: Language[] = ["English", "Hindi", "Hinglish"];

export const EXAMPLE_IDEAS = [
  {
    id: "flash",
    title: "Weekend flash sale",
    desc: "Quick poster, WhatsApp ping, and short email.",
    brief:
      "48-hour flash sale this weekend only: 15% off our bestsellers. Create one Instagram poster, a WhatsApp template with the dates and code FLASH15, and a short email. Urgent but friendly tone, one hero product, clean layout.",
    outputs: ["ig_image", "whatsapp", "email"] as OutputId[],
    tone: "festive" as const,
  },
  {
    id: "launch",
    title: "Product launch",
    desc: "Clean launch carousel plus an announcement email.",
    brief:
      "Launch our new Vitamin C glow serum this Friday. Audience is existing customers who already buy moisturiser. Create a 4-slide Instagram carousel and an email: what it is, who it is for, the first-week launch price of ₹899, and a Shop now line. Look clean, bright, and premium. No extra discounts.",
    outputs: ["ig_carousel", "email"] as OutputId[],
    tone: "launch" as const,
  },
  {
    id: "announce",
    title: "Store opening",
    desc: "One poster and a WhatsApp invite for regulars.",
    brief:
      "Our second skincare store opens next Sunday in C Scheme, Jaipur. Invite existing customers to a morning preview, 11 am to 1 pm. Create one Instagram image and a WhatsApp template with the date, area, and a short RSVP line. Soft cream and floral, not a hard sale.",
    outputs: ["ig_image", "whatsapp"] as OutputId[],
    tone: "announce" as const,
  },
  {
    id: "tips",
    title: "Winter tips",
    desc: "Five short carousel tips with a friendly caption.",
    brief:
      "Five simple winter skincare tips for dry skin: gentle cleanser, serum on damp skin, moisturiser, lip balm, and SPF even on cloudy days. Create a 5-slide Instagram carousel and a friendly caption. One tip per slide, short lines, warm gold background, no discount and no hard sell.",
    outputs: ["ig_carousel"] as OutputId[],
    tone: "tips" as const,
  },
];

export const REFINE_SUGGESTIONS = ["Make it shorter", "More premium tone", "Add urgency", "Warmer and friendlier"];

export const GENERATION_STEPS = [
  "Understanding your brief",
  "Creating visuals and carousel slides",
  "Writing channel-ready copy",
  "Preparing your content pack",
];

/* ------------------------------------------------------------------ */
/* Brief understanding                                                 */
/* ------------------------------------------------------------------ */

export function parseContext(brief: string): PackContext {
  const b = brief.toLowerCase();
  let occasion: string | null = null;
  if (/diwali|deepavali|deepawali|दिवाली/.test(b)) occasion = "Diwali";
  else if (/festive|festival|puja|navratri|holi|eid/.test(b)) occasion = "Festive";
  const pctMatch = brief.match(/(\d{1,2})\s*%/);
  const pct = pctMatch ? Math.min(90, Math.max(1, parseInt(pctMatch[1], 10))) : null;
  const placeMatch = brief.match(/\b([A-Z][a-z]{2,})\s+store\b/);
  const place = placeMatch && !["Our", "The", "New", "Second", "Your"].includes(placeMatch[1]) ? placeMatch[1] : null;
  return { occasion, pct, place };
}

export function parseSlideCount(brief: string): number {
  const m = brief.match(/(\d{1,2})[\s-]*slide/i);
  const n = m ? parseInt(m[1], 10) : 5;
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}

/* ------------------------------------------------------------------ */
/* Slide factory                                                       */
/* ------------------------------------------------------------------ */

const el = (role: SlideElement["role"], label: string, text: string, extra: Partial<SlideElement> = {}): SlideElement => ({
  id: uid(),
  role,
  label,
  text,
  ...extra,
});

const SLIDE_ALTS: Record<SlideKind, (ctx: PackContext) => [string, string][]> = {
  hook: (c) => [
    [c.occasion ?? "Glow Naturally", "SPECIAL OFFER"],
    ["Glow Naturally", `THIS ${(c.occasion ?? "season").toUpperCase()}`],
    ["Light Up Your Skin", "FESTIVE OFFER"],
  ],
  value: () => [
    ["Premium Skincare", "for a Brighter You"],
    ["Skincare You Deserve", "crafted with care"],
    ["Pure. Gentle. Radiant.", "premium skincare"],
  ],
  benefits: () => [
    ["Natural Ingredients", "Real Results"],
    ["Skin-First Formulas", "Made to Nourish"],
    ["Simple. Gentle. Effective.", "Everyday glow"],
  ],
  gifts: () => [
    ["Perfect Gifts", "for Your Loved Ones"],
    ["Gift the Glow", "wrapped with love"],
    ["Share the Glow", "thoughtful gifting"],
  ],
  close: (c) => [
    [`Visit Our ${c.place ?? ""} Store`.replace("  ", " "), "This Weekend Only!"],
    [c.place ? `Find Us in ${c.place}` : "Find Us In Store", "See you this weekend"],
    ["Come Say Hello", c.place ? `Our ${c.place} store awaits` : "Our store awaits"],
  ],
  extra: () => [
    ["Festive Glow", "all season long"],
    ["Made With Care", "gentle on every skin"],
    ["Your Glow Routine", "cleanse · nourish · glow"],
  ],
  image: () => [
    ["Glow Naturally", "premium skincare"],
    ["Pure Radiance", "premium skincare"],
    ["Skincare, Elevated", "premium skincare"],
  ],
};

const BG_CYCLE: BgKey[] = ["maroon", "cream", "gold", "premium", "minimal"];
const ART_CYCLE: ArtKey[] = ["bottle", "bottles", "flowers", "gift", "diyas"];

function hookSlide(ctx: PackContext): Slide {
  const [h, s] = SLIDE_ALTS.hook(ctx)[0];
  const els: SlideElement[] = [
    el("headline", "Headline", h, { size: ctx.occasion ? 54 : 44 }),
    el("sub", "Label", s, { size: 15, bold: true }),
  ];
  if (ctx.pct) els.push(el("offer", "Offer", `${ctx.pct}% OFF`, { size: 38 }));
  els.push(el("sub", "Detail", "This Weekend", { size: 17 }));
  els.push(el("cta", "CTA", "SHOP NOW"));
  return { id: uid(), kind: "hook", bg: "maroon", art: "bottle", layout: "left", variant: 0, elements: els };
}

function valueSlide(ctx: PackContext): Slide {
  const [h, s] = SLIDE_ALTS.value(ctx)[0];
  return {
    id: uid(),
    kind: "value",
    bg: "cream",
    art: "bottles",
    layout: "center",
    variant: 0,
    elements: [el("headline", "Headline", h, { size: 36 }), el("sub", "Subheadline", s, { size: 17 })],
  };
}

function benefitsSlide(ctx: PackContext): Slide {
  const [h, s] = SLIDE_ALTS.benefits(ctx)[0];
  return {
    id: uid(),
    kind: "benefits",
    bg: "cream",
    art: "flowers",
    layout: "left",
    variant: 0,
    elements: [
      el("headline", "Headline", h, { size: 30 }),
      el("sub", "Subheadline", s, { size: 16, bold: true }),
      el("point", "Point 1", "Glowing Skin"),
      el("point", "Point 2", "Deep Hydration"),
      el("point", "Point 3", "Gentle & Safe"),
    ],
  };
}

function giftsSlide(ctx: PackContext): Slide {
  const [h, s] = SLIDE_ALTS.gifts(ctx)[0];
  return {
    id: uid(),
    kind: "gifts",
    bg: "gold",
    art: "gift",
    layout: "center",
    variant: 0,
    elements: [el("headline", "Headline", h, { size: 38 }), el("sub", "Subheadline", s, { size: 17 })],
  };
}

function closeSlide(ctx: PackContext): Slide {
  const [h, s] = SLIDE_ALTS.close(ctx)[0];
  return {
    id: uid(),
    kind: "close",
    bg: "maroon",
    art: "diyas",
    layout: "center",
    variant: 0,
    elements: [
      el("headline", "Headline", h, { size: 34 }),
      el("sub", "Subheadline", s, { size: 17 }),
      el("cta", "CTA", "VISIT US"),
    ],
  };
}

export function extraSlide(ctx: PackContext, k: number): Slide {
  const alts = SLIDE_ALTS.extra(ctx);
  const [h, s] = alts[k % alts.length];
  const bgs: BgKey[] = ["cream", "gold", "minimal", "premium"];
  const arts: ArtKey[] = ["flowers", "gift", "bottle", "bottles"];
  return {
    id: uid(),
    kind: "extra",
    bg: bgs[k % bgs.length],
    art: arts[k % arts.length],
    layout: "center",
    variant: 0,
    elements: [el("headline", "Headline", h, { size: 36 }), el("sub", "Subheadline", s, { size: 17 })],
  };
}

export function buildCarousel(ctx: PackContext, count: number, photos: Photo[]): Slide[] {
  const hook = hookSlide(ctx);
  const value = valueSlide(ctx);
  const benefits = benefitsSlide(ctx);
  const gifts = giftsSlide(ctx);
  const close = closeSlide(ctx);
  let slides: Slide[];
  if (count <= 2) slides = [hook, close];
  else if (count === 3) slides = [hook, benefits, close];
  else if (count === 4) slides = [hook, value, benefits, close];
  else {
    slides = [hook, value, benefits, gifts];
    for (let k = 0; k < count - 5; k++) slides.push(extraSlide(ctx, k));
    slides.push(close);
  }
  if (photos[0]) {
    const target = slides.find((s) => s.kind === "value") ?? slides[0];
    target.image = photos[0].url;
  }
  return slides;
}

export function buildImageOptions(ctx: PackContext, photos: Photo[]): Slide[] {
  const festive = !!ctx.occasion;
  const specs: { bg: BgKey; art: ArtKey; layout: "left" | "center" }[] = festive
    ? [
        { bg: "maroon", art: "bottle", layout: "left" },
        { bg: "cream", art: "bottles", layout: "center" },
        { bg: "gold", art: "flowers", layout: "center" },
      ]
    : [
        { bg: "minimal", art: "bottle", layout: "center" },
        { bg: "cream", art: "bottles", layout: "left" },
        { bg: "premium", art: "bottle", layout: "center" },
      ];
  return specs.map((s, i) => {
    const [h, sub] = SLIDE_ALTS.image(ctx)[i];
    const elements: SlideElement[] = [el("headline", "Headline", h, { size: 38 }), el("sub", "Subheadline", sub, { size: 16 })];
    if (festive && ctx.pct && i === 0) elements.push(el("offer", "Offer", `${ctx.pct}% OFF`, { size: 34 }));
    return {
      id: uid(),
      kind: "image" as const,
      ...s,
      image: i === 0 && photos[0] ? photos[0].url : null,
      variant: 0,
      elements,
    };
  });
}

export function regenerateSlide(slide: Slide, ctx: PackContext, index: number): Slide {
  const variant = slide.variant + 1;
  const alts = SLIDE_ALTS[slide.kind](ctx);
  const [h, s] = alts[variant % alts.length];
  const bgIdx = BG_CYCLE.indexOf(slide.bg);
  const artIdx = ART_CYCLE.indexOf(slide.art);
  let headlineDone = false;
  let subDone = false;
  const elements = slide.elements.map((e) => {
    if (e.role === "headline" && !headlineDone) {
      headlineDone = true;
      return { ...e, text: h };
    }
    if (e.role === "sub" && !subDone && e.label !== "Detail") {
      subDone = true;
      return { ...e, text: s, color: undefined };
    }
    return { ...e, color: undefined };
  });
  return {
    ...slide,
    variant,
    bg: BG_CYCLE[(bgIdx + 1 + (index % 2)) % BG_CYCLE.length],
    art: slide.image ? slide.art : ART_CYCLE[(artIdx + 1) % ART_CYCLE.length],
    layout: slide.layout === "left" ? "center" : "left",
    elements: elements.map((e) => ({ ...e, color: undefined })),
  };
}

/**
 * A fresh variant of an existing slide — a NEW slide (different composition,
 * art and copy) rather than an in-place edit, since generated posters cannot
 * be text-edited. User photos carry over so the product stays recognisable.
 */
export function variantSlide(slide: Slide, ctx: PackContext, index: number): Slide {
  const regenerated = regenerateSlide(slide, ctx, index);
  return {
    ...regenerated,
    id: uid(),
    image: slide.image ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Pack builder (synchronous core of the mock "API")                   */
/* ------------------------------------------------------------------ */

export interface GenerateInput {
  brief: string;
  language: Language;
  outputs: OutputId[];
  photos: Photo[];
}

function draftName(ctx: PackContext, brief: string): string {
  const place = ctx.place ? ` — ${ctx.place} Store` : "";
  if (ctx.occasion) return `${ctx.occasion} Campaign${place}`;
  const words = brief.replace(/\s+/g, " ").trim().split(" ").slice(0, 5).join(" ");
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/[.,;:]+$/, "") + place;
}

export function buildPack(input: GenerateInput, copyVariant = 0): Pack {
  const ctx = parseContext(input.brief);
  const copy = buildCopy(ctx, input.language, copyVariant);
  const hasIg = input.outputs.includes("ig_carousel") || input.outputs.includes("ig_image");
  const pack: Pack = {
    id: uid(),
    name: draftName(ctx, input.brief),
    brief: input.brief,
    language: input.language,
    outputs: OUTPUT_OPTIONS.map((o) => o.id).filter((id) => input.outputs.includes(id)),
    photos: input.photos,
    ctx,
    copyVariant,
    handedOff: {},
  };
  if (input.outputs.includes("ig_carousel")) pack.carousel = buildCarousel(ctx, parseSlideCount(input.brief), input.photos);
  if (input.outputs.includes("ig_image")) pack.image = { options: buildImageOptions(ctx, input.photos), selected: 0 };
  if (hasIg) pack.instagram = { caption: copy.caption, hashtags: copy.hashtags };
  if (input.outputs.includes("whatsapp")) {
    pack.whatsapp = {
      name: `${(ctx.occasion ?? "special").toLowerCase()}_offer_${ctx.pct ?? "promo"}`,
      category: "Marketing",
      language: input.language,
      header: { type: "IMAGE", source: pack.carousel ? "Image (from Slide 1)" : pack.image ? "Image (selected option)" : "Image" },
      body: copy.waBody,
      footer: copy.waFooter,
      buttons: [
        { id: uid(), label: copy.waButtons[0], type: "URL", url: "https://samyoj.example/store" },
        { id: uid(), label: copy.waButtons[1], type: "URL", url: "https://samyoj.example/products" },
      ],
      examples: { "1": copy.waExample },
    };
  }
  if (input.outputs.includes("email")) pack.email = { subject: copy.emailSubject, body: copy.emailBody };
  return pack;
}

/** Simulated async generation with progressive steps. */
export async function generateStudioPack(
  input: GenerateInput,
  onStep: (step: number) => void,
  signal: { cancelled: boolean },
): Promise<Pack> {
  if (!input.brief.trim()) throw new Error("Please describe your idea first.");
  if (input.outputs.length === 0) throw new Error("Select at least one content type.");
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const durations = [900, 1300, 1200, 800];
  for (let i = 0; i < durations.length; i++) {
    onStep(i);
    await wait(durations[i]);
    if (signal.cancelled) throw new Error("cancelled");
    if (i === 1 && /simulate error/i.test(input.brief)) throw new Error("generation_failed");
  }
  return buildPack(input);
}

export function regenerateCopy(pack: Pack, channel: Channel | "all"): Pack {
  const variant = pack.copyVariant + 1;
  const copy = buildCopy(pack.ctx, pack.language, variant);
  const next: Pack = { ...pack, copyVariant: variant };
  if ((channel === "instagram" || channel === "all") && pack.instagram) {
    next.instagram = { caption: copy.caption, hashtags: copy.hashtags };
  }
  if ((channel === "whatsapp" || channel === "all") && pack.whatsapp) {
    next.whatsapp = {
      ...pack.whatsapp,
      body: copy.waBody,
      footer: copy.waFooter,
      buttons: pack.whatsapp.buttons.map((b, i) => ({ ...b, label: copy.waButtons[i] ?? b.label })),
    };
  }
  if ((channel === "email" || channel === "all") && pack.email) {
    next.email = { subject: copy.emailSubject, body: copy.emailBody };
  }
  return next;
}

export function regenerateAll(pack: Pack): Pack {
  const next = regenerateCopy(pack, "all");
  if (pack.carousel) next.carousel = pack.carousel.map((s, i) => regenerateSlide(s, pack.ctx, i));
  if (pack.image) next.image = { ...pack.image, options: pack.image.options.map((s, i) => regenerateSlide(s, pack.ctx, i)) };
  next.handedOff = {};
  return next;
}

export function refinePack(pack: Pack, instruction: string): Pack {
  const next: Pack = { ...pack };
  if (pack.instagram) next.instagram = { ...pack.instagram, caption: refineText(pack.instagram.caption, instruction) };
  if (pack.whatsapp) next.whatsapp = { ...pack.whatsapp, body: refineText(pack.whatsapp.body, instruction) };
  if (pack.email) {
    const premium = /premium|luxur|elegant|classy/i.test(instruction);
    next.email = {
      subject: premium ? pack.email.subject.replace(/ 🎁/g, "") : pack.email.subject,
      body: refineText(pack.email.body, instruction),
    };
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Visual-set helpers                                                  */
/* ------------------------------------------------------------------ */

export function getSlides(pack: Pack, set: VisualSet): Slide[] {
  return set === "carousel" ? pack.carousel ?? [] : pack.image?.options ?? [];
}

export function setSlides(pack: Pack, set: VisualSet, slides: Slide[]): Pack {
  if (set === "carousel") return { ...pack, carousel: slides };
  return pack.image ? { ...pack, image: { ...pack.image, options: slides } } : pack;
}

export function newBlankSlide(pack: Pack, count: number): Slide {
  return extraSlide(pack.ctx, count);
}

/* ------------------------------------------------------------------ */
/* Hand-off payloads (shape of the future deep-link payloads)          */
/* ------------------------------------------------------------------ */

function usableImageUrl(value: string | null | undefined): string | undefined {
  const url = value?.trim();
  if (!url) return undefined;
  if (url.startsWith("/api/media/") || /^https?:\/\//.test(url)) return url;
  return undefined;
}

/** Selected header path first, so later sends attach that image, not slide 1. */
function headerPathFirst(pack: Pack, headerUrl?: string): string[] {
  const paths = (pack.mediaPaths || []).filter((path) => path && !path.includes(".."));
  const match = headerUrl?.match(/\/api\/media\/public\/([^?#]+)/);
  const selected = match ? decodeURIComponent(match[1]) : "";
  if (!selected) return paths;
  return [selected, ...paths.filter((path) => path !== selected)];
}

export function buildHandoff(pack: Pack, channel: Channel): HandoffPayload {
  if (channel === "instagram") {
    const slides = pack.carousel ?? [];
    const useCarousel = slides.length > 1;
    const caption = `${pack.instagram?.caption ?? ""}\n\n${pack.instagram?.hashtags ?? ""}`.trim();
    const mediaCount = useCarousel ? slides.length : 1;
    return {
      channel,
      destination: "Instagram Posts",
      summary: [
        useCarousel ? `Carousel · ${mediaCount} slides` : "Image · selected option",
        `Caption · ${caption.length} characters`,
        "Ratio · 1:1 (1080 × 1080)",
      ],
      data: {
        route: `/instagram/posts?studioPack=${pack.id}`,
        packId: pack.id,
        mediaType: useCarousel ? "CAROUSEL" : "IMAGE",
        slideUrls: useCarousel ? slides.map((s) => `studio://${pack.id}/${s.id}.png`) : [`studio://${pack.id}/image-${(pack.image?.selected ?? 0) + 1}.png`],
        caption,
        ratio: "1:1",
      },
    };
  }
  if (channel === "whatsapp") {
    const t = pack.whatsapp!;
    const headerMediaUrl = usableImageUrl(t.header.source);
    return {
      channel,
      destination: "WhatsApp Templates",
      summary: [`Category · ${t.category}`, `Header · ${headerMediaUrl || "none"}`, `Body · ${t.body.length} characters`, `Buttons · ${t.buttons.map((b) => b.label).join(", ")}`],
      data: {
        route: `/templates/new?studioPack=${pack.id}`,
        packId: pack.id,
        name: t.name,
        category: t.category,
        language: t.language,
        headerMediaUrl,
        mediaPaths: headerPathFirst(pack, headerMediaUrl),
        components: [
          { type: "HEADER", format: "IMAGE" },
          { type: "BODY", text: t.body, example: { body_text: [Object.values(t.examples)] } },
          { type: "FOOTER", text: t.footer },
          { type: "BUTTONS", buttons: t.buttons.map((b) => ({ type: b.type, text: b.label, url: b.url })) },
        ],
      },
    };
  }
  const e = pack.email!;
  return {
    channel,
    destination: "Email Compose",
    summary: [`Subject · ${e.subject.length} characters`, `Body · ${e.body.split(/\s+/).length} words`, "Personalisation · {{name}}"],
      data: {
        route: `/email/compose?studioPack=${pack.id}`,
        packId: pack.id,
        subject: e.subject,
        body: e.body,
        mediaUrl:
          pack.carousel?.[0]?.image ||
          pack.image?.options[pack.image.selected]?.image ||
          undefined,
      },
  };
}

/** Meta template language codes for the wizard (Hinglish submits as English). */
export function wizardLanguage(lang: Language): string {
  if (lang === "Hindi") return "hi";
  return "en_US";
}

export interface HandoffNavState {
  studioPack: string;
  studioHandoff: true;
  studioName: string;
  headerMediaUrl?: string;
  mediaUrl?: string;
  mediaPaths?: string[];
  [key: string]: unknown;
}

/**
 * Router state consumed by the destination pages:
 *  - Instagram Posts → caption + media prefill, user confirms the post
 *  - WhatsApp Templates → full wizard form (body, footer, buttons, examples)
 *  - Email Compose → subject + body + the generated poster as an attachment
 *    (AiStudio attaches the rendered PNG File during the opening phase).
 */
export function buildHandoffState(pack: Pack, channel: Channel): HandoffNavState {
  if (channel === "instagram") {
    const caption = `${pack.instagram?.caption ?? ""}\n\n${pack.instagram?.hashtags ?? ""}`.trim();
    const useCarousel = (pack.carousel?.length ?? 0) > 1;
    return {
      studioPack: pack.id,
      studioHandoff: true,
      studioName: pack.name,
      mediaPaths: (pack as Pack & { mediaPaths?: string[] }).mediaPaths,
      mediaType: useCarousel ? "CAROUSEL" : "IMAGE",
      caption,
      mediaCount: useCarousel ? pack.carousel!.length : 1,
    };
  }
  if (channel === "whatsapp") {
    const t = pack.whatsapp!;
    const headerMediaUrl = usableImageUrl(t.header.source);
    return {
      studioPack: pack.id,
      studioHandoff: true,
      studioName: pack.name,
      headerMediaUrl,
      mediaPaths: headerPathFirst(pack, headerMediaUrl),
      form: {
        name: t.name,
        language: wizardLanguage(t.language),
        category: "MARKETING",
        body: t.body,
        header: "",
        headerFormat: headerMediaUrl ? "IMAGE" : "NONE",
        headerMediaHandle: "",
        footer: t.footer,
        buttons: t.buttons.map((b) => ({ type: b.type, text: b.label, url: b.url, phone_number: "", example: "" })),
        bodyExamples: Object.values(t.examples),
        headerExamples: [],
        variableMeta: [],
        addSecurityRecommendation: true,
        authType: "OTP",
      },
    };
  }
  return {
    studioPack: pack.id,
    studioHandoff: true,
    studioName: pack.name,
    subject: pack.email!.subject,
    body: pack.email!.body,
    mediaUrl: emailPosterUrlFromPack(pack),
  };
}

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

const DAY = 86400000;

function seedDraft(name: string, brief: string, outputs: OutputId[], ago: number): Draft {
  const pack = buildPack({ brief, language: "English", outputs, photos: [] });
  pack.name = name;
  pack.sample = true;
  return { id: uid(), name, pack, savedAt: Date.now() - ago };
}

export const mockDrafts: Draft[] = [
  seedDraft(
    "Diwali 20% Off — Jaipur Store",
    "Diwali 20% off this weekend for our Jaipur store. Create a 5-slide Instagram carousel, a WhatsApp template and an email.",
    ["ig_carousel", "whatsapp", "email"],
    3 * 60000,
  ),
  seedDraft(
    "Summer Launch",
    "Launch our new summer glow serum with 15% off for Jaipur store customers. Create a 4-slide Instagram carousel and an email.",
    ["ig_carousel", "email"],
    2 * DAY,
  ),
  seedDraft(
    "Winter Skincare Tips",
    "Create a clean Instagram product hero for our premium winter skincare range.",
    ["ig_image"],
    5 * DAY,
  ),
];

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "Saved just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `Saved ${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Saved ${h} hr ago`;
  const d = Math.floor(h / 24);
  return `Saved ${d} day${d > 1 ? "s" : ""} ago`;
}

export function outputSummary(outputs: OutputId[]): string {
  const hasIg = outputs.some((o) => o === "ig_image" || o === "ig_carousel");
  const parts: string[] = [];
  if (hasIg) parts.push("Instagram");
  if (outputs.includes("whatsapp")) parts.push("WhatsApp");
  if (outputs.includes("email")) parts.push("Email");
  return parts.join(" + ");
}

export function clonePack(p: Pack): Pack {
  return JSON.parse(JSON.stringify(p)) as Pack;
}
