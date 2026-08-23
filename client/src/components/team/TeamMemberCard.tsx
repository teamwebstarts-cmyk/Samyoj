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
    <article className="min-w-0 overflow-hidden bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50">
      <button
        type="button"
        onClick={() => canEdit && onEdit()}
        disabled={!canEdit}
        className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left sm:gap-3 sm:px-4 sm:py-3.5 ${
          canEdit ? 'cursor-pointer' : 'cursor-default'
        }`}
      >
        <ContactAvatar name={member.name} phone={member.email} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-bold text-neutral-900 sm:text-[13px] dark:text-neutral-100">
            {member.name}
            {member.isCurrentUser && (
              <span className="ml-2 text-[11px] font-medium text-whatsapp-700 dark:text-whatsapp-300">
                You
              </span>
            )}
          </p>
          <p className="truncate text-[12px] text-neutral-500 dark:text-neutral-400">{member.email}</p>
          {member.department && (
            <p className="mt-0.5 truncate text-[11px] text-neutral-500 dark:text-neutral-400">
              {member.department.name}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2">
            <AvailabilityBadge status={member.availability} />
            <RoleBadge role={member.orgRole} />
          </div>
        </div>
      </button>

      {canEdit && (
        <div className="hidden items-center gap-2 border-t border-neutral-200/80 bg-neutral-50/50 px-3 py-2.5 sm:flex dark:border-neutral-800 dark:bg-neutral-900/30">
          <AppButton
            size="sm"
            className="flex-1"
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
