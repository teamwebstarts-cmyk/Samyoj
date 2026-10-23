import { BadgeCheck, Building2, CheckCheck, ChevronLeft, Copy, ExternalLink, MoreVertical, Phone } from 'lucide-react';
import type { Draft } from '../lib/library-catalog';

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
