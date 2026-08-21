import { useEffect, useRef, useState } from 'react';
import { Ticket } from 'lucide-react';
import InboxModal from './InboxModal';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { FOCUS_RING_CLASS, useAutoFocus } from '../../hooks/inboxA11y';

export interface TicketFormValues {
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  description?: string;
}

interface CreateTicketModalProps {
  open: boolean;
  defaultTitle: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: TicketFormValues) => void;
}

const PRIORITIES: Array<{
  value: TicketFormValues['priority'];
  label: string;
  chip: string;
}> = [
  { value: 'LOW', label: 'Low', chip: 'bg-slate-100 text-slate-700' },
  { value: 'MEDIUM', label: 'Medium', chip: 'bg-sky-100 text-sky-700' },
  { value: 'HIGH', label: 'High', chip: 'bg-amber-100 text-amber-700' },
  { value: 'URGENT', label: 'Urgent', chip: 'bg-rose-100 text-rose-700' },
];

export default function CreateTicketModal({
  open,
  defaultTitle,
  submitting,
  onClose,
  onSubmit,
}: CreateTicketModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [priority, setPriority] = useState<TicketFormValues['priority']>('MEDIUM');
  const [description, setDescription] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  useAutoFocus(titleInputRef, open);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setPriority('MEDIUM');
      setDescription('');
    }
  }, [open, defaultTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      priority,
      description: description.trim() || undefined,
    });
  };

  return (
    <InboxModal
      open={open}
      onClose={onClose}
      title="Create ticket"
      subtitle="Add this chat to the Tickets page so the team can follow up and hit the reply deadline."
      icon={Ticket}
      // Match the inbox Create-ticket rail button: emerald token + Lucide Ticket icon.
      iconClassName="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/25"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <AppInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What does the customer need?"
          required
          ref={titleInputRef}
        />

        <div className="space-y-1.5">
          <span className="text-label text-theme-secondary">Priority</span>
          <div
            role="group"
            aria-label="Ticket priority"
            className="grid grid-cols-2 gap-1 rounded-xl bg-theme-subtle/80 p-1 ring-1 ring-theme-border/70 sm:grid-cols-4"
          >
            {PRIORITIES.map((p) => {
              const selected = priority === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  aria-pressed={selected}
                  className={`rounded-lg px-1.5 py-2 text-[12px] font-bold transition ${FOCUS_RING_CLASS} ${
                    selected
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.28)]'
                      : 'text-theme-secondary hover:bg-theme-surface/80 hover:text-theme-fg'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <AppTextarea
          label="Description"
          hint="Team only"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What still needs to happen? The customer will not see this — it appears on the ticket sidebar so the team knows what's next."
          rows={4}
        />

        <div className="flex flex-col-reverse gap-2 border-t border-theme-border/60 pt-3.5 sm:flex-row sm:justify-end">
          <AppButton variant="secondary" onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
            Cancel
          </AppButton>
          <AppButton
            type="submit"
            loading={submitting}
            disabled={!title.trim()}
            icon={<Ticket className="h-4 w-4" strokeWidth={2.25} />}
            className="w-full sm:w-auto"
          >
            Create ticket
          </AppButton>
        </div>
      </form>
    </InboxModal>
  );
}
