import { Lock } from 'lucide-react';

interface CallSummaryNoteProps {
  summary: string;
  time?: string | null;
  messageId?: string;
}

/**
 * Agent-only post-call note. Flat paper card, even border, no drop shadow.
 * Never styled as inbound WhatsApp.
 */
export default function CallSummaryNote({ summary, time, messageId }: CallSummaryNoteProps) {
  return (
    <div
      className="flex items-center justify-center px-3 py-2.5"
      role="status"
      data-message-id={messageId}
    >
      <div className="w-full max-w-[min(100%,22rem)] overflow-hidden rounded-md border border-neutral-200/80 bg-white dark:border-neutral-700 dark:bg-neutral-900">
        <div className="min-w-0 px-3.5 py-2.5">
          <p className="inline-flex flex-wrap items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            <Lock className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.25} />
            Team only
            <span className="font-semibold normal-case tracking-normal text-neutral-400">· Call summary</span>
            {time ? (
              <span className="font-medium normal-case tracking-normal text-neutral-400">· {time}</span>
            ) : null}
          </p>
          <p className="mt-1 text-[13px] font-medium leading-snug text-neutral-800 dark:text-neutral-100">
            {summary}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-neutral-400">
            Not sent to the customer
          </p>
        </div>
      </div>
    </div>
  );
}
