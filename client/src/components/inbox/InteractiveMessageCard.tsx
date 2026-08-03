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
  metadata?: MessageMetadata | null;
}

function resolveInteractiveMode(metadata?: MessageMetadata | null): 'reply' | 'cta_url' | 'cta_call' | 'list' {
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
  metadata,
}: InteractiveMessageCardProps) {
  const isOutbound = direction === 'outbound';

  if (isButtonReply) {
    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[85%] rounded-lg px-3 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] sm:max-w-[75%] ${
            isOutbound
              ? 'rounded-br-[2px] bg-[#d9fdd3] text-[#111b21]'
              : 'rounded-bl-[2px] bg-white text-[#111b21]'
          }`}
        >
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#008069]">
            <Reply className="h-3 w-3" strokeWidth={2.5} />
            <span>Selected option</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.35]">{body}</p>
          <div className="mt-0.5 flex items-end justify-end gap-1">
            <span className="text-[11px] tabular-nums text-[#667781]">{time}</span>
            {isOutbound && status && <StatusIcon status={status} />}
          </div>
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
    />
  );
}
