import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import type { Contact } from '../../types';
import { contactGetsCampaignMessages } from '../../utils/contactConsent';
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
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <div className="flex items-start gap-3 px-4 py-3.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="contact-checkbox mt-2.5 h-4 w-4 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/30"
          aria-label={`Select ${contact.name || contact.phone}`}
        />
        <button type="button" onClick={onView} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ContactAvatar name={contact.name} phone={contact.phone} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-theme-fg">
              {contact.name || contact.phone}
            </p>
            {contact.name && (
              <p className="truncate text-[11px] text-theme-muted">{contact.phone}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <ContactOptInBadge optedIn={contactGetsCampaignMessages(contact)} />
              <ContactSourceBadge source={contact.source} />
            </div>
            {contact.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {contact.tags.slice(0, 3).map((tag) => (
                  <ContactTagBadge key={tag} tag={tag} />
                ))}
                {contact.tags.length > 3 && (
                  <span className="text-[11px] text-theme-muted">+{contact.tags.length - 3}</span>
                )}
              </div>
            )}
            {contact.lastActiveAt && (
              <p className="mt-1.5 text-[11px] text-theme-muted">
                Active {new Date(contact.lastActiveAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </button>
      </div>
      <div className="flex items-center gap-2 border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
        <AppButton
          size="sm"
          className="flex-1"
          variant="secondary"
          icon={<MessageSquare size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onMessage();
          }}
        >
          Chat
        </AppButton>
        <AppButton
          size="sm"
          variant="secondary"
          icon={<Pencil size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit"
        />
        <AppButton
          size="sm"
          variant="secondary"
          icon={<Trash2 size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete"
        />
      </div>
    </article>
  );
}
