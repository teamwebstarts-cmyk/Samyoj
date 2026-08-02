import { AlertTriangle, MessageSquare, MessageSquareX, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import IconWell from './icons/IconWell';

interface NeedsAttentionCardProps {
  openChats: number;
  failedMessages: number;
}

export default function NeedsAttentionCard({ openChats, failedMessages }: NeedsAttentionCardProps) {
  const calm = openChats === 0 && failedMessages === 0;

  if (calm) {
    return (
      <section
        aria-label="Needs attention"
        className="dashboard-card flex h-full flex-col rounded-2xl border-emerald-100/90 bg-emerald-50/40 p-3.5 sm:p-4"
      >
        <div className="flex items-start gap-3">
          <IconWell accent="emerald" size="md">
            <MessageSquare className="h-4 w-4" strokeWidth={2} />
          </IconWell>
          <div>
            <h2 className="text-[13px] font-extrabold text-neutral-900 sm:text-[14px]">
              You&apos;re caught up
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-neutral-600">
              No open chats waiting and no failed messages right now.
            </p>
            <Link
              to="/inbox"
              className="mt-2 inline-flex items-center gap-0.5 text-[12.5px] font-bold text-whatsapp-700 hover:underline"
            >
              Open inbox
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Needs attention"
      className="dashboard-card flex h-full flex-col rounded-2xl border-rose-100 bg-rose-50/50 p-3.5 sm:p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-600" strokeWidth={2.25} aria-hidden />
        <h2 className="text-[13px] font-extrabold text-neutral-900 sm:text-[14px]">
          Needs attention
        </h2>
      </div>
      <ul className="space-y-2.5">
        {openChats > 0 && (
          <li className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconWell accent="emerald" size="sm" round badge={openChats}>
                <MessageSquare className="h-4 w-4" strokeWidth={2} />
              </IconWell>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-neutral-900">Open chats waiting</p>
                <p className="sr-only">{openChats.toLocaleString()} open conversations</p>
              </div>
            </div>
            <Link
              to="/inbox"
              className="inline-flex shrink-0 items-center gap-0.5 text-[11.5px] font-bold text-whatsapp-700 transition hover:underline"
            >
              Open Inbox
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        )}
        {failedMessages > 0 && (
          <li className="flex items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <IconWell accent="rose" size="sm" round badge={failedMessages}>
                <MessageSquareX className="h-4 w-4" strokeWidth={2} />
              </IconWell>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-neutral-900">Failed messages</p>
                <p className="sr-only">{failedMessages.toLocaleString()} failed messages</p>
              </div>
            </div>
            <Link
              to="/reports"
              className="inline-flex shrink-0 items-center gap-0.5 text-[11.5px] font-bold text-rose-700 transition hover:underline"
            >
              View Failures
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}
