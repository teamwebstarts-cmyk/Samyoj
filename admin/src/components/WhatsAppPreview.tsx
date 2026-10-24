import { useState } from 'react';
import { BadgeCheck, Building2, CheckCheck, ChevronDown, ChevronLeft, Copy, ExternalLink, MoreVertical, Phone } from 'lucide-react';
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

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

/** Same formatting as client formatPhoneDisplay (utils/formatPhone.ts). */
function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}

/** Identity resolution — same fields as client resolveWhatsAppPreviewIdentity. */
type PreviewIdentity = {
  title: string;
  subtitle: string | null;
  initials: string;
  showOfficialBadge: boolean;
  usingFallback: boolean;
};

const WHATSAPP_BUSINESS_FALLBACK = 'WhatsApp Business';

export function resolvePreviewIdentity(input: {
  companyName?: string | null;
  phoneNumber?: string | null;
  officialBusinessAccount?: boolean | null;
}): PreviewIdentity {
  const company = input.companyName?.trim() || '';
  const usingFallback = !company;
  const rawPhone = input.phoneNumber?.trim() || '';
  return {
    title: company || WHATSAPP_BUSINESS_FALLBACK,
    subtitle: rawPhone ? formatPhoneDisplay(rawPhone) : null,
    initials: company ? initialsFromName(company) : '',
    showOfficialBadge: Boolean(input.officialBusinessAccount),
    usingFallback,
  };
}

/**
 * Chat chrome — exact port of client WhatsAppPreviewHeader:
 * back chevron, initials avatar (Building2 when no company), optional title
 * verified-badge, subtitle phone, kebab. 3000 default: template title as the
 * business name, no fabricated phone/badge.
 */
function ChatHeader({ draft }: { draft: Draft }) {
  const resolved = resolvePreviewIdentity({
    companyName: draft.title.trim() || null,
    phoneNumber: null,
    officialBusinessAccount: null,
  });
  const avatarSize = 'h-7 w-7 text-[9px]';
  const titleSize = 'text-[12px]';
  const subtitleSize = 'text-[9px]';
  return (
    <div
      className="flex items-center gap-2 bg-[#008069] px-2.5 py-2 text-white"
      role="group"
      aria-label={`${resolved.title}${resolved.subtitle ? `, ${resolved.subtitle}` : ''}`}
    >
      <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-white/18 font-extrabold tracking-wide ${avatarSize}`}
        aria-hidden
      >
        {resolved.initials ? resolved.initials : <Building2 className="h-3.5 w-3.5" strokeWidth={2.25} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1 truncate font-semibold leading-tight ${titleSize}`}>
          <span className="truncate">{resolved.title}</span>
          {resolved.showOfficialBadge ? (
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-200" aria-label="Official business account" />
          ) : null}
        </p>
        {resolved.subtitle ? (
          <p className={`truncate font-medium leading-tight text-white/75 ${subtitleSize}`}>{resolved.subtitle}</p>
        ) : null}
      </div>
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
    <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-[#efeae2] shadow-sm">
      <ChatHeader draft={draft} />
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

/** Collapsible details table under the phone — same 306px column as the preview card. */
export function TemplateDetailsTable({ draft }: { draft: Draft }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`${PREVIEW_COLUMN} mt-3 overflow-hidden rounded-[0.875rem] border border-slate-200/85 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50/80"
      >
        <span className="text-[13px] font-bold leading-5 text-slate-900">Template details</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open ? (
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
      ) : null}
    </div>
  );
}

/**
 * The exact editor-aside preview block: "Template Preview" header card with
 * language pills in the header row, phone surface, then the details table.
 * Shared by the editor aside and the catalog View drawer so both render
 * the same block. One identity, two surfaces — toggle only changes the lens.
 */
/**
 * Shared column width the preview card resolves to (280px phone + 12px×2
 * gradient padding + 2px border). Details table and drawer actions snap to
 * the same width so everything in the drawer reads as one column.
 */
export const PREVIEW_COLUMN = 'mx-auto w-[306px] max-w-full';

export function TemplatePreviewBlock({ draft, templateLanguage }: { draft: Draft; templateLanguage?: string }) {
  const base = templateLanguage && templateLanguage !== draft.language ? { ...draft, language: templateLanguage } : draft;
  const [lang, setLang] = useState<'en' | 'hi'>(base.language === 'hi_IN' ? 'hi' : 'en');
  // Re-sync when a different row is previewed (drawer reuses one mounted instance).
  const effective = lang === 'hi'
    ? { ...base, language: 'hi_IN', body: base.bodyHi || base.body, footer: base.footerHi || base.footer }
    : { ...base, language: base.language === 'hi_IN' ? 'en_US' : base.language, body: base.body || base.bodyHi, footer: base.footer || base.footerHi };
  return (
    <div className="space-y-3">
      <div className={`${PREVIEW_COLUMN} overflow-hidden rounded-[0.875rem] border border-slate-200/85 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-bold leading-5 text-slate-900">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-[#25D366]" aria-hidden>
              <path d="M12 2a10 10 0 0 0-8.66 15.02L2 22l5.12-1.34A10 10 0 1 0 12 2Zm5.4 14.02c-.23.64-1.35 1.23-1.86 1.27-.5.05-.97.23-3.27-.68-2.77-1.09-4.53-3.9-4.66-4.08-.14-.18-1.12-1.48-1.12-2.82 0-1.34.7-2 .95-2.27.25-.28.55-.35.73-.35h.52c.17 0 .4-.06.62.48.23.55.77 1.9.84 2.04.07.14.11.3.02.48-.09.19-.5.75-.68.96-.13.15-.22.24-.1.48.12.23.55.9 1.18 1.46.81.72 1.49.95 1.7 1.05.21.1.34.08.46-.05.14-.14.55-.64.7-.86.14-.23.28-.19.48-.11.19.07 1.23.58 1.44.69.21.1.35.15.4.24.05.09.05.53-.18 1.17Z" />
            </svg>
            Template Preview
          </p>
          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Preview language">
            {(['en', 'hi'] as const).map((option) => {
              const active = lang === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLang(option)}
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                    active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {option === 'en' ? 'English' : 'हिन्दी'}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-gradient-to-b from-slate-50/60 to-slate-100/30 p-3">
          <div className="w-[280px] max-w-full">
            <WhatsAppPreview draft={effective} />
          </div>
        </div>
      </div>
      <TemplateDetailsTable draft={base} />
    </div>
  );
}
