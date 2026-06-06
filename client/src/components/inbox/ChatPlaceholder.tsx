import { MessageSquare } from 'lucide-react';

export default function ChatPlaceholder() {
  return (
    <div className="inbox-chat-bg flex flex-1 flex-col items-center justify-center p-8">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-8 rounded-full bg-whatsapp-500/10 blur-3xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-white shadow-panel ring-1 ring-emerald-100">
          <MessageSquare className="h-9 w-9 text-whatsapp-600" strokeWidth={1.75} />
        </div>
      </div>
      <h2 className="mt-6 text-lg font-extrabold tracking-tight text-neutral-900">Your inbox</h2>
      <p className="mt-2 max-w-xs text-center text-[13px] font-medium leading-relaxed text-neutral-600">
        Select a conversation from the list to view messages and reply to customers.
      </p>
      <div className="mt-6 flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-whatsapp-700 shadow-sm">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-500 opacity-50" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
        </span>
        Real-time updates enabled
      </div>
    </div>
  );
}
