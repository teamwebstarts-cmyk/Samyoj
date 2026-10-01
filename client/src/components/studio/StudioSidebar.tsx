import { useState } from 'react';
import { Bookmark, Instagram, Mail, Megaphone, Rocket, Sparkles } from 'lucide-react';

/**
 * Review-screen side rail from the approved design:
 * Next steps (channel hand-offs) + Save this content pack (draft name).
 * Hand-off actions live here; the main column stays review/edit-only.
 */
export function StudioNextSteps({
  onUseInPosts,
  onOpenInTemplates,
  onUseInEmail,
}: {
  onUseInPosts?: () => void;
  onOpenInTemplates?: () => void;
  onUseInEmail?: () => void;
}) {
  const steps = [
    {
      icon: Instagram,
      glyph: 'ig',
      title: 'Use in Instagram Posts',
      body: 'Open Instagram Posts and use this content with images and caption.',
      onClick: onUseInPosts,
    },
    {
      icon: Megaphone,
      glyph: 'wa',
      title: 'Open in WhatsApp Templates',
      body: 'Create and submit this template from your Templates page.',
      onClick: onOpenInTemplates,
    },
    {
      icon: Mail,
      glyph: 'mail',
      title: 'Insert in Email Compose',
      body: 'Use this content in your Email Compose.',
      onClick: onUseInEmail,
    },
  ];

  return (
    <section className="ais-card p-4" aria-label="Next steps">
      <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold text-theme-fg">
        <Rocket className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        Next steps
      </h2>
      <p className="mt-1 text-[11px] font-semibold text-theme-muted">
        Use this content in your channels. AI Studio only creates content. It does not send or publish.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {steps.map((step) => (
          <button
            key={step.title}
            type="button"
            className="ais-next"
            onClick={step.onClick}
            disabled={!step.onClick}
          >
            <span className={`ais-next__glyph ais-next__glyph--${step.glyph}`}>
              <step.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <b className="ais-next__title">{step.title}</b>
              <i className="ais-next__body">{step.body}</i>
            </span>
            <span className="ais-next__arrow" aria-hidden>→</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Save-as-draft card with the design's editable draft name. */
export function StudioSaveDraft({
  defaultName,
  savedAt,
  onSave,
}: {
  defaultName: string;
  savedAt: string | null;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <section className="ais-card p-4" aria-label="Save this content pack">
      <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold text-theme-fg">
        <Bookmark className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        Save this content pack
      </h2>
      <p className="mt-1 text-[11px] font-semibold text-theme-muted">
        Save your content to run reviews or make changes later.
      </p>
      {savedAt ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          ✓ Saved{savedAt ? ` · ${savedAt}` : ''}
        </p>
      ) : null}
      <label className="mt-2 flex flex-col gap-1">
        <span className="ais-field-label">Draft name</span>
        <input
          className="ais-input"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          aria-label="Draft name"
        />
      </label>
      <button
        type="button"
        className="ais-btn ais-btn--primary ais-btn--sm mt-2 w-full"
        onClick={() => onSave(name.trim() || defaultName)}
      >
        <Bookmark className="h-3.5 w-3.5" />
        Save as Draft
      </button>
    </section>
  );
}

/** "Need more variations?" upsell card — honest: opens a new brief, no hidden magic. */
export function StudioVariations({ onNewBrief }: { onNewBrief: () => void }) {
  return (
    <section className="ais-card ais-variations p-4" aria-label="Need more variations">
      <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold text-theme-fg">
        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        Need more variations?
      </h2>
      <p className="mt-1 text-[11px] font-semibold text-theme-muted">
        Try different themes, copy styles or add more slides to create new versions of this content.
      </p>
      <button type="button" className="ais-btn ais-btn--primary ais-btn--sm mt-3 w-full" onClick={onNewBrief}>
        <Sparkles className="h-3.5 w-3.5" />
        Create more variations
      </button>
    </section>
  );
}
