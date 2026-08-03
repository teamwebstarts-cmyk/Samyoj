import { ChevronRight, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CannedReply } from '../../../types';
import { DetailsSectionCard, DetailsSectionHeader, detailsAddLinkClassName } from './DetailsSectionCard';

interface QuickRepliesSectionProps {
  replies: CannedReply[];
  onSelect: (reply: CannedReply) => void;
}

export default function QuickRepliesSection({ replies, onSelect }: QuickRepliesSectionProps) {
  return (
    <DetailsSectionCard data-section="quickReplies">
      <DetailsSectionHeader
        icon={<Zap className="h-3.5 w-3.5" strokeWidth={2.25} />}
        title="Quick replies"
        action={
          <Link to="/settings?tab=inbox" className={detailsAddLinkClassName()}>
            + Add new
          </Link>
        }
      />

      {replies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-theme-border/80 bg-theme-subtle/40 px-3 py-3.5 text-center dark:bg-neutral-950/30">
          <p className="text-[12px] font-semibold text-theme-fg">No quick replies yet</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-theme-muted">
            Save a keyword like thanks — then type /thanks in the composer.
          </p>
          <Link
            to="/settings?tab=inbox"
            className="mt-2 inline-flex text-[12px] font-semibold text-whatsapp-700 hover:underline dark:text-whatsapp-400"
          >
            Create in Settings
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100/90 overflow-hidden rounded-xl border border-theme-border/70 bg-white/40 dark:divide-neutral-800/80 dark:border-neutral-800/70 dark:bg-neutral-950/30">
          {replies.map((reply) => (
            <li key={reply.id}>
              <button
                type="button"
                onClick={() => onSelect(reply)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-whatsapp-500/[0.06] focus-visible:bg-whatsapp-500/[0.08] focus-visible:outline-none dark:hover:bg-whatsapp-500/10"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-bold tracking-tight text-theme-fg">
                    /{reply.shortcut}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-theme-muted">
                    {reply.title || reply.content}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </DetailsSectionCard>
  );
}
