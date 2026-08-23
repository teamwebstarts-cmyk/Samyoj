import { MessageSquare, Pencil, Trash2, User } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import Pagination from '../ui/Pagination';
import { TableIconButton } from '../ui/TableActions';
import type { Contact } from '../../types';
import {
  ContactActiveIndicator,
  ContactConversationBadge,
  ContactEmptyTags,
  ContactOptInBadge,
  ContactRowPreview,
  ContactSourceBadge,
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
  { key: 'status', label: 'Status', className: 'text-left' },
  { key: 'actions', label: 'Actions', className: 'text-right' },
] as const;

const cellPad = 'px-3 py-3 sm:px-4 sm:py-3.5';

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
      <div className="min-w-0 overflow-x-clip">
        <table className="w-full table-fixed text-sm">
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
                    header.key === 'actions' ? 'w-[8.25rem]' : ''
                  } ${header.key === 'status' ? 'w-[7.5rem] xl:w-[8.5rem]' : ''}`}
                >
                  {header.label}
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
                      className="flex w-full min-w-0 items-center gap-2.5 rounded-xl py-0.5 text-left transition sm:gap-3"
                    >
                      <ContactAvatar
                        name={contact.name}
                        phone={contact.phone}
                        size="sm"
                        active={hasConversation}
                      />
                      <div className="min-w-0 flex-1">
                        <ContactRowPreview contact={contact} />
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <ContactSourceBadge source={contact.source} />
                          {contact.notes && (
                            <span className="max-w-full truncate text-[10px] font-medium text-theme-muted xl:max-w-[120px]">
                              {contact.notes}
                            </span>
                          )}
                        </div>
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

                  <td className={`min-w-0 ${cellPad}`}>
                    <div className="flex flex-wrap items-center gap-1">
                      <ContactOptInBadge contact={contact} compact />
                      {contact.conversation?.status && (
                        <ContactConversationBadge status={contact.conversation.status} />
                      )}
                    </div>
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
