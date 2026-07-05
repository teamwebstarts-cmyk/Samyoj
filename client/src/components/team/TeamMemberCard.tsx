import { Pencil } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import type { TeamMember } from '../../types';
import AvailabilityBadge, { RoleBadge } from './AvailabilityBadge';

interface TeamMemberCardProps {
  member: TeamMember;
  canEdit: boolean;
  onEdit: () => void;
}

export default function TeamMemberCard({ member, canEdit, onEdit }: TeamMemberCardProps) {
  return (
    <article className="bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button
        type="button"
        onClick={() => canEdit && onEdit()}
        disabled={!canEdit}
        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left ${
          canEdit ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <ContactAvatar name={member.name} phone={member.email} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-theme-fg">
            {member.name}
            {member.isCurrentUser && (
              <span className="ml-2 text-[11px] font-medium text-whatsapp-700 dark:text-whatsapp-300">
                You
              </span>
            )}
          </p>
          <p className="truncate text-[11px] text-theme-muted">{member.email}</p>
          {member.department && (
            <p className="mt-0.5 truncate text-[11px] text-theme-secondary">{member.department.name}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AvailabilityBadge status={member.availability} />
            <RoleBadge role={member.orgRole} />
          </div>
        </div>
      </button>

      {canEdit && (
        <div className="border-t border-theme-border/60 bg-theme-subtle/20 px-3 py-2.5">
          <AppButton
            size="sm"
            fullWidth
            variant="secondary"
            icon={<Pencil size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            Edit member
          </AppButton>
        </div>
      )}
    </article>
  );
}
