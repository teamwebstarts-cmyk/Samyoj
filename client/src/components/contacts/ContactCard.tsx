import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import type { Contact } from '../../types';
import {
  ContactOptInBadge,
  ContactSourceBadge,
  ContactTagBadge,
} from './contactUi';

interface ContactCardProps {
  contact: Contact;
  selected: boolean;
  onToggleSelect: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMessage: () => void;
}

export default function ContactCard({
  contact,
  selected,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onMessage,
}: ContactCardProps) {
  return (
    <article className="dashboard-card overflow-hidden p-0 transition active:scale-[0.99]">
      <div className="flex items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="contact-checkbox mt-3 h-4 w-4 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/30"
          aria-label={`Select ${contact.name || contact.phone}`}
        />
        <button type="button" onClick={onView} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ContactAvatar name={contact.name} phone={contact.phone} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-label font-extrabold text-theme-fg">
              {contact.name || contact.phone}
            </p>
            {contact.name && (
              <p className="truncate text-caption text-theme-muted">{contact.phone}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ContactOptInBadge optedIn={contact.optedIn} />
              <ContactSourceBadge source={contact.source} />
            </div>
            {contact.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {contact.tags.slice(0, 3).map((tag) => (
                  <ContactTagBadge key={tag} tag={tag} />
                ))}
                {contact.tags.length > 3 && (
                  <span className="text-caption text-theme-muted">+{contact.tags.length - 3}</span>
                )}
              </div>
            )}
            {contact.lastActiveAt && (
              <p className="mt-2 text-caption text-theme-muted">
                Active {new Date(contact.lastActiveAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-theme-border bg-theme-subtle/40 p-3">
        <AppButton size="sm" fullWidth variant="primary" icon={<MessageSquare size={14} />} onClick={onMessage}>
          Chat
        </AppButton>
        <AppButton size="sm" fullWidth variant="secondary" icon={<Pencil size={14} />} onClick={onEdit}>
          Edit
        </AppButton>
        <AppButton size="sm" fullWidth variant="danger" icon={<Trash2 size={14} />} onClick={onDelete}>
          Delete
        </AppButton>
      </div>
    </article>
  );
}
