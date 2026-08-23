import { Lock, Pencil } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import { TableTextButton } from '../ui/TableActions';
import type { TeamMember } from '../../types';
import AvailabilityBadge, { RoleBadge } from './AvailabilityBadge';

interface TeamMemberTableProps {
  members: TeamMember[];
  canManage: boolean;
  onEdit: (member: TeamMember) => void;
}

export default function TeamMemberTable({ members, canManage, onEdit }: TeamMemberTableProps) {
  return (
    <DataTable
      embedded
      serialHeader="S.N.O."
      className="templates-data-table"
      headers={canManage ? ['Member', 'Status', 'Role', 'Actions'] : ['Member', 'Status', 'Role']}
      minTableWidth="min-w-[680px]"
      tableClassName="text-sm"
    >
      {members.map((member, index) => {
        const editable = canManage && member.orgRole !== 'OWNER';

        return (
          <tr
            key={member.id}
            className={editable ? 'cursor-pointer' : ''}
            onClick={() => editable && onEdit(member)}
          >
            <TableSerialCell rowIndex={index} />

            <td className="min-w-0 max-w-[320px] !py-3.5 sm:!py-4">
              <div className="flex items-start gap-3">
                <ContactAvatar name={member.name} phone={member.email} size="sm" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-[13px] font-bold text-neutral-900 dark:text-neutral-100">
                    {member.name}
                    {member.isCurrentUser && (
                      <span className="ml-2 text-[11px] font-medium text-whatsapp-700 dark:text-whatsapp-300">
                        You
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
                    {member.email}
                  </p>
                  {member.department && (
                    <p className="mt-0.5 truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                      {member.department.name}
                    </p>
                  )}
                </div>
              </div>
            </td>

            <td className="whitespace-nowrap !py-3.5 sm:!py-4">
              <AvailabilityBadge status={member.availability} />
            </td>

            <td className="whitespace-nowrap !py-3.5 sm:!py-4">
              <RoleBadge role={member.orgRole} />
            </td>

            {canManage && (
              <td className="!py-3.5 sm:!py-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex min-w-[9.5rem] justify-end">
                  {editable ? (
                    <TableTextButton onClick={() => onEdit(member)} icon={Pencil}>
                      Edit
                    </TableTextButton>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-2.5 py-1 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                      <Lock className="h-3 w-3" />
                      Protected
                    </span>
                  )}
                </div>
              </td>
            )}
          </tr>
        );
      })}
    </DataTable>
  );
}
