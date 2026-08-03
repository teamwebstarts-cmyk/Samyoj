import { useEffect, useRef, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
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

const PRIORITIES: Array<{ value: TicketFormValues['priority']; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
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
      subtitle="Track this chat as a support ticket"
      icon={LifeBuoy}
      iconClassName="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                aria-pressed={priority === p.value}
                className={`rounded-lg px-2 py-2 text-[12px] font-bold transition ${FOCUS_RING_CLASS} ${
                  priority === p.value
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-theme-subtle text-theme-secondary hover:text-theme-fg'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <AppTextarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add context for the team..."
          rows={3}
        />

        <div className="flex justify-end gap-2 pt-1">
          <AppButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </AppButton>
          <AppButton type="submit" loading={submitting} disabled={!title.trim()}>
            Create ticket
          </AppButton>
        </div>
      </form>
    </InboxModal>
  );
}
