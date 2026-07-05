import { useEffect, useRef } from 'react';
import { ChevronLeft, MoreVertical, Paperclip, Phone, Smile, Video } from 'lucide-react';
import InteractiveMessageCard from '../inbox/InteractiveMessageCard';
import { WhatsAppBubble } from '../inbox/WhatsAppPreview';
import type { FlowNode } from '../../types';
import { buildFullFlowPreviewMessages } from './flowUtils';

interface FlowPhoneMockupProps {
  nodes: FlowNode[];
  startNodeId?: string;
  businessName?: string;
  className?: string;
}

export default function FlowPhoneMockup({
  nodes,
  startNodeId,
  businessName = 'Your Business',
  className = '',
}: FlowPhoneMockupProps) {
  const chatRef = useRef<HTMLDivElement>(null);
  const messages = buildFullFlowPreviewMessages(nodes, startNodeId);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, startNodeId]);

  return (
    <div className={`mx-auto w-full max-w-[300px] ${className}`}>
      <div className="flow-phone-device">
        {/* Status bar */}
        <div className="flow-phone-device__status">
          <span className="text-[11px] font-semibold tabular-nums text-white">9:41</span>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-white/90" />
            <span className="h-2.5 w-4 rounded-sm border border-white/80" />
          </div>
        </div>

        {/* WhatsApp header */}
        <div className="flow-phone-device__header">
          <button type="button" className="text-white/90" aria-hidden>
            <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-[11px] font-bold text-[#075E54]">
              {businessName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold leading-tight text-white">{businessName}</p>
              <p className="text-[11px] leading-tight text-[#b8e0d8]">online</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-white/90">
            <Video className="h-[18px] w-[18px]" strokeWidth={2} />
            <Phone className="h-[17px] w-[17px]" strokeWidth={2} />
            <MoreVertical className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
        </div>

        {/* Scrollable chat */}
        <div ref={chatRef} className="flow-phone-device__chat">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-2xl shadow-sm">
                💬
              </div>
              <p className="mt-3 text-[13px] font-semibold text-[#3b4a54]">Add a step to preview</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#667781]">
                Your auto-replies will appear here like on WhatsApp.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 py-1">
              <div className="mb-2 flex justify-center">
                <span className="rounded-lg bg-[#ffffffbf] px-2.5 py-1 text-[10px] font-medium text-[#54656f] shadow-sm">
                  TODAY
                </span>
              </div>

              {messages.map((msg) => {
                if (msg.kind === 'notice') {
                  return (
                    <div key={msg.id} className="flex justify-center px-2 py-1">
                      <span className="rounded-lg bg-[#fff9c4]/95 px-2.5 py-1 text-center text-[10px] font-medium leading-relaxed text-[#54656f] shadow-sm">
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                if (msg.kind === 'buttons') {
                  return (
                    <InteractiveMessageCard
                      key={msg.id}
                      body={msg.text}
                      buttons={msg.buttons}
                      direction="outbound"
                      time={msg.time}
                      status="read"
                    />
                  );
                }

                if (msg.kind === 'button_reply') {
                  return (
                    <InteractiveMessageCard
                      key={msg.id}
                      body={msg.text}
                      direction="inbound"
                      time={msg.time}
                      isButtonReply
                    />
                  );
                }

                return (
                  <WhatsAppBubble
                    key={msg.id}
                    direction={msg.kind === 'outbound' ? 'outbound' : 'inbound'}
                    content={msg.text}
                    time={msg.time}
                    status={msg.kind === 'outbound' ? msg.status : undefined}
                    compact
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="flow-phone-device__composer">
          <Smile className="h-5 w-5 shrink-0 text-[#8696a0]" strokeWidth={2} />
          <div className="h-9 min-w-0 flex-1 rounded-full bg-white px-4 text-[12px] leading-9 text-[#8696a0]">
            Message
          </div>
          <Paperclip className="h-5 w-5 shrink-0 text-[#8696a0]" strokeWidth={2} />
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#008069] text-[13px] text-white">
            ➤
          </div>
        </div>

        {/* Home indicator */}
        <div className="flow-phone-device__home">
          <div className="mx-auto h-1 w-[110px] rounded-full bg-white/35" />
        </div>
      </div>

      <p className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
        Customer preview
      </p>
    </div>
  );
}
