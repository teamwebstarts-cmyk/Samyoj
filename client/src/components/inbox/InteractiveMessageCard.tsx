import { Reply } from 'lucide-react';
import type { InteractiveButton } from '../../types';
import { StatusIcon } from './WhatsAppPreview';

type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

interface InteractiveMessageCardProps {
  body: string;
  buttons?: InteractiveButton[];
  direction: 'inbound' | 'outbound';
  time: string;
  status?: MessageStatus;
  isButtonReply?: boolean;
}

export default function InteractiveMessageCard({
  body,
  buttons = [],
  direction,
  time,
  status,
  isButtonReply,
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

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`overflow-hidden rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          isOutbound ? 'rounded-br-[2px]' : 'rounded-bl-[2px]'
        } max-w-[85%] sm:max-w-[75%]`}
      >
        <div className={`px-3.5 pt-3 pb-1.5 ${isOutbound ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.35] text-[#111b21]">
            {body}
          </p>
          <div className="mt-1 flex items-end justify-end gap-1">
            <span className="text-[11px] tabular-nums text-[#667781]">{time}</span>
            {isOutbound && status && <StatusIcon status={status} />}
          </div>
        </div>

        {buttons.length > 0 && (
          <div className={`border-t border-[#e9edef] ${isOutbound ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
            {buttons.map((btn, i) => (
              <div
                key={`${btn.id}-${i}`}
                className={`flex w-full items-center justify-center border-[#c5e8c0] py-2.5 text-[13px] font-medium text-[#008069] ${
                  i < buttons.length - 1 ? 'border-b' : ''
                }`}
              >
                {btn.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
