import { CheckCheck, ExternalLink } from 'lucide-react';
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

/** Chat chrome: back chevron, initials avatar, business name + badge, kebab. */
function ChatHeader({ draft }: { draft: Draft }) {
  const title = draft.title || 'WhatsApp Business';
  return (
    <div className="flex items-center gap-2 bg-[#008069] px-2.5 py-2 text-white" role="group" aria-label={title}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-[9px] font-extrabold tracking-wide" aria-hidden>
        {initialsFromName(title) || <BuildingGlyph />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-[12px] font-semibold leading-tight">
          <span className="truncate">{title}</span>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-sky-200" fill="currentColor" aria-label="Official business account">
            <path d="M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69 3.1 5.5l.34 3.7L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12zm-12.91 4.72l-3.8-3.81 1.48-1.48 2.32 2.33 5.85-5.87 1.48 1.48-7.33 7.35z" />
          </svg>
        </p>
        <p className="truncate text-[9px] font-medium leading-tight text-white/75">Business Account</p>
      </div>
      <span className="shrink-0 text-[13px] leading-none opacity-70" aria-hidden>⋮</span>
    </div>
  );
}

function BuildingGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.25} aria-hidden>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
    </svg>
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

export function WhatsAppPreview({ draft }: { draft: Draft }) {
  const hindi = draft.language === 'hi_IN';
  const body = ((hindi ? draft.bodyHi : draft.body) || '').replace(/\{\{(\d+)\}\}/g, (_m, index: string) => {
    const sample = draft.bodyExamples[Number.parseInt(index, 10) - 1];
    return sample || `{{${index}}}`;
  });
  const footer = hindi ? draft.footerHi || draft.footer : draft.footer;

  const hasButton = Boolean(draft.buttonText && draft.buttonUrl);
  const hasMediaHeader = Boolean(draft.mediaFormat);
  const hasContent = Boolean(body || footer || hasMediaHeader || (draft.header && !hasMediaHeader));
  const empty = !hasContent && !hasButton;

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
        {/* Outbound template card — green bubble, right-aligned (client WhatsAppTemplateCard) */}
        <div className="flex justify-end">
          <div
            className={`w-full max-w-[280px] overflow-hidden shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${empty ? 'px-2.5 pb-1 pt-2' : ''}`}
            style={{ backgroundColor: chat.bubbleSent, borderRadius: '0.5rem 0.5rem 0.13rem 0.5rem' }}
          >
            {hasMediaHeader ? <MediaHeaderPlaceholder format={draft.mediaFormat!} /> : null}

            <div className={hasMediaHeader ? 'px-2.5 pt-2.5 pb-1' : ''}>
              {draft.header && !hasMediaHeader ? (
                <p className="text-[13px] font-medium leading-snug" style={{ color: chat.text }}>
                  {draft.header}
                </p>
              ) : null}
              {body ? (
                <p
                  className={`whitespace-pre-wrap break-words text-[12.5px] leading-[1.45] ${draft.header && !hasMediaHeader ? 'mt-1' : ''}`}
                  style={{ color: chat.text, fontWeight: 500 }}
                >
                  {body}
                </p>
              ) : null}
              {empty ? (
                <p className="text-[12.5px] italic leading-snug" style={{ color: chat.timestamp }}>
                  Your message body will appear here.
                </p>
              ) : null}
              {footer ? (
                <p className="mt-2 text-[10px] leading-snug" style={{ color: chat.timestamp }}>
                  {footer}
                </p>
              ) : null}
            </div>

            {hasButton ? (
              <div className="border-t" style={{ borderColor: chat.bubbleSentBorder }}>
                <div
                  className="wa-bubble-action flex w-full items-center justify-center gap-2 border-b py-2.5 text-[13px] font-medium"
                  style={{ borderColor: chat.bubbleSentBorder, color: chat.accent }}
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
                  <span>{draft.buttonText}</span>
                </div>
              </div>
            ) : null}

            <div className={`flex items-end justify-end gap-1 ${hasMediaHeader ? 'px-2 pb-1.5 pt-0.5' : empty ? 'px-0 pb-1 pt-0.5' : 'px-2.5 pb-1.5 pt-0.5'}`}>
              <span className="text-[9px] tabular-nums" style={{ color: chat.timestamp }}>12:30 PM</span>
              <CheckCheck className="h-3 w-3" style={{ color: chat.tickRead }} strokeWidth={2.5} aria-label="Read" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
