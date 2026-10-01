import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ImagePlus,
  Instagram,
  Lightbulb,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { instagramApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { STUDIO_EXAMPLES, STUDIO_BRIEF_MAX, STUDIO_SLIDES_MAX, STUDIO_SLIDES_MIN } from './studioModel';

export type StudioPhoto = { url: string; name?: string };

const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const LANGUAGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'hinglish', label: 'Hinglish' },
];

const GEN_STEPS = [
  'Understanding your brief',
  'Planning your carousel slides',
  'Writing channel-ready copy',
  'Preparing your content pack',
];

/* ============ Stepper ============ */

export function StudioStepper({ phase }: { phase: 'brief' | 'generating' | 'review' }) {
  // Design: Describe → Generate → Review & Edit → Use in your channels.
  const step = phase === 'brief' ? 1 : phase === 'generating' ? 2 : 4;
  const steps = ['Describe', 'Generate', 'Review & Edit', 'Use in your channels'];
  return (
    <div className="ais-steps" aria-label="AI Studio progress">
      {steps.map((label, index) => {
        const n = index + 1;
        const state = n < step ? 'done' : n === step ? 'on' : 'todo';
        return (
          <span
            key={label}
            className={`ais-step ${state === 'on' ? 'ais-step--on' : ''} ${state === 'done' ? 'ais-step--done' : ''}`}
          >
            <span className="ais-step__num">
              {state === 'done' ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : n}
            </span>
            {label}
          </span>
        );
      })}
    </div>
  );
}

/* ============ Hero ============ */

export function StudioHero() {
  return (
    <section className="ais-hero">
      <div className="ais-hero__copy">
        <h1 className="ais-hero__title">
          Describe your idea,
          <br />
          we&apos;ll <em>create the content.</em>
        </h1>
        <p className="ais-hero__lead">
          Generate stunning visuals and channel-ready copy for Instagram, WhatsApp, and Email — all in one place.
        </p>
      </div>
      <div className="ais-hero__stage" aria-hidden>
        <span className="ais-chipcard">
          <span className="ais-chipcard__glyph ais-chipcard__glyph--ig">
            <Instagram className="h-4 w-4" />
          </span>
          <span>
            <b>Instagram</b>
            <i>Carousel + caption</i>
          </span>
        </span>
        <div className="ais-hero__device">
          <span className="ais-hero__screen" />
        </div>
        <span className="ais-chipcard">
          <span className="ais-chipcard__glyph ais-chipcard__glyph--wa">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.7-5c-.4-.7-.8-1.6-.8-2.5 0-.9.5-1.4.7-1.6.2-.2.4-.3.6-.3h.4c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6a8 8 0 0 0 3.6 3.1c.3.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.3.4.4 0 .1 0 .5-.2.9Z" />
            </svg>
          </span>
          <span>
            <b>WhatsApp</b>
            <i>Template copy</i>
          </span>
        </span>
        <span className="ais-chipcard">
          <span className="ais-chipcard__glyph ais-chipcard__glyph--mail">
            <Mail className="h-4 w-4" />
          </span>
          <span>
            <b>Email</b>
            <i>Subject + body</i>
          </span>
        </span>
      </div>
    </section>
  );
}

/* ============ Brief form ============ */

export function StudioBriefForm({
  brief,
  onBriefChange,
  language,
  onLanguageChange,
  slides,
  onSlidesChange,
  outputs,
  onOutputsChange,
  photos,
  onPhotosChange,
  generating,
  onGenerate,
}: {
  brief: string;
  onBriefChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  slides: number;
  onSlidesChange: (value: number) => void;
  outputs: { carousel: boolean; waTemplate: boolean; email: boolean };
  onOutputsChange: (next: { carousel: boolean; waTemplate: boolean; email: boolean }) => void;
  photos: StudioPhoto[];
  onPhotosChange: (next: StudioPhoto[]) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  const atMax = brief.length >= STUDIO_BRIEF_MAX;
  const example = STUDIO_EXAMPLES[0];
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const addPhotos = async (files: File[]) => {
    setPhotoError(null);
    const room = 10 - photos.length;
    if (room <= 0) {
      setPhotoError('Up to 10 photos per pack.');
      return;
    }
    const accepted: File[] = [];
    for (const file of files) {
      if (!PHOTO_MIMES.has(file.type)) {
        setPhotoError('Use JPEG, PNG, or WebP images.');
        continue;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        setPhotoError('Each photo must be 8 MB or smaller.');
        continue;
      }
      accepted.push(file);
      if (accepted.length >= room) break;
    }
    if (!accepted.length) return;
    setPhotoBusy(true);
    try {
      const uploaded: StudioPhoto[] = [];
      for (const file of accepted) {
        const { data: res } = await instagramApi.posts.upload(file);
        uploaded.push({ url: res.data.mediaUrl || res.data.imageUrl, name: file.name });
      }
      onPhotosChange([...photos, ...uploaded]);
    } catch (err) {
      setPhotoError(getErrorMessage(err) || 'Could not upload the photos.');
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <section className="ais-card" aria-label="Describe your idea">
      <div className="ais-card__head">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="ais-card__title">
              <Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              Your idea or brief
            </h2>
          </div>
          <button
            type="button"
            className="ais-btn ais-btn--ghost ais-btn--sm"
            onClick={() => onBriefChange(example.brief)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Try example
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 p-4 pt-2.5">
        <div>
          <textarea
            className="ais-textarea"
            placeholder="e.g. Diwali 20% off this weekend for our Jaipur store. Create a 5-slide Instagram carousel, a WhatsApp template and an email with a special offer."
            value={brief}
            maxLength={STUDIO_BRIEF_MAX}
            onChange={(e) => onBriefChange(e.target.value)}
            aria-label="Describe your idea"
          />
          <div className="mt-1 flex justify-end">
            <span className={`ais-counter ${atMax ? 'ais-counter--max' : ''}`}>
              {brief.length}/{STUDIO_BRIEF_MAX}
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)_minmax(0,1.6fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="ais-field-label">Language</span>
            <select
              className="ais-select"
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="ais-field-label">
              Add product photos (optional)
              {photos.length > 0 ? <span className="ml-2 normal-case tracking-normal text-theme-fg">{photos.length}/10</span> : null}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {photos.map((photo, index) => (
                <span key={photo.url} className="ais-photo">
                  <img src={photo.url} alt={photo.name || `Photo ${index + 1}`} />
                  <button
                    type="button"
                    className="ais-photo__x"
                    aria-label={`Remove ${photo.name || `photo ${index + 1}`}`}
                    onClick={() => onPhotosChange(photos.filter((_, i) => i !== index))}
                  >
                    <X className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
              {photos.length < 10 ? (
                <button
                  type="button"
                  className="ais-photo ais-photo--add"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoBusy}
                  aria-label="Add product photos"
                >
                  {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span className="ais-photo__hint">{photos.length === 0 ? 'Click to upload' : 'Add more'}</span>
                </button>
              ) : null}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  void addPhotos(Array.from(event.target.files || []));
                  event.currentTarget.value = '';
                }}
              />
            </div>
            {photoError ? (
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400">{photoError}</span>
            ) : (
              <span className="text-[10.5px] font-semibold text-theme-muted flex items-center gap-1">
                <ImagePlus className="h-3 w-3" />
                JPEG, PNG, WebP · 8 MB each
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="ais-field-label">What do you want to create?</span>
            <div className="ais-outputs">
              <button
                type="button"
                className={`ais-output ${outputs.carousel ? 'ais-output--on' : ''}`}
                aria-pressed={outputs.carousel}
                onClick={() => onOutputsChange({ ...outputs, carousel: !outputs.carousel })}
              >
                <Instagram className="h-4 w-4 text-[#E1306C]" />
                <span className="ais-output__name">Instagram Carousel</span>
                <span className="ais-output__hint">
                  {outputs.carousel ? `${slides} slides` : `${STUDIO_SLIDES_MIN}–${STUDIO_SLIDES_MAX} slides`}
                </span>
                {outputs.carousel ? (
                  <input
                    type="range"
                    min={STUDIO_SLIDES_MIN}
                    max={STUDIO_SLIDES_MAX}
                    value={slides}
                    onChange={(e) => onSlidesChange(Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    className="ais-output__range"
                    aria-label="Number of carousel slides"
                  />
                ) : null}
              </button>
              <button
                type="button"
                className={`ais-output ${outputs.waTemplate ? 'ais-output--on' : ''}`}
                aria-pressed={outputs.waTemplate}
                onClick={() => onOutputsChange({ ...outputs, waTemplate: !outputs.waTemplate })}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-emerald-500" aria-hidden>
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.7-5c-.4-.7-.8-1.6-.8-2.5 0-.9.5-1.4.7-1.6.2-.2.4-.3.6-.3h.4c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6a8 8 0 0 0 3.6 3.1c.3.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.3.4.4 0 .1 0 .5-.2.9Z" />
                </svg>
                <span className="ais-output__name">WhatsApp Template</span>
                <span className="ais-output__hint">Body + buttons</span>
              </button>
              <button
                type="button"
                className={`ais-output ${outputs.email ? 'ais-output--on' : ''}`}
                aria-pressed={outputs.email}
                onClick={() => onOutputsChange({ ...outputs, email: !outputs.email })}
              >
                <Mail className="h-4 w-4 text-[#EA4335]" />
                <span className="ais-output__name">Email</span>
                <span className="ais-output__hint">Subject + body</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            className="ais-btn ais-btn--primary ais-btn--lg"
            disabled={generating || brief.trim().length < 10 || (!outputs.carousel && !outputs.waTemplate && !outputs.email)}
            onClick={onGenerate}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Content
          </button>
        </div>
      </div>
    </section>
  );
}

/* ============ Examples ============ */

export function StudioExamples({ onPick }: { onPick: (brief: string, slides: number) => void }) {
  return (
    <section aria-label="Example briefs">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[13.5px] font-extrabold text-theme-fg">Need inspiration? Try these examples</h2>
      </div>
      <div className="ais-examples">
        {STUDIO_EXAMPLES.map((ex) => (
          <button key={ex.id} type="button" className="ais-example" onClick={() => onPick(ex.brief, ex.slides)}>
            <span className="ais-example__art" style={{ background: ex.art.bg }}>
              <span className="ais-example__glyph">{ex.art.glyph}</span>
              <span className="ais-example__tag" style={{ background: ex.art.accent }}>
                {ex.label.split(' ')[0]}
              </span>
            </span>
            <span className="ais-example__body">
              <span className="ais-example__name">{ex.label}</span>
              <span className="ais-example__hint line-clamp-2">{ex.brief}</span>
            </span>
            <span className="ais-example__arrow" aria-hidden>→</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============ Generating ============ */

export function StudioGenerating({ phase }: { phase: number }) {
  const [shown, setShown] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    timer.current = window.setInterval(() => {
      setShown((prev) => Math.min(prev + 1, GEN_STEPS.length - 1));
    }, 4200);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [phase]);

  return (
    <section className="ais-card ais-generating" aria-live="polite" aria-busy="true">
      <div className="ais-generating__orb">
        <Sparkles className="h-8 w-8" />
      </div>
      <h2 className="text-[17px] font-extrabold text-theme-fg">Creating your content pack…</h2>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] font-semibold text-theme-muted">
        This may take a few moments. We&apos;re generating visuals and channel-ready copy for you.
      </p>
      <div className="ais-genlist">
        {GEN_STEPS.map((label, index) => (
          <div key={label} className={`ais-genrow ${index <= shown ? 'ais-genrow--done' : ''}`}>
            <span className="ais-genrow__dot">
              {index <= shown ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            {label}
          </div>
        ))}
      </div>
      <span className="ais-gentip">
        <Lightbulb className="h-3.5 w-3.5" />
        Tip: you can close this page. We&apos;ll keep generating your content.
      </span>
    </section>
  );
}

export function StudioEditHint() {
  return (
    <span className="ais-note">
      <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      Tap any copy block to edit it in place. Studio never sends, publishes, or submits — each channel page does that.
    </span>
  );
}
