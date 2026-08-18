import { Reply } from 'lucide-react';
import type { InteractiveButton, MessageMetadata } from '../../types';
import { StatusIcon, WhatsAppInteractiveCard } from './WhatsAppPreview';

type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

interface InteractiveMessageCardProps {
  body: string;
  buttons?: InteractiveButton[];
  direction: 'inbound' | 'outbound';
  time: string;
  status?: MessageStatus;
  isButtonReply?: boolean;
  /** Parent interactive body (from reply-to) — nested WhatsApp-style quote inside the card. */
  replyPreview?: string | null;
  metadata?: MessageMetadata | null;
}

function resolveInteractiveMode(metadata?: MessageMetadata | null): 'reply' | 'cta_url' | 'cta_call' | 'list' | 'call_permission' {
  if (metadata?.interactive?.mode === 'call_permission') return 'call_permission';
  if (metadata?.ctaType === 'url') return 'cta_url';
  if (metadata?.ctaType === 'call') return 'cta_call';
  if (metadata?.listMenu) return 'list';
  return 'reply';
}

export default function InteractiveMessageCard({
  body,
  buttons = [],
  direction,
  time,
  status,
  isButtonReply,
  replyPreview,
  metadata,
}: InteractiveMessageCardProps) {
  const isOutbound = direction === 'outbound';

  if (isButtonReply) {
    const optionTitle = body.trim() || metadata?.buttonReplyId || 'Option';
    const quoteText = replyPreview?.trim();

    return (
      <div
        className={`w-full rounded-lg px-3 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] wa-msg-font ${
          isOutbound
            ? 'rounded-br-[2px] wa-bubble-sent'
            : 'rounded-bl-[2px] wa-bubble-received'
        }`}
      >
        {quoteText ? (
          <div className="mb-1.5 overflow-hidden rounded-md border-l-[3px] border-chat-accent bg-black/[0.06] px-2 py-1.5 dark:bg-white/10">
            {/* Inbound button taps usually quote our outbound interactive → label as You. */}
            <p className="text-[11px] font-semibold leading-none wa-accent-text">
              {isOutbound ? 'Reply' : 'You'}
            </p>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-chat-timestamp">
              {quoteText}
            </p>
          </div>
        ) : null}
        <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-medium wa-accent-text">
          <Reply className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          <span>Selected option</span>
        </div>
        <p className="wa-msg-body whitespace-pre-wrap break-words">{optionTitle}</p>
        <div className="mt-0.5 flex items-end justify-end gap-1">
          <span className="text-[11px] tabular-nums wa-timestamp">{time}</span>
          {isOutbound && status && <StatusIcon status={status} />}
        </div>
      </div>
    );
  }

  const interactive = metadata?.interactive;
  const mode = interactive?.mode || resolveInteractiveMode(metadata);

  return (
    <WhatsAppInteractiveCard
      mode={mode}
      header={interactive?.header}
      body={body}
      footer={interactive?.footer}
      buttons={buttons}
      ctaLabel={interactive?.ctaLabel || buttons[0]?.title}
      listButtonLabel={interactive?.listButtonLabel || buttons[0]?.title}
      listSections={interactive?.listSections}
      direction={direction}
      time={time}
      status={status}
      callPermissionStatus={metadata?.callPermissionStatus}
    />
  );
}
