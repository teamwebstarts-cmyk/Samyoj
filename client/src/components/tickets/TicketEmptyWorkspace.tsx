import { Link } from 'react-router-dom';
import { ArrowRight, Inbox, LifeBuoy, MessageSquare, Search, Settings2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import InboxEmptyIcon from '../inbox/InboxEmptyIcon';

const FLOW = [
  { title: 'Open a WhatsApp chat', detail: 'Pick the customer who still needs a follow-up.' },
  { title: 'Create a ticket', detail: 'Open chat details and tap the ticket icon. Add a title if you want.' },
  { title: 'It shows up here', detail: 'Reply from Inbox before the deadline, then resolve it.' },
];

interface TicketEmptyWorkspaceProps {
  mode: 'empty' | 'filter';
  onClearFilters?: () => void;
}

export default function TicketEmptyWorkspace({ mode, onClearFilters }: TicketEmptyWorkspaceProps) {
  if (mode === 'filter') {
    return (
      <div className="flex flex-col items-center px-4 py-14 text-center sm:px-6">
        <InboxEmptyIcon icon={Search} tone="muted" size="md" />
        <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">No tickets match</h3>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-theme-secondary">
          Try a different name, phone, or status.
        </p>
        {onClearFilters && (
          <AppButton variant="secondary" size="sm" className="mt-4" onClick={onClearFilters}>
            Clear filters
          </AppButton>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <InboxEmptyIcon icon={LifeBuoy} size="sm" />
            <div>
              <h3 className="text-[16px] font-bold tracking-tight text-theme-fg">No tickets yet</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-theme-secondary">
                You don’t create tickets from this page. Turn an Inbox chat into a ticket when it
                needs a reply deadline.
              </p>
            </div>
          </div>

          <ol className="mt-5 space-y-3">
            {FLOW.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-theme-fg">{step.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-theme-muted">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/inbox">
              <AppButton size="sm" icon={<Inbox size={15} />}>
                Open Inbox
              </AppButton>
            </Link>
            <Link to="/settings">
              <AppButton size="sm" variant="secondary" icon={<Settings2 size={15} />}>
                WhatsApp settings
              </AppButton>
            </Link>
          </div>
        </div>

        <div className="w-full min-w-0 rounded-2xl border border-theme-border bg-[#f7faf9] p-4 lg:max-w-xs dark:bg-slate-900/40">
          <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">How it connects</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-theme-fg">
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
            Chat
            <ArrowRight className="h-3.5 w-3.5 text-theme-muted" />
            Ticket
            <ArrowRight className="h-3.5 w-3.5 text-theme-muted" />
            Reply
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-theme-secondary">
            Same WhatsApp number, same customer chat. This list is only for follow-ups you already
            marked.
          </p>
        </div>
      </div>
    </div>
  );
}
