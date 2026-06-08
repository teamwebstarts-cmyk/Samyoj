import { MessageSquare, Pencil, Trash2, User } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import Pagination from '../ui/Pagination';
import { TableIconButton, TableTextButton } from '../ui/TableActions';
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
}

const headers = ['Contact', 'Tags', 'Last active', 'Status', 'Actions'];

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
}: ContactTableProps) {
  return (
    <div className="data-table contact-table dashboard-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-theme-border bg-theme-subtle/80">
              <th className="w-12 px-4 py-3.5">
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
                  key={header}
                  className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted ${
                    header === 'Actions' ? 'min-w-[180px] text-right' : 'text-left'
                  }`}
                >
                  {header}
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
                  <td className="w-12 px-4">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleSelect(contact.id)}
                      className="contact-checkbox h-4 w-4 rounded border-neutral-300 text-sky-600 transition focus:ring-sky-500/30"
                      aria-label={`Select ${contact.name || contact.phone}`}
                    />
                  </td>

                  <td className="min-w-[240px] px-5">
                    <button
                      type="button"
                      onClick={() => onView(contact)}
                      className="flex w-full items-center gap-3 rounded-xl py-0.5 text-left transition"
                    >
                      <ContactAvatar
                        name={contact.name}
                        phone={contact.phone}
                        size="sm"
                        active={hasConversation}
                      />
                      <div className="min-w-0 flex-1">
                        <ContactRowPreview contact={contact} />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <ContactSourceBadge source={contact.source} />
                          {contact.notes && (
                            <span className="max-w-[160px] truncate text-[10px] font-medium text-theme-muted">
                              {contact.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </td>

                  <td className="min-w-[140px] px-5">
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

                  <td className="min-w-[130px] px-5">
                    <ContactActiveIndicator lastActiveAt={contact.lastActiveAt} />
                  </td>

                  <td className="min-w-[150px] px-5">
                    <div className="flex flex-col items-start gap-1.5">
                      <ContactOptInBadge optedIn={contact.optedIn} />
                      {contact.conversation?.status && (
                        <ContactConversationBadge status={contact.conversation.status} />
                      )}
                    </div>
                  </td>

                  <td className="px-5">
                    <div className="flex items-center justify-end gap-1.5">
                      {hasConversation && (
                        <TableTextButton icon={MessageSquare} onClick={() => onMessage(contact)}>
                          Chat
                        </TableTextButton>
                      )}
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

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </div>
  );
}
