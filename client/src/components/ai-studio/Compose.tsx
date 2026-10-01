import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, Globe, ImagePlus, Lightbulb, Plus, Sparkles, X } from "lucide-react";
import type { Language, OutputId, Photo, Slide } from "./data/types";
import type { Draft } from "./data/types";
import type { HistoryEntry } from "../../utils/aiStudioStore";
import { EXAMPLE_IDEAS, LANGUAGES, MAX_BRIEF, MAX_PHOTOS, MAX_PHOTO_BYTES, OUTPUT_OPTIONS, uid } from "./data/mock";
import { ChannelIcon, GmailIcon, InstagramIcon, WhatsAppIcon } from "./brand";
import { SlideArt } from "./SlideArt";
import { SessionShelf } from "./Overlays";

/* ------------------------------ Hero ------------------------------ */

const heroSlide: Slide = {
  id: "hero",
  kind: "image",
  bg: "cream",
  art: "bottle",
  layout: "left",
  variant: 0,
  elements: [
    { id: "h", role: "headline", label: "Headline", text: "Glow Naturally", size: 36 },
    { id: "o", role: "offer", label: "Offer", text: "20% OFF", size: 30 },
  ],
};

function Hero() {
  return (
    <section className="hero-bg relative overflow-hidden rounded-[24px] border border-white/10 px-6 py-7 shadow-[0_24px_60px_rgba(20,18,55,0.18)] sm:px-9 sm:py-9 lg:min-h-[210px] lg:pr-[300px] 2xl:pr-[340px]">
      <div className="relative z-10 max-w-[520px]">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#f6d8ff] backdrop-blur">
          <Sparkles size={12} /> AI creative studio
        </span>
        <h2 className="text-[28px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[34px] 2xl:text-[38px]">
          Describe your idea,
          <br />
          we'll <span className="gradient-text">create the content.</span>
        </h2>
        <p className="mt-3 max-w-[430px] text-[14px] leading-relaxed text-[#c8c6dc] sm:text-[15px]">
          Generate stunning visuals and channel-ready copy for Instagram, WhatsApp, and Email — all in one place.
        </p>
      </div>
      {/* Illustration */}
      <div className="hero-stage pointer-events-none absolute right-[-10px] top-1/2 hidden h-[220px] w-[340px] origin-right -translate-y-1/2 scale-[0.84] lg:block 2xl:scale-100" aria-hidden="true">
        <div className="hero-orbit hero-orbit--one" />
        <div className="hero-orbit hero-orbit--two" />
        <div className="hero-board anim-float absolute left-[88px] top-[18px] w-[166px] overflow-hidden rounded-[18px]">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#201c43]/90 px-3 py-2 text-[8px] font-extrabold uppercase tracking-[0.12em] text-[#d9d3ff]">
            <span>Creative board</span>
            <span className="text-[#ffbd8b]">Live</span>
          </div>
          <div className="h-[146px] p-1.5">
            <SlideArt slide={heroSlide} />
          </div>
          <div className="flex items-center gap-1.5 bg-[#15142c]/85 px-3 py-2 text-[9px] font-semibold text-[#d9d5ed]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#55e6ad] shadow-[0_0_10px_#55e6ad]" />
            One brief · 3 channels
          </div>
        </div>
        <div className="hero-channel-chip anim-float absolute left-[24px] top-[28px] grid h-12 w-12 -rotate-6 place-items-center rounded-2xl">
          <InstagramIcon size={34} />
        </div>
        <div className="hero-channel-chip anim-float absolute right-[8px] top-[4px] grid h-12 w-12 rotate-6 place-items-center rounded-2xl" style={{ animationDelay: "0.8s" }}>
          <WhatsAppIcon size={34} />
        </div>
        <div className="hero-channel-chip anim-float absolute left-[44px] top-[146px] grid h-12 w-12 rotate-3 place-items-center rounded-2xl" style={{ animationDelay: "1.6s" }}>
          <GmailIcon size={34} />
        </div>
        <div className="hero-mini-label absolute right-[2px] top-[136px] rounded-xl px-3 py-2 text-[10px] font-bold leading-tight text-white">
          One idea,
          <br />
          <span className="text-[#ffbd8b]">multiple channels</span>
        </div>
        <Sparkles size={16} className="absolute left-[10px] top-[102px] text-[#e9a9ff]" />
        <Sparkles size={13} className="absolute right-[38px] top-[84px] text-[#ffbd8b]" />
      </div>
    </section>
  );
}

/* ------------------------------ Pieces ------------------------------ */

export function LanguageSelect({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  return (
    <div>
      <label htmlFor="language" className="field-label">
        Language
      </label>
      <div className="relative">
        <Globe size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <select id="language" className="input cursor-pointer appearance-none !pl-9 !pr-8 font-semibold" value={value} onChange={(e) => onChange(e.target.value as Language)}>
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      </div>
    </div>
  );
}

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

function loadable(url: string) {
  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export function PhotoUploader({
  photos,
  onChange,
  onError,
}: {
  photos: Photo[];
  onChange: (p: Photo[]) => void;
  onError: (m: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const addFiles = async (files: FileList | File[]) => {
    onError(null);
    const next: Photo[] = [...photos];
    let failed = false;
    for (const f of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) {
        onError(`You can add up to ${MAX_PHOTOS} photos.`);
        break;
      }
      if (!ACCEPT.includes(f.type) || f.size > MAX_PHOTO_BYTES) {
        failed = true;
        continue;
      }
      const url = URL.createObjectURL(f);
      if (!(await loadable(url))) {
        URL.revokeObjectURL(url);
        failed = true;
        continue;
      }
      next.push({ id: uid(), name: f.name, url, size: f.size });
    }
    if (failed) onError("This image could not be used. Use PNG, JPG or WebP under 8 MB.");
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = (id: string) => {
    onError(null);
    const p = photos.find((x) => x.id === id);
    if (p) URL.revokeObjectURL(p.url);
    onChange(photos.filter((x) => x.id !== id));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <span className="field-label" id="photos-label">
        Add photos <small>(optional)</small>
      </span>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="photos-label">
        <input ref={inputRef} id="photo-input" type="file" accept="image/png,image/jpeg,image/webp" multiple className="peer sr-only" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
        {photos.map((p) => (
          <div key={p.id} className="anim-fade-in group relative h-[56px] w-[56px] flex-none">
            <img src={p.url} alt={`Uploaded photo: ${p.name}`} className="h-full w-full rounded-xl border border-[var(--border)] object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${p.name}`}
              onClick={() => remove(p.id)}
              className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-[var(--border-strong)] bg-white text-[var(--text-muted)] shadow-sm transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
            >
              <X size={11} strokeWidth={3} />
            </button>
          </div>
        ))}
        {photos.length === 0 ? (
          <label
            htmlFor="photo-input"
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`flex min-h-[56px] flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 py-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--ai-primary)] ${
              drag ? "border-[var(--ai-primary)] bg-[var(--ai-primary-soft)]" : "border-[var(--border-strong)] bg-[var(--surface-subtle)] hover:border-[var(--ai-primary-ring)]"
            }`}
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]">
              <ImagePlus size={18} />
            </span>
            <span className="leading-tight">
              <span className="block text-[12.5px] font-semibold">Click to upload or drag &amp; drop</span>
              <span className="text-[11px] text-[var(--text-muted)]">Product or brand photos · PNG, JPG, WebP (max {MAX_PHOTOS})</span>
            </span>
          </label>
        ) : (
          photos.length < MAX_PHOTOS && (
            <label
              htmlFor="photo-input"
              className="flex h-[56px] w-[72px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--ai-primary-ring)] hover:text-[var(--ai-primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--ai-primary)]"
            >
              <Plus size={16} />
              Add more
            </label>
          )
        )}
      </div>
    </div>
  );
}

export function OutputSelector({ value, onChange }: { value: OutputId[]; onChange: (v: OutputId[]) => void }) {
  const toggle = (id: OutputId) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <span className="field-label" id="outputs-label">
        What do you want to create? <small>(select one or more)</small>
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="outputs-label">
        {OUTPUT_OPTIONS.map((o) => {
          const on = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.id)}
              className={`relative flex min-w-0 items-center gap-1.5 rounded-xl border px-2 py-2 text-left transition-all duration-150 ${
                on
                  ? "border-2 border-[var(--ai-primary)] bg-[var(--ai-primary-soft)] px-[7px] py-[7px] shadow-[0_4px_14px_rgba(109,61,242,0.14)]"
                  : "border-[var(--border-strong)] bg-white hover:border-[var(--ai-primary-ring)] hover:bg-[var(--surface-subtle)]"
              }`}
            >
              <span
                className={`absolute right-2 top-2 grid h-[18px] w-[18px] place-items-center rounded-full border transition-colors ${
                  on ? "border-[var(--ai-primary)] bg-[var(--ai-primary)] text-white" : "border-[var(--border-strong)] bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check size={11} strokeWidth={3.5} />
              </span>
              <ChannelIcon channel={o.channel} size={19} />
              <span className="min-w-0">
                <span className="block truncate text-[10.5px] font-bold leading-tight">{o.title}</span>
                <span className="mt-0.5 block truncate text-[9px] leading-snug text-[var(--text-muted)]">{o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Examples ------------------------------ */

const sampleSlides: Record<string, Slide> = {
  festival: {
    id: "s1",
    kind: "hook",
    bg: "maroon",
    art: "bottle",
    layout: "left",
    variant: 0,
    elements: [
      { id: "a", role: "headline", label: "H", text: "Diwali", size: 46 },
      { id: "b", role: "offer", label: "O", text: "20% OFF", size: 30 },
    ],
  },
  launch: {
    id: "s2",
    kind: "value",
    bg: "minimal",
    art: "bottles",
    layout: "left",
    variant: 0,
    elements: [{ id: "a", role: "headline", label: "H", text: "New Serum", size: 34 }],
  },
  announce: {
    id: "s3",
    kind: "extra",
    bg: "cream",
    art: "flowers",
    layout: "center",
    variant: 0,
    elements: [{ id: "a", role: "headline", label: "H", text: "Opening Soon", size: 38 }],
  },
  tips: {
    id: "s4",
    kind: "extra",
    bg: "gold",
    art: "bottle",
    layout: "left",
    variant: 0,
    elements: [
      { id: "a", role: "headline", label: "H", text: "5 Skincare Tips", size: 34 },
    ],
  },
};

function Examples({ onUse }: { onUse: (id: string) => void }) {
  return (
    <section className="card p-5" aria-labelledby="examples-title">
      <div className="mb-3 flex items-center justify-between">
        <h3 id="examples-title" className="text-[14px] font-extrabold">
          Need inspiration? Try these examples
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {EXAMPLE_IDEAS.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => onUse(ex.id)}
            className="group overflow-hidden rounded-xl border border-[var(--border)] bg-white text-left transition-all hover:-translate-y-0.5 hover:border-[var(--ai-primary-ring)] hover:shadow-[var(--shadow-card)]"
          >
            <div className="aspect-[16/8] overflow-hidden">
              <div className="-mt-[8%]">
                <SlideArt slide={sampleSlides[ex.id]} label={`${ex.title} example preview`} />
              </div>
            </div>
            <div className="flex items-start gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">{ex.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--text-muted)]">{ex.desc}</p>
              </div>
              <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--ai-primary-soft)] text-[var(--ai-primary)] transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={13} />
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Side help ------------------------------ */

function SideHelp({
  drafts,
  history,
  onOpenDraft,
  onOpenHistory,
  onViewAll,
}: {
  drafts: Draft[];
  history: HistoryEntry[];
  onOpenDraft: (draft: Draft) => void;
  onOpenHistory: (entry: HistoryEntry) => void;
  onViewAll: () => void;
}) {
  const steps = [
    ["Describe your idea", "Tell us about your product, offer or content idea.", "#6d3df2", "#f1ecff"],
    ["Generate content", "We create visuals and copy tailored for each channel.", "#12a366", "#e6f7ef"],
    ["Review & edit", "Make changes to visuals, captions and messages.", "#d9890b", "#fff4e0"],
    ["Use in your channels", "Take it to Instagram Posts, WhatsApp Templates or Email Compose.", "#e5484d", "#fdecec"],
  ];
  return (
    <aside className="space-y-4" aria-label="Help and saved sessions">
      <SessionShelf
        drafts={drafts}
        history={history}
        onOpenDraft={onOpenDraft}
        onOpenHistory={onOpenHistory}
        onViewAll={onViewAll}
      />
      <section className="card p-5">
        <h3 className="text-[14px] font-extrabold">How it works</h3>
        <ol className="mt-4 space-y-4">
          {steps.map(([t, d, c, bg], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-extrabold" style={{ color: c, background: bg }}>
                {i + 1}
              </span>
              <div>
                <p className="text-[13px] font-bold leading-tight">{t}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="card p-5">
        <h3 className="flex items-center gap-2 text-[14px] font-extrabold">
          <Lightbulb size={16} className="text-[var(--warning)]" />
          Important to know
        </h3>
        <ul className="mt-3 space-y-2.5 text-[12.5px] leading-snug text-[var(--text-muted)]">
          {[
            "AI Studio creates visuals and copy only.",
            "Publishing, sending and campaigns happen on each channel page.",
            "Each channel gets a unique, optimized version of your content.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <CheckCircle2 size={15} className="mt-[1px] flex-none text-[var(--ai-primary)]" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

/* ------------------------------ Compose ------------------------------ */

export interface ComposeProps {
  brief: string;
  setBrief: (v: string) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  photos: Photo[];
  setPhotos: (p: Photo[]) => void;
  outputs: OutputId[];
  setOutputs: (o: OutputId[]) => void;
  imageQuality: 'standard' | 'high' | 'story';
  setImageQuality: (q: 'standard' | 'high' | 'story') => void;
  imageCount: 1 | 2 | 4;
  setImageCount: (n: 1 | 2 | 4) => void;
  error: string | null;
  setError: (e: string | null) => void;
  onGenerate: () => void;
  onExample: (id: string) => void;
  hasPack: boolean;
  onBackToPack: () => void;
  drafts: Draft[];
  history: HistoryEntry[];
  onOpenDraft: (draft: Draft) => void;
  onOpenHistory: (entry: HistoryEntry) => void;
  onViewAllSessions: () => void;
}

export function Compose(p: ComposeProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const noOutputs = p.outputs.length === 0;
  const count = p.brief.length;

  return (
    <div className="anim-fade-up grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {p.hasPack && (
          <button type="button" className="btn btn-sm btn-soft" onClick={p.onBackToPack}>
            <ArrowRight size={14} className="rotate-180" /> Back to your content pack
          </button>
        )}
        <Hero />

        <section className="card p-5 sm:p-6" aria-label="Create content">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="brief" className="text-[14px] font-extrabold">
              Your idea or brief
            </label>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-bold text-[var(--ai-primary)] transition-colors hover:bg-[var(--ai-primary-soft)]" onClick={() => p.onExample("festival")}>
              <Lightbulb size={14} /> Try example
            </button>
          </div>
          <div className="relative">
            <textarea
              id="brief"
              ref={taRef}
              className={`input !min-h-[124px] resize-y !pb-7 ${p.error ? "!border-[var(--danger)]" : ""}`}
              placeholder="Describe your product, offer or content idea..."
              maxLength={MAX_BRIEF}
              value={p.brief}
              aria-invalid={!!p.error}
              aria-describedby="brief-help"
              onChange={(e) => {
                p.setBrief(e.target.value);
                if (p.error) p.setError(null);
              }}
            />
            <span className={`pointer-events-none absolute bottom-2.5 right-3 text-[11px] font-semibold ${count >= MAX_BRIEF ? "text-[var(--danger)]" : "text-[var(--text-soft)]"}`} aria-live="polite">
              {count}/{MAX_BRIEF}
            </span>
          </div>
          <p id="brief-help" className="mt-1.5 min-h-[18px] text-[12px]">
            {p.error ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--danger)]" role="alert">
                <AlertCircle size={13} /> {p.error}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">Mention your product, offer, place and style. Say “5-slide carousel” to choose slide count.</span>
            )}
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-[170px_minmax(0,1fr)]">
            <LanguageSelect value={p.language} onChange={p.setLanguage} />
            <div>
              <PhotoUploader photos={p.photos} onChange={p.setPhotos} onError={setPhotoError} />
              {photoError && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--danger)]" role="alert">
                  <AlertCircle size={13} /> {photoError}
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1.35fr)_minmax(170px,0.65fr)]">
            <div className="min-w-0">
              <span className="field-label">Image quality</span>
              <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto px-1 pb-1 thin-scroll" role="radiogroup" aria-label="Image quality">
                {([
                  ['standard', 'Standard', '1K'],
                  ['high', 'High', '2K'],
                  ['story', 'Story', '9:16'],
                ] as const).map(([id, label, hint]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={p.imageQuality === id}
                    title={`${label} · ${hint}`}
                    className={`h-8 flex-none rounded-full border px-2.5 text-[11px] font-bold ${p.imageQuality === id ? 'border-[var(--ai-primary)] bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]' : 'border-[#e6defb] text-[var(--text-muted)] hover:border-[var(--ai-primary-ring)]'}`}
                    onClick={() => p.setImageQuality(id)}
                  >
                    {label} <span className="font-semibold opacity-65">{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0">
              <span className="field-label">Images</span>
              <div className="mt-1 flex gap-1.5" role="radiogroup" aria-label="Number of images">
                {([1, 2, 4] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={p.imageCount === n}
                    className={`h-8 flex-1 rounded-full border px-2 text-[11px] font-bold ${p.imageCount === n ? 'border-[var(--ai-primary)] bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]' : 'border-[#e6defb] text-[var(--text-muted)] hover:border-[var(--ai-primary-ring)]'}`}
                    onClick={() => p.setImageCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">Same brief, generated together · maximum 4 images · carousel uses this set.</p>

          <div className="mt-5">
            <OutputSelector value={p.outputs} onChange={p.setOutputs} />
          </div>

          <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-[var(--text-muted)]" aria-live="polite">
              {noOutputs ? <span className="font-semibold text-[var(--warning)]">Select at least one content type.</span> : "Studio creates your content — you'll use it in each channel."}
            </p>
            <button type="button" className="btn btn-primary btn-lg w-full sm:w-auto sm:min-w-[210px]" disabled={noOutputs} onClick={p.onGenerate}>
              <Sparkles size={17} /> Generate Content
            </button>
          </div>
        </section>

        <Examples onUse={p.onExample} />
      </div>
      <SideHelp
        drafts={p.drafts}
        history={p.history}
        onOpenDraft={p.onOpenDraft}
        onOpenHistory={p.onOpenHistory}
        onViewAll={p.onViewAllSessions}
      />
    </div>
  );
}
