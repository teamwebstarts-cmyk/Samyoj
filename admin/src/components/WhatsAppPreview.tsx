import { useState } from 'react';
import { BadgeCheck, CheckCheck, ChevronLeft, Copy, ExternalLink, MoreVertical, Phone } from 'lucide-react';
import { languageLabel, templateVariableCount, titleCaseCategory, type Draft } from '../lib/library-catalog';

/**
 * Live WhatsApp chat mock fed by a template draft — mirrors the client's
 * WhatsAppChatSurface + WhatsAppTemplateCard anatomy
 * (client/src/components/inbox/WhatsAppPreview.tsx, merged in PR #3).
 * Shared by the editor page (sticky aside) and the catalog "View" drawer.
 */

const chat = {
  bg: '#efeae2',
  bubbleSent: '#d1fae5',
  bubbleSentBorder: '#c5e8c0',
  timestamp: '#667781',
  tickRead: '#53bdeb',
  accent: '#00a884',
  text: '#111b21',
};

/**
 * Chat chrome — port of client WhatsAppPreviewHeader, simplified for the admin
 * library preview: fixed "Samyoj" business name, back chevron, kebab. No
 * avatar/badge/phone — those come from per-org identity on the client side.
 */
function ChatHeader() {
  return (
    <div className="flex items-center gap-2 bg-[#008069] px-2.5 py-2 text-white" role="group" aria-label="Samyoj">
      <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <p className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-tight">Samyoj</p>
      <MoreVertical className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
    </div>
  );
}

/** Media header placeholder — grey gradient block, exact client copy. */
function MediaHeaderPlaceholder({ format }: { format: string }) {
  const label = format === 'VIDEO' ? 'Video header' : format === 'DOCUMENT' ? 'Document header' : 'Image header';
  return (
    <div className="flex h-28 items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200/80 text-[11px] font-semibold text-neutral-500">
      {label}
    </div>
  );
}

/** Same icon set as client WhatsAppTemplateCard ButtonIcon. */
function ButtonIcon({ type }: { type: string }) {
  if (type === 'URL') return <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />;
  if (type === 'PHONE_NUMBER') return <Phone className="h-3.5 w-3.5" strokeWidth={2.25} />;
  if (type === 'COPY_CODE') return <Copy className="h-3.5 w-3.5" strokeWidth={2.25} />;
  return null;
}

export function WhatsAppPreview({ draft }: { draft: Draft }) {
  const hindi = draft.language === 'hi_IN';
  const filledBody = ((hindi ? draft.bodyHi : draft.body) || '').replace(/\{\{(\d+)\}\}/g, (_m, index: string) => {
    const sample = draft.bodyExamples[Number.parseInt(index, 10) - 1];
    return sample || `{{${index}}}`;
  });
  // Client wizard panel passes body || 'Your message body will appear here.' — placeholder is plain body text.
  const body = filledBody || 'Your message body will appear here.';
  const footer = hindi ? draft.footerHi || draft.footer : draft.footer;

  const buttons = draft.buttons.filter((button) => button.text.trim());
  const hasButton = buttons.length > 0;
  const hasMediaHeader = Boolean(draft.mediaFormat);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-[#efeae2] shadow-sm">
      <ChatHeader />
      {/* Chat wallpaper surface (client .wa-chat-surface-compact) */}
      <div
        className="p-2.5"
        style={{
          backgroundColor: chat.bg,
          backgroundImage:
            'linear-gradient(rgba(11,20,26,0.02), rgba(11,20,26,0.02)), radial-gradient(circle at 20% 30%, rgba(11,20,26,0.025) 0 2px, transparent 2px), radial-gradient(circle at 70% 60%, rgba(11,20,26,0.02) 0 2px, transparent 2px)',
        }}
      >
        {/* Outbound template card — green bubble, right-aligned (client WhatsAppTemplateCard, compact) */}
        <div className="flex justify-end">
          <div
            className="w-full max-w-[280px] overflow-hidden shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]"
            style={{ backgroundColor: chat.bubbleSent, borderRadius: '0.5rem 0.5rem 0.13rem 0.5rem' }}
          >
            {hasMediaHeader ? <MediaHeaderPlaceholder format={draft.mediaFormat!} /> : null}

            <div className="px-2.5 pt-2.5 pb-1">
              {draft.header && !hasMediaHeader ? (
                <p className="text-[13px] font-medium leading-snug" style={{ color: chat.text }}>
                  {draft.header.replace(/\{\{(\d+)\}\}/g, (_m, index: string) => {
                    const sample = draft.headerExamples[Number.parseInt(index, 10) - 1];
                    return sample || `{{${index}}}`;
                  })}
                </p>
              ) : null}
              <p
                className={`whitespace-pre-wrap break-words text-[12.5px] leading-[1.45] ${draft.header && !hasMediaHeader ? 'mt-1' : ''}`}
                style={{ color: chat.text, fontWeight: 500 }}
              >
                {body}
              </p>
              {footer ? (
                <p className="mt-2 text-[10px] leading-snug" style={{ color: chat.timestamp }}>
                  {footer}
                </p>
              ) : null}
            </div>

            {hasButton ? (
              <div className="border-t" style={{ borderColor: chat.bubbleSentBorder }}>
                {buttons.map((button, index) => (
                  <div
                    key={`${button.type}-${index}`}
                    className="wa-bubble-action flex w-full items-center justify-center gap-2 border-b py-2.5 text-[13px] font-medium last:border-b-0"
                    style={{ borderColor: chat.bubbleSentBorder, color: chat.accent }}
                  >
                    <ButtonIcon type={button.type} />
                    <span>{button.text}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex items-end justify-end gap-1 px-2 pb-1.5 pt-0.5">
              <span className="text-[9px] tabular-nums" style={{ color: chat.timestamp }}>12:30 PM</span>
              <CheckCheck className="h-3 w-3" style={{ color: chat.tickRead }} strokeWidth={2.5} aria-label="Read" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="shrink-0 text-[11.5px] font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-[11.5px] font-semibold text-slate-800">{children}</span>
    </div>
  );
}

/** Details section inside the preview card (below the phone surface) — always expanded. */
export function TemplateDetailsTable({ draft }: { draft: Draft }) {
  return (
    <div className="border-t border-slate-100">
      <div className="flex w-full items-center border-b border-slate-100 px-4 py-3">
        <span className="text-[13px] font-bold leading-5 text-slate-900">Details</span>
      </div>
      <div className="px-4 py-1.5">
          <DetailRow label="Name">
            <span className="truncate" title={draft.title || undefined}>
              {draft.title || 'Untitled'}
            </span>
          </DetailRow>
          <DetailRow label="Slug">
            <span className="truncate font-mono text-[11px]" title={draft.slug || undefined}>
              {draft.slug || 'untitled'}
            </span>
          </DetailRow>
          <DetailRow label="Category">
            <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/70">
              {draft.category === 'MARKETING'
                ? 'Marketing'
                : draft.category === 'AUTHENTICATION'
                  ? 'Authentication'
                  : draft.category === 'UTILITY'
                    ? 'Utility'
                    : titleCaseCategory(draft.category || 'UTILITY')}
            </span>
          </DetailRow>
          <DetailRow label="Language">{languageLabel(draft.language)}</DetailRow>
          <DetailRow label="Buttons">
            {draft.buttons.length
              ? draft.buttons.map((button) => button.text).join(', ')
              : 'None'}
          </DetailRow>
          <DetailRow label="Variables">
            {templateVariableCount(draft.body, draft.bodyHi)
              ? `${templateVariableCount(draft.body, draft.bodyHi)} variable${
                  templateVariableCount(draft.body, draft.bodyHi) === 1 ? '' : 's'
                } ${Array.from({ length: templateVariableCount(draft.body, draft.bodyHi) }, (_, i) => `{{${i + 1}}}`).join(' ')}`
              : 'None'}
          </DetailRow>
          <DetailRow label="Status">
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              {draft.published ? 'Published in library' : 'Draft'}
            </span>
          </DetailRow>
      </div>
    </div>
  );
}

/**
 * Shared column width the preview card resolves to (280px phone + 12px×2
 * gradient padding + 2px border). Details table and drawer actions snap to
 * the same width so everything in the drawer reads as one column.
 */
export const PREVIEW_COLUMN = 'mx-auto w-[306px] max-w-full';

/**
 * The exact editor-aside preview block: "Template Preview" header card with
 * language pills in the header row, phone surface, then the details table
 * as an inner section of the same card.
 * Shared by the editor aside and the catalog View drawer so both render
 * the same block. One identity, two surfaces — toggle only changes the lens.
 */
export function TemplatePreviewBlock({
  draft,
  templateLanguage,
  fullWidth = false,
  showHeader = true,
  lang: controlledLang,
  onLangChange,
}: {
  draft: Draft;
  templateLanguage?: string;
  /** Fill the containing column (editor aside) instead of the fixed 306px card. */
  fullWidth?: boolean;
  /** Hide the card's own header row (drawer renders it in the drawer header instead). */
  showHeader?: boolean;
  lang?: 'en' | 'hi';
  onLangChange?: (lang: 'en' | 'hi') => void;
}) {
  const base = templateLanguage && templateLanguage !== draft.language ? { ...draft, language: templateLanguage } : draft;
  const [internalLang, setInternalLang] = useState<'en' | 'hi'>(base.language === 'hi_IN' ? 'hi' : 'en');
  const lang = controlledLang ?? internalLang;
  const setLang = (next: 'en' | 'hi') => (onLangChange ? onLangChange(next) : setInternalLang(next));
  // Re-sync when a different row is previewed (drawer reuses one mounted instance).
  const effective = lang === 'hi'
    ? { ...base, language: 'hi_IN', body: base.bodyHi || base.body, footer: base.footerHi || base.footer }
    : { ...base, language: base.language === 'hi_IN' ? 'en_US' : base.language, body: base.body || base.bodyHi, footer: base.footer || base.footerHi };
  return (
    <div className={`${fullWidth ? 'w-full' : PREVIEW_COLUMN} overflow-hidden rounded-[0.875rem] border border-slate-200/85 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]`}>
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-slate-900">
            <TemplatePreviewGlyph />
            Template Preview
          </p>
          <PreviewLanguagePills lang={lang} onChange={setLang} />
        </div>
      ) : null}
      <div className="bg-gradient-to-b from-slate-50/60 to-slate-100/30 p-3">
        {/* Phone surface stays 280px for chat realism; centered so left/right
            spacing stays even when the card spans a wider column. */}
        <div className="mx-auto w-[280px] max-w-full">
          <WhatsAppPreview draft={effective} />
        </div>
      </div>
      <TemplateDetailsTable draft={base} />
    </div>
  );
}

/** WhatsApp glyph used by the preview header (editor card + drawer header). */
export function TemplatePreviewGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[#25D366]" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.66 15.02L2 22l5.12-1.34A10 10 0 1 0 12 2Zm5.4 14.02c-.23.64-1.35 1.23-1.86 1.27-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.66-4.08-.14-.18-1.12-1.48-1.12-2.82 0-1.34.7-2 .95-2.27.25-.28.55-.35.73-.35h.52c.17 0 .4-.06.62.48.23.55.77 1.9.84 2.04.07.14.11.3.02.48-.09.19-.5.75-.68.96-.13.15-.22.24-.1.48.12.23.55.9 1.18 1.46.81.72 1.49.95 1.7 1.05.21.1.34.08.46-.05.14-.14.55-.64.7-.86.14-.23.28-.19.48-.11.19.07 1.23.58 1.44.69.21.1.35.15.4.24.05.09.05.53-.18 1.17Z" />
    </svg>
  );
}

/** EN/HI lens — tab control in the editor card header and the drawer header. */
export function PreviewLanguagePills({ lang, onChange }: { lang: 'en' | 'hi'; onChange: (lang: 'en' | 'hi') => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="Preview language">
      {(['en', 'hi'] as const).map((option) => {
        const active = lang === option;
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option)}
            className={`rounded-md px-3 py-1 text-[11px] font-bold transition ${
              active ? 'bg-white text-indigo-700 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {option === 'en' ? 'English' : 'हिन्दी'}
          </button>
        );
      })}
    </div>
  );
}
