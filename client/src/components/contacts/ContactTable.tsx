import { MessageSquare, Pencil, Trash2, User } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import Pagination from '../ui/Pagination';
import { TableIconButton } from '../ui/TableActions';
import type { Contact } from '../../types';
import { ContactConsentInfoTip } from './ContactConsentInfoTip';
import {
  ContactActiveIndicator,
  ContactEmptyTags,
  ContactInboxStatusCell,
  ContactOptInBadge,
  ContactRowPreview,
  ContactTagBadge,
} from './contactUi';

interface ContactTableProps {
  contacts: Contact[];
  page: number;
  pageSize: number;
  total: number;
  selectedIds: string[];
  allSelected: boolean;
  partialSelected: boolean;
  onPageChange: (page: number) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onView: (contact: Contact) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onMessage: (contact: Contact) => void;
  showPagination?: boolean;
}

const headers = [
  { key: 'contact', label: 'Contact', className: 'text-left' },
  { key: 'tags', label: 'Tags', className: 'hidden xl:table-cell text-left' },
  { key: 'lastActive', label: 'Last active', className: 'hidden 2xl:table-cell text-left' },
  { key: 'campaign', label: 'Campaign', className: 'text-left' },
  { key: 'inbox', label: 'Inbox', className: 'text-left' },
  { key: 'actions', label: 'Actions', className: 'text-right' },
] as const;

const cellPad = 'px-3 py-2 sm:px-4 sm:py-2.5';

export default function ContactTable({
  contacts,
  page,
  pageSize,
  total,
  selectedIds,
  allSelected,
  partialSelected,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEdit,
  onDelete,
  onMessage,
  showPagination = true,
}: ContactTableProps) {
  return (
    <div className="data-table contact-table min-w-0 overflow-hidden p-0">
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[52rem] table-fixed text-sm">
          <thead>
            <tr className="border-b border-theme-border bg-theme-subtle/80">
              <th className={`w-10 ${cellPad}`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = partialSelected && !allSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="contact-checkbox h-4 w-4 rounded border-neutral-300 text-sky-600 focus:ring-sky-500/30"
                  aria-label="Select all contacts on this page"
                />
              </th>
              {headers.map((header) => (
                <th
                  key={header.key}
                  className={`${cellPad} text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted ${header.className} ${
                    header.key === 'actions' ? 'w-[9rem]' : ''
                  } ${header.key === 'campaign' ? 'w-[6.75rem] sm:w-[7.25rem]' : ''} ${
                    header.key === 'inbox' ? 'w-[5.25rem] sm:w-[5.75rem]' : ''
                  }`}
                >
                  {header.key === 'campaign' ? (
                    <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                      <span className="text-[11px] font-bold uppercase tracking-[0.08em]">Campaign</span>
                      <ContactConsentInfoTip />
                    </span>
                  ) : (
                    header.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => {
              const checked = selectedIds.includes(contact.id);
              const hasConversation = Boolean(contact.conversation?.id);

              return (
                <tr
                  key={contact.id}
                  className={`group ${checked ? '!bg-sky-50/70 dark:!bg-sky-950/25' : ''}`}
                >
                  <td className={`w-10 ${cellPad}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect(contact.id)}
                      className="contact-checkbox h-4 w-4 rounded border-neutral-300 text-sky-600 transition focus:ring-sky-500/30"
                      aria-label={`Select ${contact.name || contact.phone}`}
                    />
                  </td>

                  <td className={`min-w-0 ${cellPad}`}>
                    <button
                      type="button"
                      onClick={() => onView(contact)}
                      className="flex w-full min-w-0 items-center gap-2 rounded-xl py-0.5 text-left transition sm:gap-2.5"
                    >
                      <ContactAvatar
                        name={contact.name}
                        phone={contact.phone}
                        size="xs"
                        palette="contacts"
                        shape="circle"
                        showStatus={false}
                      />
                      <div className="min-w-0 flex-1">
                        <ContactRowPreview contact={contact} />
                        {contact.notes && (
                          <p className="mt-0.5 max-w-full truncate text-[10px] font-medium text-theme-muted xl:max-w-[160px]">
                            {contact.notes}
                          </p>
                        )}
                      </div>
                    </button>
                  </td>

                  <td className={`hidden min-w-0 xl:table-cell ${cellPad}`}>
                    {contact.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.slice(0, 2).map((tag) => (
                          <ContactTagBadge key={tag} tag={tag} />
                        ))}
                        {contact.tags.length > 2 && (
                          <span className="self-center text-[10px] font-bold text-theme-muted">
                            +{contact.tags.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <ContactEmptyTags />
                    )}
                  </td>

                  <td className={`hidden min-w-0 2xl:table-cell ${cellPad}`}>
                    <ContactActiveIndicator lastActiveAt={contact.lastActiveAt} />
                  </td>

                  <td className={`min-w-0 overflow-hidden ${cellPad}`}>
                    <ContactOptInBadge contact={contact} table />
                  </td>

                  <td className={`min-w-0 overflow-hidden ${cellPad}`}>
                    <ContactInboxStatusCell status={contact.conversation?.status} />
                  </td>

                  <td className={cellPad}>
                    <div className="flex items-center justify-end gap-1">
                      <TableIconButton
                        onClick={() => onMessage(contact)}
                        icon={MessageSquare}
                        label={hasConversation ? 'Open chat' : 'Send message'}
                        variant="primary"
                      />
                      <TableIconButton
                        onClick={() => onView(contact)}
                        icon={User}
                        label="View profile"
                      />
                      <TableIconButton
                        onClick={() => onEdit(contact)}
                        icon={Pencil}
                        label="Edit contact"
                      />
                      <TableIconButton
                        onClick={() => onDelete(contact)}
                        icon={Trash2}
                        label="Delete contact"
                        variant="danger"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
      )}
    </div>
  );
}
