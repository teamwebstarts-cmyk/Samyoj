import type { ReactNode } from 'react';
import InteractiveMessageCard from '../inbox/InteractiveMessageCard';
import { WhatsAppBubble, WhatsAppChatSurface } from '../inbox/WhatsAppPreview';
import type { FlowNode } from '../../types';

const PREVIEWABLE_TYPES = new Set([
  'message',
  'handoff',
  'ai',
  'end',
  'assign',
  'buttons',
  'list',
  'question',
  'media',
  'template',
  'location',
  'contact_card',
  'request_callback',
  'wa_flow',
]);

const SAMPLE_ANSWERS: Record<string, string> = {
  name: 'Rahul Sharma',
  email: 'rahul@example.com',
  phone: '+91 98765 43210',
  custom: 'Customer answer',
};

interface FlowStepPreviewProps {
  node: FlowNode | null;
}

export default function FlowStepPreview({ node }: FlowStepPreviewProps) {
  if (!node || !PREVIEWABLE_TYPES.has(node.type)) return null;

  const time = '10:30';

  const shell = (children: ReactNode) => (
    <section className="space-y-2 rounded-2xl border border-neutral-200/70 bg-[#e5ddd5]/60 p-3">
      <p className="text-[12px] font-bold text-neutral-700">Customer will see this</p>
      <WhatsAppChatSurface compact>{children}</WhatsAppChatSurface>
    </section>
  );

  if (node.type === 'buttons') {
    const body = node.text?.trim() || 'Please choose an option:';
    const mode = node.buttonMode || 'reply';

    if (mode === 'url') {
      const label = node.ctaLabel?.trim() || 'Visit website';
      return shell(
        <InteractiveMessageCard
          body={body}
          buttons={[{ id: 'url', title: `🔗 ${label}` }]}
          direction="outbound"
          time={time}
          status="read"
        />
      );
    }

    if (mode === 'call') {
      const label = node.ctaLabel?.trim() || 'Call us';
      return shell(
        <InteractiveMessageCard
          body={body}
          buttons={[{ id: 'call', title: `📞 ${label}` }]}
          direction="outbound"
          time={time}
          status="read"
        />
      );
    }

    return shell(
      <InteractiveMessageCard
        body={body}
        buttons={(node.buttons || []).map((b) => ({ id: b.id, title: b.title || 'Option' }))}
        direction="outbound"
        time={time}
        status="read"
      />
    );
  }

  if (node.type === 'list') {
    const body = node.text?.trim() || 'Please select an option:';
    const menuLabel = node.listButtonLabel?.trim() || 'View options';
    const items = (node.listSections || []).flatMap((s) => s.rows);

    return shell(
      <div className="space-y-1.5">
        <InteractiveMessageCard
          body={body}
          buttons={[{ id: 'list', title: `☰ ${menuLabel}` }]}
          direction="outbound"
          time={time}
          status="read"
        />
        {items.length > 0 && (
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Menu options</p>
            {items.slice(0, 4).map((row) => (
              <div key={row.id} className="border-b border-neutral-100 py-1.5 last:border-0">
                <p className="text-[12px] font-semibold text-neutral-800">{row.title || 'Option'}</p>
                {row.description && (
                  <p className="text-[10px] text-neutral-500">{row.description}</p>
                )}
              </div>
            ))}
            {items.length > 4 && (
              <p className="pt-1 text-[10px] text-neutral-400">+{items.length - 4} more</p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (node.type === 'question') {
    const prompt = node.prompt?.trim() || 'What is your name?';
    const sample = SAMPLE_ANSWERS[node.field || 'name'] || 'Customer answer';

    return shell(
      <div className="space-y-1.5">
        <WhatsAppBubble direction="outbound" content={prompt} time={time} status="read" compact />
        <WhatsAppBubble direction="inbound" content={sample} time="10:31" compact />
      </div>
    );
  }

  if (node.type === 'media') {
    const caption = node.mediaCaption?.trim();
    const url = node.mediaUrl?.trim();
    const type = node.mediaType || 'image';

    return shell(
      <WhatsAppBubble
        direction="outbound"
        content={caption}
        time={time}
        status="read"
        compact
        mediaClassName="bg-neutral-100"
      >
        {url && type === 'image' ? (
          <img src={url} alt="" className="max-h-36 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="flex h-24 items-center justify-center bg-neutral-200/80 text-[11px] font-medium text-neutral-500">
            {type === 'image' ? '🖼️ Image' : type === 'video' ? '🎬 Video' : type === 'audio' ? '🎵 Audio' : '📄 Document'}
            {!url && ' — add URL to preview'}
          </div>
        )}
      </WhatsAppBubble>
    );
  }

  if (node.type === 'template') {
    const body = node.text?.trim() || `Approved template: ${node.templateName || 'select one'}`;
    return shell(
      <WhatsAppBubble
        direction="outbound"
        content={body}
        header={node.templateName ? `📋 ${node.templateName}` : undefined}
        time={time}
        status="delivered"
        compact
      />
    );
  }

  if (node.type === 'location') {
    const name = node.locationName?.trim() || 'Our location';
    const text = node.text?.trim() || 'Here is our location:';
    return shell(
      <div className="space-y-1.5">
        <WhatsAppBubble direction="outbound" content={text} time={time} status="read" compact />
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="flex h-20 items-center justify-center bg-emerald-50 text-2xl">📍</div>
          <div className="px-2.5 py-2">
            <p className="text-[12px] font-semibold text-neutral-800">{name}</p>
            {node.locationAddress && (
              <p className="text-[10px] text-neutral-500">{node.locationAddress}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (node.type === 'contact_card') {
    const name = node.contactName?.trim() || 'Support Team';
    const text = node.text?.trim() || 'Save our contact:';
    return shell(
      <div className="space-y-1.5">
        <WhatsAppBubble direction="outbound" content={text} time={time} status="read" compact />
        <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[12px] font-bold text-neutral-800">{name}</p>
          {node.contactPhone && <p className="text-[11px] text-neutral-500">{node.contactPhone}</p>}
        </div>
      </div>
    );
  }

  if (node.type === 'wa_flow') {
    const body = node.text?.trim() || 'Please fill out this form:';
    const cta = node.waFlowCta?.trim() || 'Open form';
    return shell(
      <InteractiveMessageCard
        body={body}
        buttons={[{ id: 'flow', title: `📝 ${cta}` }]}
        direction="outbound"
        time={time}
        status="read"
      />
    );
  }

  const text = node.text?.trim();
  if (!text) return null;

  return shell(
    <WhatsAppBubble direction="outbound" content={text} time={time} status="read" compact />
  );
}
