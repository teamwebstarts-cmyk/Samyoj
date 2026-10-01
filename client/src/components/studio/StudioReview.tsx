import { useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  ImagePlus,
  Instagram,
  Mail,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { StudioPack, StudioSlideStyle } from './studioModel';
import { SLIDE_THEMES, slideThemeCss } from './studioModel';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ais-btn ais-btn--outline ais-btn--sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : label}
    </button>
  );
}

function EditableCopy({
  value,
  onChange,
  onSave,
  rows = 5,
  max,
}: {
  value: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  rows?: number;
  max?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        className="ais-copy ais-copy--flat w-full text-left"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label="Edit this copy"
      >
        <span className="whitespace-pre-wrap">{value || '—'}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        className="ais-copy"
        rows={rows}
        maxLength={max}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange?.(e.target.value);
        }}
      />
      {onSave ? (
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            className="ais-btn ais-btn--ghost ais-btn--sm"
            onClick={() => {
              setDraft(value);
              setEditing(false);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ais-btn ais-btn--primary ais-btn--sm"
            onClick={() => {
              onSave(draft);
              setEditing(false);
            }}
          >
            <Check className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Numbered {{1}} variables rendered as highlighted chips. */
function WaBody({ body }: { body: string }) {
  const parts = body.split(/(\{\{\d+\}\})/g);
  return (
    <p className="ais-wa-body">
      {parts.map((part, index) =>
        /^\{\{\d+\}\}$/.test(part) ? (
          <span key={index} className="ais-wa-var">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </p>
  );
}

/* ============ Visual slide poster ============ */

function SlidePoster({
  index,
  total,
  title,
  body,
  photo,
  style,
  active,
  onOpen,
}: {
  index: number;
  total: number;
  title: string;
  body: string;
  photo?: string;
  style?: StudioSlideStyle;
  active?: boolean;
  onOpen?: () => void;
}) {
  const theme = slideThemeCss(style);
  return (
    <button
      type="button"
      className={`ais-slide ${active ? 'ais-slide--active' : ''}`}
      onClick={onOpen}
      aria-label={`Open slide ${index + 1} editor`}
    >
      <span className="ais-slide__frame" style={{ background: photo ? undefined : theme.bg }}>
        {photo ? <img src={photo} alt="" className="ais-slide__photo" loading="lazy" /> : null}
        <span className="ais-slide__num">{index + 1}</span>
        <span className="ais-slide__copy" style={{ color: photo ? '#fff' : theme.ink }}>
          <b className="ais-slide__title">{title}</b>
          {body ? <span className="ais-slide__body">{body}</span> : null}
        </span>
        <span className="ais-slide__count" style={photo ? undefined : { color: theme.ink }}>
          Slide {index + 1}/{total}
        </span>
      </span>
      <span className="ais-slide__tools">
        <span className="ais-slide__tool">
          <Pencil className="h-3 w-3" />
        </span>
        <span className="ais-slide__tool">
          <Copy className="h-3 w-3" />
        </span>
        <span className="ais-slide__tool ais-slide__tool--danger">
          <Trash2 className="h-3 w-3" />
        </span>
      </span>
    </button>
  );
}

/* ============ Slide editor (Image/Text tabs → Text-only + theme) ============ */

function SlideEditor({
  slide,
  index,
  total,
  photos,
  canEdit,
  onChange,
  onNavigate,
}: {
  slide: { title: string; body: string; photo?: string; style?: StudioSlideStyle };
  index: number;
  total: number;
  photos: Array<{ url: string; name?: string }>;
  canEdit: boolean;
  onChange: (next: { title: string; body: string; photo?: string; style?: StudioSlideStyle }) => void;
  onNavigate: (index: number) => void;
}) {
  const [tab, setTab] = useState<'image' | 'text'>('image');
  const [title, setTitle] = useState(slide.title);
  const [body, setBody] = useState(slide.body);
  const theme = slideThemeCss(slide.style);

  const nav = (
    <span className="ais-editor__nav">
      <button
        type="button"
        className="ais-editor__arrow"
        aria-label="Previous slide"
        onClick={() => onNavigate((index - 1 + total) % total)}
        disabled={total < 2}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="ais-editor__count">
        Slide {index + 1} / {total}
      </span>
      <button
        type="button"
        className="ais-editor__arrow"
        aria-label="Next slide"
        onClick={() => onNavigate((index + 1) % total)}
        disabled={total < 2}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </span>
  );

  return (
    <div className="ais-card ais-editor">
      <div className="ais-editor__layout">
        {/* Poster preview */}
        <div className="ais-editor__stage">
          <div className="flex items-center justify-between px-1 pb-2">
            {nav}
            <div className="ais-editor__tabs" role="tablist" aria-label="Slide editor tabs">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'image'}
                className={`ais-editor__tab ${tab === 'image' ? 'ais-editor__tab--on' : ''}`}
                onClick={() => setTab('image')}
              >
                <ImagePlus className="h-3 w-3" />
                Image
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'text'}
                className={`ais-editor__tab ${tab === 'text' ? 'ais-editor__tab--on' : ''}`}
                onClick={() => setTab('text')}
              >
                <Pencil className="h-3 w-3" />
                Text
              </button>
            </div>
          </div>
          <div className="ais-editor__poster" style={{ background: slide.photo ? undefined : theme.bg }}>
            {slide.photo ? <img src={slide.photo} alt="" className="ais-editor__photo" /> : null}
            <span className="ais-editor__copy" style={{ color: slide.photo ? '#fff' : theme.ink }}>
              <b>{slide.title}</b>
              {slide.body ? <span>{slide.body}</span> : null}
            </span>
          </div>
          {tab === 'text' ? (
            <div className="ais-editor__form">
              <label className="flex flex-col gap-1">
                <span className="ais-field-label">Title</span>
                <input
                  className="ais-input"
                  value={title}
                  maxLength={60}
                  disabled={!canEdit}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="ais-field-label">Body</span>
                <textarea
                  className="ais-copy"
                  rows={2}
                  value={body}
                  maxLength={200}
                  disabled={!canEdit}
                  onChange={(e) => setBody(e.target.value)}
                />
              </label>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="ais-btn ais-btn--primary ais-btn--sm"
                  disabled={!canEdit}
                  onClick={() => onChange({ ...slide, title: title.trim() || slide.title, body: body.trim() })}
                >
                  <Check className="h-3.5 w-3.5" />
                  Save changes
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right rail */}
        <div className="ais-editor__rail">
          {tab === 'image' ? (
            <>
              <span className="ais-field-label">Photo (from your uploads)</span>
              {photos.length ? (
                <div className="ais-editor__photos">
                  <button
                    type="button"
                    className={`ais-editor__photo-pick ${!slide.photo ? 'ais-editor__photo-pick--on' : ''}`}
                    onClick={() => canEdit && onChange({ ...slide, photo: undefined })}
                    aria-label="No photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {photos.map((photo) => (
                    <button
                      key={photo.url}
                      type="button"
                      className={`ais-editor__photo-pick ${slide.photo === photo.url ? 'ais-editor__photo-pick--on' : ''}`}
                      onClick={() => canEdit && onChange({ ...slide, photo: photo.url })}
                      aria-label={`Use ${photo.name || 'photo'}`}
                    >
                      <img src={photo.url} alt="" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ais-card__sub">
                  No photos uploaded. Add photos in the brief form, then set them as slide backgrounds here.
                </p>
              )}

              <span className="ais-field-label mt-1">Style</span>
              <div className="ais-themes">
                {SLIDE_THEMES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    className={`ais-theme ${slide.style === t.value || (!slide.style && t.value === 'none') ? 'ais-theme--on' : ''}`}
                    disabled={!canEdit}
                    onClick={() => onChange({ ...slide, style: t.value })}
                  >
                    <span className="ais-theme__swatch" style={{ background: slideThemeCss(t.value).bg }} />
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="ais-card__sub mt-1">
                Themes are CSS-styled frames — Studio does not generate image files.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ============ Slides grid ============ */

export function StudioSlides({
  pack,
  canEdit,
  onSaveSlides,
}: {
  pack: StudioPack;
  canEdit: boolean;
  onSaveSlides?: (slides: Array<{ title: string; body: string; photo?: string; style?: StudioSlideStyle }>) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const slides = pack.slides;
  if (!slides.length) return null;

  const applySlide = (index: number, next: { title: string; body: string; photo?: string; style?: StudioSlideStyle }) => {
    const updated = slides.map((s, i) => (i === index ? next : s));
    onSaveSlides?.(updated);
  };

  const removeSlide = (index: number) => {
    if (slides.length <= 2) return;
    const updated = slides.filter((_, i) => i !== index);
    onSaveSlides?.(updated);
    setOpenIndex(null);
  };

  return (
    <section className="ais-card" aria-label="Carousel slides">
      <div className="ais-card__head">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="ais-card__title">
              <Instagram className="h-4 w-4 text-[#E1306C]" />
              Generated visuals
            </h2>
            <p className="ais-card__sub">
              {slides.length} carousel slides · Instagram Carousel (1080 × 1080) — copy plan, not image files
            </p>
          </div>
          <CopyButton
            label="Copy all"
            text={slides.map((slide, i) => `${i + 1}. ${slide.title}${slide.body ? ` — ${slide.body}` : ''}`).join('\n')}
          />
        </div>
      </div>

      <div className="p-4 pt-2">
        <div className="ais-slidestrip">
          {slides.map((slide, index) => (
            <div key={index} className="ais-slidestrip__item">
              <SlidePoster
                index={index}
                total={slides.length}
                title={slide.title}
                body={slide.body}
                photo={slide.photo}
                style={slide.style}
                active={openIndex === index}
                onOpen={() => setOpenIndex(openIndex === index ? null : index)}
              />
              {canEdit && openIndex === index ? (
                <button
                  type="button"
                  className="ais-slide__remove"
                  aria-label={`Delete slide ${index + 1}`}
                  onClick={() => removeSlide(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
          {canEdit && slides.length < 10 ? (
            <button
              type="button"
              className="ais-slide ais-slide--add"
              aria-label="Add slide"
              onClick={() => {
                const updated = [...slides, { title: 'New slide', body: '' }];
                onSaveSlides?.(updated);
                setOpenIndex(slides.length);
              }}
            >
              <span className="ais-slide__frame ais-slide__frame--add">
                <Plus className="h-5 w-5" />
                Add slide
              </span>
            </button>
          ) : null}
        </div>
      </div>

      {openIndex !== null && slides[openIndex] ? (
        <div className="px-4 pb-4">
          <SlideEditor
            slide={slides[openIndex]}
            index={openIndex}
            total={slides.length}
            photos={pack.photos || []}
            canEdit={canEdit}
            onChange={(next) => applySlide(openIndex, next)}
            onNavigate={(i) => setOpenIndex(i)}
          />
        </div>
      ) : null}
    </section>
  );
}

/* ============ Channel columns ============ */

export function StudioChannelColumns({
  pack,
  onSaveCaption,
  onSaveEmail,
  onUseInPosts,
  onOpenInTemplates,
  onUseInEmail,
}: {
  pack: StudioPack;
  onSaveCaption?: (value: string) => void;
  onSaveEmail?: (subject: string, body: string) => void;
  onUseInPosts?: () => void;
  onOpenInTemplates?: () => void;
  onUseInEmail?: () => void;
}) {
  const [igTab, setIgTab] = useState<'caption' | 'hashtags'>('caption');
  const waVarCount = pack.waTemplate ? (pack.waTemplate.body.match(/\{\{\d+\}\}/g) || []).length : 0;

  return (
    <div className="ais-channels">
      {/* Instagram */}
      <section className="ais-card ais-channel" aria-label="Instagram copy">
        <div className="flex items-center justify-between">
          <div className="ais-channel__brand">
            <span className="ais-channel__glyph ais-channel__glyph--ig">
              <Instagram className="h-3.5 w-3.5" />
            </span>
            <div>
              <span className="ais-channel__name">Instagram</span>
              <span className="ais-channel__tag">Post copy (Carousel)</span>
            </div>
          </div>
          <button type="button" className="ais-btn ais-btn--ghost ais-btn--sm" onClick={() => setIgTab('caption')}>
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        </div>

        {/* Caption / Hashtags tabs — from the approved design */}
        <div className="ais-igtabs" role="tablist" aria-label="Instagram copy sections">
          <button
            type="button"
            role="tab"
            aria-selected={igTab === 'caption'}
            className={`ais-igtab ${igTab === 'caption' ? 'ais-igtab--on' : ''}`}
            onClick={() => setIgTab('caption')}
          >
            Caption
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={igTab === 'hashtags'}
            className={`ais-igtab ${igTab === 'hashtags' ? 'ais-igtab--on' : ''}`}
            onClick={() => setIgTab('hashtags')}
          >
            Hashtags
          </button>
        </div>

        {igTab === 'caption' ? (
          <>
            <EditableCopy value={pack.caption || ''} onSave={onSaveCaption} max={2200} />
            <span className="ais-charcount">{(pack.caption || '').length}/2200</span>
          </>
        ) : (
          <div className="ais-hashtags">
            {pack.hashtags.length ? (
              pack.hashtags.map((tag) => (
                <span key={tag} className="ais-hashtag">
                  {tag}
                </span>
              ))
            ) : (
              <span className="ais-card__sub">No hashtags were generated.</span>
            )}
          </div>
        )}

        <div className="ais-channel__foot">
          {onUseInPosts ? (
            <button type="button" className="ais-btn ais-btn--primary ais-btn--sm" onClick={onUseInPosts}>
              <ExternalLink className="h-3.5 w-3.5" />
              Use in Posts
            </button>
          ) : null}
          <CopyButton label="Copy" text={igTab === 'caption' ? pack.caption || '' : pack.hashtags.join(' ')} />
        </div>
      </section>

      {/* WhatsApp template */}
      <section className="ais-card ais-channel" aria-label="WhatsApp template draft">
        <div className="flex items-center justify-between">
          <div className="ais-channel__brand">
            <span className="ais-channel__glyph ais-channel__glyph--wa">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1a13 13 0 0 1-5.7-5c-.4-.7-.8-1.6-.8-2.5 0-.9.5-1.4.7-1.6.2-.2.4-.3.6-.3h.4c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6a8 8 0 0 0 3.6 3.1c.3.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.3.4.4 0 .1 0 .5-.2.9Z" />
              </svg>
            </span>
            <div>
              <span className="ais-channel__name">WhatsApp Template</span>
              <span className="ais-channel__tag">Marketing</span>
            </div>
          </div>
          <span className="ais-channel__edit">Edit</span>
        </div>
        {pack.waTemplate ? (
          <>
            {/* Labeled rows — Header/Body/Footer/Buttons like the design */}
            <div className="ais-warow">
              <span className="ais-warow__label">Header</span>
              <span className="ais-warow__value ais-warow__value--muted">Text only — no media header in v1</span>
            </div>
            <div className="ais-warow">
              <span className="ais-warow__label">Body</span>
              <span className="ais-warow__value">
                <WaBody body={pack.waTemplate.body} />
              </span>
            </div>
            <div className="ais-warow">
              <span className="ais-warow__label">Footer</span>
              <span className="ais-warow__value">{pack.waTemplate.footer || '—'}</span>
            </div>
            <div className="ais-warow">
              <span className="ais-warow__label">Buttons</span>
              <span className="ais-warow__value ais-warow__value--stack">
                {pack.waTemplate.buttons.length ? (
                  pack.waTemplate.buttons.map((button) => (
                    <span key={button.text} className="ais-wabtn">
                      <span className="ais-wabtn__icon">{button.type === 'URL' ? '🔗' : '💬'}</span>
                      <span className="ais-wabtn__text">{button.text}</span>
                      <span className="ais-wabtn__type">{button.type}</span>
                    </span>
                  ))
                ) : (
                  <span className="ais-warow__value--muted">No buttons</span>
                )}
              </span>
            </div>
            {waVarCount > 0 ? (
              <span className="ais-wa-row">
                <TriangleAlert className="h-3.5 w-3.5" />
                {waVarCount} variable{waVarCount > 1 ? 's' : ''} need example values before Meta review
              </span>
            ) : null}
            <div className="ais-channel__foot">
              {onOpenInTemplates ? (
                <button type="button" className="ais-btn ais-btn--primary ais-btn--sm" onClick={onOpenInTemplates}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Templates
                </button>
              ) : null}
              <CopyButton label="Copy" text={pack.waTemplate?.body || ''} />
            </div>
          </>
        ) : (
          <p className="ais-card__sub">No template was generated in this pack.</p>
        )}
      </section>

      {/* Email */}
      <section className="ais-card ais-channel" aria-label="Email copy">
        <div className="flex items-center justify-between">
          <div className="ais-channel__brand">
            <span className="ais-channel__glyph ais-channel__glyph--mail">
              <Mail className="h-3.5 w-3.5" />
            </span>
            <div>
              <span className="ais-channel__name">Email Copy</span>
              <span className="ais-channel__tag">Subject + body</span>
            </div>
          </div>
          <span className="ais-channel__edit">Edit</span>
        </div>
        {pack.email ? (
          <>
            <div>
              <span className="ais-field-label">Subject</span>
              <p className="mt-1 text-[12.5px] font-bold text-theme-fg">{pack.email.subject}</p>
            </div>
            <EditableCopy
              value={pack.email.body}
              onSave={(body) => onSaveEmail?.(pack.email!.subject, body)}
              max={2000}
            />
            {/* Rendered email preview strip — like the design's "Preview in email" */}
            <div className="ais-mailprev" aria-label="Email preview">
              <div className="ais-mailprev__bar">
                <span className="ais-mailprev__dot" />
                <span className="ais-mailprev__dot" />
                <span className="ais-mailprev__dot" />
                <span className="ais-mailprev__subject">{pack.email.subject}</span>
              </div>
              <div className="ais-mailprev__body">
                <p className="whitespace-pre-wrap">{pack.email.body.slice(0, 220)}{pack.email.body.length > 220 ? '…' : ''}</p>
              </div>
            </div>
            <div className="ais-channel__foot">
              {onUseInEmail ? (
                <button type="button" className="ais-btn ais-btn--primary ais-btn--sm" onClick={onUseInEmail}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  Use in Email
                </button>
              ) : null}
              <CopyButton label="Copy" text={pack.email ? `${pack.email.subject}\n\n${pack.email.body}` : ''} />
            </div>
          </>
        ) : (
          <p className="ais-card__sub">No email was generated in this pack.</p>
        )}
      </section>
    </div>
  );
}
