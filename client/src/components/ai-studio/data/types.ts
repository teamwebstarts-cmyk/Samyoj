export type OutputId = "ig_image" | "ig_carousel" | "whatsapp" | "email";
export type Language = "English" | "Hindi" | "Hinglish";
export type BgKey = "maroon" | "cream" | "gold" | "minimal" | "premium";
export type ArtKey = "bottle" | "bottles" | "diyas" | "gift" | "flowers" | "none";
export type Role = "headline" | "sub" | "offer" | "cta" | "point";
export type SlideKind = "hook" | "value" | "benefits" | "gifts" | "close" | "extra" | "image";
export type Channel = "instagram" | "whatsapp" | "email";
export type VisualSet = "carousel" | "image";

export interface SlideElement {
  id: string;
  role: Role;
  label: string;
  text: string;
  font?: string;
  size?: number;
  color?: string;
  bold?: boolean;
}

export interface Slide {
  id: string;
  kind: SlideKind;
  bg: BgKey;
  art: ArtKey;
  layout: "left" | "center";
  image?: string | null;
  variant: number;
  elements: SlideElement[];
}

export interface Photo {
  id: string;
  name: string;
  url: string;
  size: number;
}

export interface WaButton {
  id: string;
  label: string;
  type: "URL";
  url: string;
}

export interface WhatsAppTemplate {
  name: string;
  category: "Marketing";
  language: Language;
  header: { type: "IMAGE"; source: string };
  body: string;
  footer: string;
  buttons: WaButton[];
  examples: Record<string, string>;
}

export interface EmailPack {
  subject: string;
  body: string;
}

export interface InstagramPack {
  caption: string;
  hashtags: string;
}

export interface PackContext {
  occasion: string | null;
  pct: number | null;
  place: string | null;
}

export interface Pack {
  id: string;
  name: string;
  brief: string;
  language: Language;
  outputs: OutputId[];
  photos: Photo[];
  ctx: PackContext;
  copyVariant: number;
  carousel?: Slide[];
  image?: { options: Slide[]; selected: number };
  instagram?: InstagramPack;
  whatsapp?: WhatsAppTemplate;
  email?: EmailPack;
  handedOff: Partial<Record<Channel, boolean>>;
}

export interface Draft {
  id: string;
  name: string;
  pack: Pack;
  savedAt: number;
}

export interface HandoffPayload {
  channel: Channel;
  destination: string;
  summary: string[];
  data: Record<string, unknown>;
}
