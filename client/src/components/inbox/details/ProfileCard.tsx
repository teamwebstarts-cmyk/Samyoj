import { Mail, Phone, UserPlus } from 'lucide-react';
import ContactAvatar from '../ContactAvatar';
import type { Contact } from '../../../types';

interface ProfileCardProps {
  contact: Contact;
  onAssignAgent: () => void;
}

export default function ProfileCard({ contact, onAssignAgent }: ProfileCardProps) {
  return (
    <div className="flex flex-col items-center px-4 pb-5 pt-5 text-center">
      <ContactAvatar name={contact.name} phone={contact.phone} size="xl" shape="circle" />
      <p className="mt-3 max-w-full truncate text-[16px] font-bold tracking-tight text-theme-fg">
        {contact.name || contact.phone}
      </p>
      <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-[12.5px] font-medium text-theme-muted">
        <Phone className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{contact.phone}</span>
      </p>
      {contact.email && (
        <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate text-[12.5px] font-medium text-theme-muted">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{contact.email}</span>
        </p>
      )}
      <button
        type="button"
        onClick={onAssignAgent}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-whatsapp-500/50 px-3 py-2.5 text-[13px] font-bold text-whatsapp-700 transition hover:bg-whatsapp-500/10 dark:text-whatsapp-400"
      >
        <UserPlus className="h-4 w-4" strokeWidth={2.25} />
        Assign Agent
      </button>
    </div>
  );
}
