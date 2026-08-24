import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import InfoTip from '../../ui/InfoTip';
import { DetailsSectionCard, DetailsSectionHeader } from './DetailsSectionCard';
import { listCustomAttributeEntries } from '../../../utils/customAttributes';
import type { Contact } from '../../../types';

interface ContactSavedAnswersSectionProps {
  contact: Contact;
}

const SAVED_ANSWERS_TIP = (
  <div className="space-y-2 text-[12px] font-medium leading-relaxed text-neutral-950">
    <p className="font-bold text-neutral-900">Saved answers</p>
    <p>
      Extra details collected for this customer — from automations, WhatsApp forms, or manual entry
      on Contacts. Shown here for every chat with this person.
    </p>
    <p className="text-[11px] text-neutral-600">
      Use these in templates as <code className="font-mono text-[10.5px]">{'{{field_name}}'}</code>{' '}
      (for example <code className="font-mono text-[10.5px]">{'{{order_id}}'}</code>).
    </p>
  </div>
);

/** Read-only contact fields + custom attributes in the Inbox details panel. */
export default function ContactSavedAnswersSection({ contact }: ContactSavedAnswersSectionProps) {
  const entries = listCustomAttributeEntries(contact.customAttributes);
  const hasNotes = Boolean(contact.notes?.trim());
  const hasEmail = Boolean(contact.email?.trim());

  return (
    <DetailsSectionCard data-section="saved-answers">
      <DetailsSectionHeader
        icon={<ClipboardList className="h-3.5 w-3.5" strokeWidth={2.25} />}
        title="Saved answers"
        action={<InfoTip label="About saved answers" content={SAVED_ANSWERS_TIP} />}
      />

      {(hasEmail || hasNotes) && (
        <dl className="mb-2.5 space-y-2 border-b border-theme-border/60 pb-2.5">
          {hasEmail && (
            <div className="grid grid-cols-[minmax(0,5.5rem)_1fr] gap-x-2 gap-y-0.5 text-[12px]">
              <dt className="font-semibold text-theme-muted">Email</dt>
              <dd className="min-w-0 break-words font-medium text-theme-fg">{contact.email}</dd>
            </div>
          )}
          {hasNotes && (
            <div className="grid grid-cols-[minmax(0,5.5rem)_1fr] gap-x-2 gap-y-0.5 text-[12px]">
              <dt className="font-semibold text-theme-muted">Notes</dt>
              <dd className="min-w-0 break-words font-medium leading-snug text-theme-secondary">
                {contact.notes}
              </dd>
            </div>
          )}
        </dl>
      )}

      {entries.length > 0 ? (
        <dl className="space-y-2">
          {entries.map((row) => (
            <div
              key={row.key}
              className="rounded-lg border border-theme-border/70 bg-theme-subtle/35 px-2.5 py-2"
            >
              <dt className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                {row.label}
              </dt>
              <dd className="mt-0.5 break-words text-[12.5px] font-semibold leading-snug text-theme-fg">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="rounded-xl border border-dashed border-theme-border/80 bg-theme-subtle/25 px-3 py-3 text-center">
          <p className="text-[12px] font-semibold text-theme-fg">No saved answers yet</p>
          <p className="mt-1 text-[11px] leading-snug text-theme-muted">
            Add extra details on Contacts, or collect them through automations and WhatsApp forms.
          </p>
          <Link
            to={`/contacts?highlight=${encodeURIComponent(contact.id)}`}
            className="mt-2 inline-flex text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
          >
            Open contact →
          </Link>
        </div>
      )}
    </DetailsSectionCard>
  );
}
