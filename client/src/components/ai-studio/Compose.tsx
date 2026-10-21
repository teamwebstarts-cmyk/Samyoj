import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, Flame, Globe, ImagePlus, Lightbulb, Megaphone, Plus, Sparkles, Store, X } from "lucide-react";
import type { Language, OutputId, Photo } from "./data/types";
import type { Draft } from "./data/types";
import type { HistoryEntry } from "../../utils/aiStudioStore";
import { EXAMPLE_IDEAS, LANGUAGES, MAX_BRIEF, MAX_PHOTOS, MAX_PHOTO_BYTES, OUTPUT_OPTIONS, uid } from "./data/mock";
import { ChannelIcon } from "./brand";
import { SessionShelf } from "./Overlays";
import { HERO_SCENE_MARKUP } from "./heroScene";

/* ------------------------------ Hero ------------------------------ */

function HeroIllustration() {
  return (
    <svg
      className="hero-svg h-auto w-full overflow-visible"
      viewBox="0 0 460 240"
      role="img"
      aria-label="AI Studio creates social content for Instagram, WhatsApp, email and Facebook"
      dangerouslySetInnerHTML={{ __html: HERO_SCENE_MARKUP }}
    />
  );
}

function Hero() {
  return (
    <section className="hero-bg hero-banner relative overflow-hidden rounded-[18px] border border-white/10 px-4 py-5 shadow-[0_24px_60px_rgba(20,18,55,0.18)] sm:rounded-[24px] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="hero-banner__copy">
        <span className="mb-3 inline-flex items-center gap-2 rounded-md border border-[#6d3df2]/15 bg-white/70 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#6d3df2] backdrop-blur">
          <Sparkles size={12} /> AI creative studio
        </span>
        <h2 className="text-[22px] font-extrabold leading-[1.12] tracking-tight text-[#241b3b] sm:text-[28px] lg:text-[32px] xl:text-[34px] 2xl:text-[38px]">
          Describe your idea,
          <br />
          we'll <span className="gradient-text">create the content.</span>
        </h2>
        <p className="mt-3 max-w-[36rem] text-[13px] leading-relaxed text-[#685f7d] sm:text-[15px]">
          Share your product, offer, or campaign idea. Get polished visuals and ready-to-use copy for Instagram, WhatsApp, and Email — all from one brief.
        </p>
      </div>
      <div className="hero-banner__stage hero-stage" aria-hidden="true">
        <HeroIllustration />
      </div>
    </section>
  );
}

/* ------------------------------ Pieces ------------------------------ */

function BriefMenu<T extends string | number>({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value)?.label ?? String(value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((next) => !next)}
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-bold text-[var(--text)] shadow-[0_1px_0_rgba(109,61,242,0.04)] transition-all duration-150 ${
          open
            ? "border-[var(--ai-primary)] bg-[var(--ai-primary-soft)] text-[var(--ai-primary)] shadow-[0_0_0_3px_rgba(109,61,242,0.12)]"
            : "border-[#ddd6f3] hover:border-[var(--ai-primary-ring)] hover:bg-[#faf8ff]"
        }`}
      >
        {icon}
        <span className="whitespace-nowrap">{current}</span>
        <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform duration-150 ${open ? "rotate-180 text-[var(--ai-primary)]" : ""}`} />
      </button>
      {open && (
        <ul className="brief-menu absolute bottom-[calc(100%+6px)] left-0 z-30 min-w-[148px] overflow-hidden rounded-xl border border-[#e4dcf8] bg-white p-1 shadow-[0_16px_40px_rgba(55,32,110,0.16)]" role="listbox" aria-label={label}>
          {options.map((option) => {
            const on = option.value === value;
            return (
              <li key={String(option.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold transition-colors duration-150 ${
                    on ? "bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]" : "text-[var(--text)] hover:bg-[#f6f3ff]"
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                  {on && <Check size={13} strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LanguageSelect({ value, onChange, compact = false }: { value: Language; onChange: (l: Language) => void; compact?: boolean }) {
  if (compact) {
    return (
      <BriefMenu
        label="Content language"
        value={value}
        onChange={onChange}
        icon={<Globe size={13} className="text-[var(--ai-primary)]" />}
        options={LANGUAGES.map((language) => ({ value: language, label: language }))}
      />
    );
  }
  return (
    <div>
      {!compact && <label htmlFor="language" className="field-label">Language</label>}
      <div className="relative">
        <Globe size={compact ? 13 : 15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <select id="language" aria-label="Content language" className={`input cursor-pointer appearance-none !pl-8 !pr-7 font-semibold ${compact ? "!h-8 !w-[118px] !rounded-lg !py-0 !text-[11px]" : ""}`} value={value} onChange={(e) => onChange(e.target.value as Language)}>
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
  compact = false,
  dropFiles,
  onDropHandled,
}: {
  photos: Photo[];
  onChange: (p: Photo[]) => void;
  onError: (m: string | null) => void;
  compact?: boolean;
  dropFiles?: FileList | null;
  onDropHandled?: () => void;
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

  useEffect(() => {
    if (!dropFiles) return;
    void addFiles(dropFiles);
    onDropHandled?.();
  }, [dropFiles]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      {!compact && (
        <span className="field-label" id="photos-label">
          Add photos <small>(optional)</small>
        </span>
      )}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "min-w-0" : ""}`} role="group" aria-labelledby={compact ? undefined : "photos-label"}>
        <input ref={inputRef} id="photo-input" type="file" accept="image/png,image/jpeg,image/webp" multiple className="peer sr-only" onChange={(e) => e.target.files && void addFiles(e.target.files)} />
        {photos.map((p) => (
          <div key={p.id} className={`anim-fade-in group relative flex-none ${compact ? "h-8 w-8" : "h-[56px] w-[56px]"}`}>
            <img src={p.url} alt={`Uploaded photo: ${p.name}`} className="h-full w-full rounded-xl border border-[var(--border)] object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${p.name}`}
              onClick={() => remove(p.id)}
              className={`absolute -right-1.5 -top-1.5 grid place-items-center rounded-full border border-[var(--border-strong)] bg-white text-[var(--text-muted)] shadow-sm transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] ${compact ? "h-4 w-4" : "h-5 w-5"}`}
            >
              <X size={compact ? 9 : 11} strokeWidth={3} />
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
            className={`${compact ? "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-bold text-[var(--text)] shadow-[0_1px_0_rgba(109,61,242,0.04)]" : "flex min-h-[56px] flex-1 items-center gap-3 rounded-xl border border-dashed px-3 py-2"} cursor-pointer transition-all duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--ai-primary)] ${
              drag ? "border-[var(--ai-primary)] bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]" : "border-[#ddd6f3] hover:border-[var(--ai-primary-ring)] hover:bg-[#faf8ff]"
            }`}
          >
            <span className={compact ? "text-[var(--ai-primary)]" : "grid h-9 w-9 flex-none place-items-center rounded-lg bg-[var(--ai-primary-soft)] text-[var(--ai-primary)]"}>
              <ImagePlus size={compact ? 14 : 18} />
            </span>
            <span className={compact ? "" : "leading-tight"}>
              <span className={compact ? "" : "block text-[12.5px] font-semibold"}>{compact ? "Add image" : "Click to upload or drag & drop"}</span>
              {!compact && <span className="text-[11px] text-[var(--text-muted)]">Product or brand photos · PNG, JPG, WebP (max {MAX_PHOTOS})</span>}
            </span>
          </label>
        ) : (
          photos.length < MAX_PHOTOS && (
            <label
              htmlFor="photo-input"
              className={`${compact ? "inline-flex h-8 w-8" : "flex h-[56px] w-[72px]"} cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:border-[var(--ai-primary-ring)] hover:text-[var(--ai-primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--ai-primary)]`}
            >
              <Plus size={compact ? 14 : 16} />
              {!compact && "Add more"}
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
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4" role="group" aria-labelledby="outputs-label">
        {OUTPUT_OPTIONS.map((o) => {
          const on = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.id)}
              className={`relative flex min-h-[96px] min-w-0 flex-col items-center justify-center rounded-2xl border px-3 py-3 text-center transition-all duration-150 sm:min-h-[132px] ${
                on
                  ? "border-[var(--ai-primary)] bg-[var(--ai-primary-soft)] shadow-[0_8px_20px_rgba(109,61,242,0.12)]"
                  : "border-[#e4dcf8] bg-white hover:-translate-y-0.5 hover:border-[var(--ai-primary-ring)] hover:bg-[#faf8ff] hover:shadow-[0_8px_18px_rgba(109,61,242,0.08)]"
              }`}
            >
              <span
                className={`absolute right-2.5 top-2.5 grid h-[18px] w-[18px] place-items-center rounded-full border transition-colors ${
                  on ? "border-[var(--ai-primary)] bg-[var(--ai-primary)] text-white" : "border-[#ddd6f3] bg-white text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check size={11} strokeWidth={3.5} />
              </span>
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${on ? "bg-white shadow-sm" : "bg-[#f6f3ff]"}`}>
                <ChannelIcon channel={o.channel} size={26} />
              </span>
              <span className="mt-2 block text-[12.5px] font-extrabold leading-tight">{o.title}</span>
              <span className="mt-1 line-clamp-2 max-w-[16ch] text-[11px] leading-snug text-[var(--text-muted)]">{o.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ImageQualitySelect({ value, onChange }: { value: ComposeProps["imageQuality"]; onChange: (q: ComposeProps["imageQuality"]) => void }) {
  return (
    <BriefMenu
      label="Image quality"
      value={value}
      onChange={onChange}
      options={[
        { value: "standard", label: "Standard · 1K" },
        { value: "high", label: "High · 2K" },
        { value: "story", label: "Story · 9:16" },
      ]}
    />
  );
}

/* ------------------------------ Examples ------------------------------ */

const EXAMPLE_POSTERS: Record<string, { kicker: string; line: string; gradient: string; ink: string; icon: typeof Flame }> = {
  festival: {
    kicker: "This weekend",
    line: "20% off",
    gradient: "linear-gradient(145deg, #5a1020 0%, #9a2a18 55%, #e7b15a 140%)",
    ink: "#fff6e8",
    icon: Flame,
  },
  launch: {
    kicker: "New serum",
    line: "₹899",
    gradient: "linear-gradient(160deg, #f7f4ff 0%, #efe7ff 55%, #d9ccff 100%)",
    ink: "#2a2150",
    icon: Sparkles,
  },
  announce: {
    kicker: "Jaipur",
    line: "Opening soon",
    gradient: "linear-gradient(160deg, #fff7ee 0%, #ffe4c8 100%)",
    ink: "#6a3418",
    icon: Store,
  },
  tips: {
    kicker: "5 winter tips",
    line: "Glow guide",
    gradient: "linear-gradient(160deg, #ffe7a8 0%, #f3b24a 100%)",
    ink: "#5a2e08",
    icon: Lightbulb,
  },
};

function Examples({ onUse }: { onUse: (id: string) => void }) {
  return (
    <section className="card p-5" aria-labelledby="examples-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 id="examples-title" className="text-[14px] font-extrabold">
            Need a starting prompt?
          </h3>
          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">Pick one. The brief and channels fill in, then you can edit before generating.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {EXAMPLE_IDEAS.map((ex) => {
          const poster = EXAMPLE_POSTERS[ex.id];
          const Icon = poster?.icon ?? Megaphone;
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onUse(ex.id)}
              className="group overflow-hidden rounded-2xl border border-[#e6defb] bg-white text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--ai-primary-ring)] hover:shadow-[0_12px_28px_rgba(109,61,242,0.12)]"
            >
              <span className="relative block h-[92px] overflow-hidden" style={{ background: poster?.gradient }} aria-hidden="true">
                <span className="pointer-events-none absolute -left-6 top-0 h-full w-10 -skew-x-12 bg-white/25 transition-transform duration-500 group-hover:translate-x-[220px]" />
                <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-xl bg-white/85 shadow-sm" style={{ color: poster?.ink }}>
                  <Icon size={16} />
                </span>
                <span className="absolute bottom-3 left-3 right-3" style={{ color: poster?.ink }}>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] opacity-80">{poster?.kicker}</span>
                  <span className="block text-[16px] font-extrabold leading-tight">{poster?.line}</span>
                </span>
              </span>
              <span className="flex items-start gap-2 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold">{ex.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-[var(--text-muted)]">{ex.desc}</span>
                </span>
                <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--ai-primary-soft)] text-[var(--ai-primary)] transition-transform duration-200 group-hover:translate-x-0.5">
                  <ArrowRight size={13} />
                </span>
              </span>
            </button>
          );
        })}
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
  const [briefDrag, setBriefDrag] = useState(false);
  const [dropFiles, setDropFiles] = useState<FileList | null>(null);
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

        <section className="card p-4 sm:p-5 lg:p-6" aria-label="Create content">
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="brief" className="text-[14px] font-extrabold">
              Your idea or brief
            </label>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-bold text-[var(--ai-primary)] transition-colors hover:bg-[var(--ai-primary-soft)]" onClick={() => p.onExample("festival")}>
              <Lightbulb size={14} /> Try example
            </button>
          </div>
          <div
            className={`relative rounded-xl border bg-white transition-all duration-150 ${
              p.error
                ? "border-[var(--danger)]"
                : briefDrag
                  ? "border-[var(--ai-primary)]"
                  : "border-[#d9d0ef] hover:border-[var(--ai-primary-ring)] focus-within:border-[var(--ai-primary)]"
            }`}
            onDragEnter={(e) => {
              e.preventDefault();
              setBriefDrag(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setBriefDrag(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setBriefDrag(false);
              if (e.dataTransfer.files?.length) setDropFiles(e.dataTransfer.files);
            }}
          >
            <textarea
              id="brief"
              ref={taRef}
              className="min-h-[108px] w-full resize-y border-0 bg-transparent px-3 pb-2 pt-3 text-[13px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-soft)]"
              placeholder="Describe your product, offer or content idea..."
              maxLength={MAX_BRIEF}
              value={p.brief}
              aria-invalid={!!p.error}
              aria-describedby={p.error ? "brief-help" : undefined}
              onChange={(e) => {
                p.setBrief(e.target.value);
                if (p.error) p.setError(null);
              }}
            />
            <div className="flex flex-wrap items-center gap-1.5 border-t border-[#efeaf8] px-2.5 py-2">
              <PhotoUploader
                photos={p.photos}
                onChange={p.setPhotos}
                onError={setPhotoError}
                compact
                dropFiles={dropFiles}
                onDropHandled={() => setDropFiles(null)}
              />
              <LanguageSelect value={p.language} onChange={p.setLanguage} compact />
              <ImageQualitySelect value={p.imageQuality} onChange={p.setImageQuality} />
              <BriefMenu
                label="Number of images"
                value={p.imageCount}
                onChange={p.setImageCount}
                options={[
                  { value: 1, label: "1 image" },
                  { value: 2, label: "2 images" },
                  { value: 4, label: "4 images" },
                ]}
              />
              {photoError && <span className="w-full text-[11px] font-semibold text-[var(--danger)] sm:w-auto" role="alert">{photoError}</span>}
              <span className={`w-full text-right text-[11px] font-semibold sm:ml-auto sm:w-auto ${count >= MAX_BRIEF ? "text-[var(--danger)]" : "text-[var(--text-soft)]"}`} aria-live="polite">
                {count}/{MAX_BRIEF}
              </span>
            </div>
          </div>
          {p.error && (
            <p id="brief-help" className="mt-3 flex flex-wrap items-start gap-2 rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] font-semibold leading-snug text-[var(--danger)]" role="alert">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                {p.error}
                {/billing/i.test(p.error) && (
                  <>
                    {" "}
                    <a href="/billing" className="underline underline-offset-2">Open Billing</a>
                  </>
                )}
              </span>
            </p>
          )}

          <div className="mt-5">
            <OutputSelector value={p.outputs} onChange={p.setOutputs} />
          </div>

          <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            {noOutputs ? (
              <p className="text-[12px] font-semibold text-[var(--warning)]" aria-live="polite">
                Select at least one content type.
              </p>
            ) : null}
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
