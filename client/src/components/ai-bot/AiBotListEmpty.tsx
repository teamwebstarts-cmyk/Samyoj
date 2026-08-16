import { MessageSquare, PhoneCall, Plus, Sparkles } from 'lucide-react';
import AppButton from '../ui/AppButton';
import EmptyState from '../ui/EmptyState';

interface AiBotListEmptyProps {
  mode: 'new' | 'filter';
  hasSearch: boolean;
  channel?: 'CHAT' | 'CALL';
  onCreate: () => void;
  onClearFilters: () => void;
}

const CHAT_HINTS = ['Write personality', 'Write answers', 'Try a message'];
const CALL_HINTS = ['Four voices', 'Write answers', 'When they call'];

/** Compact empty body inside the bots list — not a tall poster. */
export default function AiBotListEmpty({
  mode,
  hasSearch,
  channel = 'CHAT',
  onCreate,
  onClearFilters,
}: AiBotListEmptyProps) {
  const calling = channel === 'CALL';

  if (mode === 'new') {
    const hints = calling ? CALL_HINTS : CHAT_HINTS;
    return (
      <div className="px-4 py-5 sm:px-5 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 max-w-lg">
            <p className="text-[15px] font-extrabold tracking-tight text-theme-fg">
              {calling ? 'No calling bot yet' : 'No chat bot yet'}
            </p>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-theme-secondary">
              {calling
                ? 'A few words is enough. We draft the voice, answers, and how calls are picked up. You check, then save.'
                : 'A few words is enough. We draft personality and answers. You check them, then save.'}
            </p>
          </div>
          <AppButton className="shrink-0 self-start sm:self-auto" icon={<Plus size={16} />} onClick={onCreate}>
            {calling ? 'New calling bot' : 'New chat bot'}
          </AppButton>
        </div>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {hints.map((hint) => (
            <li
              key={hint}
              className="inline-flex items-center gap-1.5 rounded-full border border-theme-border bg-theme-subtle px-2.5 py-1 text-[11px] font-semibold text-theme-secondary"
            >
              {hint === 'Write personality' || hint === 'Write answers' ? (
                <Sparkles className="h-3 w-3 text-emerald-600" strokeWidth={2.25} />
              ) : calling ? (
                <PhoneCall className="h-3 w-3 text-emerald-600" strokeWidth={2.25} />
              ) : (
                <MessageSquare className="h-3 w-3 text-emerald-600" strokeWidth={2.25} />
              )}
              {hint}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <EmptyState
      bare
      compact
      icon={calling ? PhoneCall : MessageSquare}
      variant="filter"
      title={hasSearch ? 'No bots match your search' : 'No bots for this filter'}
      description={
        hasSearch
          ? 'Try another name, or clear search and filters to see all bots.'
          : 'Nothing in this status right now. Switch filter or clear it to see every bot.'
      }
      action={
        <AppButton variant="secondary" onClick={onClearFilters}>
          Clear filters
        </AppButton>
      }
    />
  );
}
