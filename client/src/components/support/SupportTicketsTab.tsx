import { useEffect, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { getStatusStyle } from '../ui/statusTokens';
import { supportApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess } from '../../utils/toast';
import type { SupportTicket } from './types';

const statusLabel: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

interface SupportTicketsTabProps {
  tickets: SupportTicket[];
  loading: boolean;
  onReload: () => Promise<void>;
}

export default function SupportTicketsTab({ tickets, loading, onReload }: SupportTicketsTabProps) {
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void onReload();
  }, [onReload]);

  const create = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await supportApi.createTicket({ subject: subject.trim(), body: body.trim(), source: 'manual' });
      toastSuccess('Ticket created');
      setSubject('');
      setBody('');
      setComposing(false);
      await onReload();
    } catch (err) {
      toastError(getErrorMessage(err, 'Could not create the ticket'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#F4F7F6] px-4 py-4 dark:bg-theme-subtle">
      {!composing ? (
        <AppButton
          variant="primary"
          size="md"
          className="mb-3 shrink-0"
          icon={<Plus className="h-4 w-4" strokeWidth={2.25} />}
          onClick={() => setComposing(true)}
        >
          New ticket
        </AppButton>
      ) : (
        <form
          className="mb-3 space-y-3 rounded-2xl border border-theme-border bg-white p-3.5 shadow-sm dark:bg-theme-surface"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <AppInput
            id="support-ticket-subject"
            label="Subject"
            placeholder="Billing, login, or data issue"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={160}
          />
          <AppTextarea
            id="support-ticket-body"
            label="Details"
            placeholder="What happened, and what should we look at?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
          />
          <div className="flex justify-end gap-2">
            <AppButton type="button" variant="ghost" size="sm" onClick={() => setComposing(false)}>
              Cancel
            </AppButton>
            <AppButton type="submit" size="sm" loading={saving} disabled={subject.trim().length < 3 || body.trim().length < 8}>
              Create ticket
            </AppButton>
          </div>
        </form>
      )}

      {loading && tickets.length === 0 ? (
        <p className="py-10 text-center text-[13px] font-semibold text-theme-muted">Loading tickets…</p>
      ) : tickets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-theme-border bg-white px-6 py-12 text-center dark:bg-theme-surface">
          <Layers className="h-8 w-8 text-emerald-600/70" strokeWidth={1.75} />
          <p className="mt-3 text-[14px] font-extrabold text-theme-fg">No tickets yet</p>
          <p className="mt-1 max-w-[16rem] text-[12.5px] font-medium leading-relaxed text-theme-muted">
            Create one for billing, login, or data issues. Product how-to questions belong on Assistant.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {tickets.map((ticket) => {
            const open = openId === ticket.id;
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : ticket.id)}
                  className="w-full rounded-2xl border border-theme-border bg-white p-3.5 text-left shadow-sm transition hover:border-emerald-200 dark:bg-theme-surface"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-[13.5px] font-bold text-theme-fg">{ticket.subject}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1 ${getStatusStyle(ticket.status)}`}
                    >
                      {statusLabel[ticket.status] || ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] font-medium text-theme-muted">
                    {ticket.source === 'chat' ? 'From chat · ' : ''}
                    {new Date(ticket.createdAt).toLocaleString()}
                  </p>
                  {open && (
                    <p className="mt-2 whitespace-pre-wrap border-t border-theme-border pt-2 text-[13px] font-medium leading-relaxed text-theme-secondary">
                      {ticket.body}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
