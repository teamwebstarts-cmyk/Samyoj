import { useCallback, useEffect, useState } from 'react';
import { Headset, Pencil, Plus, UserPlus } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ListToolbar from '../ui/ListToolbar';
import LoadingState from '../ui/LoadingState';
import ResponsiveDataView from '../ui/ResponsiveDataView';
import { TableIconButton } from '../ui/TableActions';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { teamApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import type { OrgRole, TeamDepartment, TeamMember, TeamSummary } from '../../types';
import AvailabilityBadge, { RoleBadge } from './AvailabilityBadge';
import TeamMemberCard from './TeamMemberCard';
import { roleLabels } from './teamUi';

const ALL_ROLES = '';
const roleFilterOptions = [
  { value: ALL_ROLES, label: 'All roles' },
  { value: 'OWNER', label: 'Owners' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'SUPERVISOR', label: 'Supervisors' },
  { value: 'AGENT', label: 'Agents' },
];

const emptyForm = {
  name: '',
  email: '',
  password: '',
  orgRole: 'AGENT' as OrgRole,
  departmentId: '',
};

interface TeamMembersTabProps {
  canManage: boolean;
  orgRole: OrgRole | null;
  departments: TeamDepartment[];
  onSummaryChange?: (summary: TeamSummary) => void;
}

export default function TeamMembersTab({
  canManage,
  orgRole,
  departments,
  onSummaryChange,
}: TeamMembersTabProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reassignToId, setReassignToId] = useState('');
  const [removeOpen, setRemoveOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;

    teamApi
      .list(params)
      .then(({ data }) => {
        setMembers(data.data.members);
        onSummaryChange?.(data.data.summary);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, onSummaryChange]);

  useEffect(load, [load]);

  const filteredMembers = roleFilter
    ? members.filter((member) => member.orgRole === roleFilter)
    : members;

  const agents = members.map((m) => ({ id: m.id, name: m.name }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setReassignToId('');
    setSlideOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    if (!canManage || member.orgRole === 'OWNER') return;
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: '',
      orgRole: member.orgRole === 'OWNER' ? 'ADMIN' : member.orgRole,
      departmentId: member.department?.id ?? '',
    });
    setReassignToId('');
    setSlideOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          name: form.name,
          departmentId: form.departmentId || null,
        };
        if (editing.orgRole !== 'OWNER' && orgRole === 'OWNER') {
          payload.orgRole = form.orgRole;
        }
        if (form.password.trim()) payload.password = form.password.trim();
        await teamApi.update(editing.id, payload);
      } else {
        await teamApi.create({
          name: form.name,
          email: form.email,
          password: form.password,
          orgRole: form.orgRole,
          departmentId: form.departmentId || null,
        });
      }
      closeSlide();
      load();
      toastSuccess(editing ? 'Member updated' : 'Member added');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save member'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await teamApi.remove(editing.id, {
        reassignToId: reassignToId || undefined,
      });
      closeSlide();
      setRemoveOpen(false);
      load();
      toastSuccess('Member removed');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to remove member'
      );
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = Boolean(search || roleFilter);

  const emptyState = (
    <EmptyState
      icon={Headset}
      variant={hasActiveFilters ? 'filter' : 'default'}
      title={hasActiveFilters ? 'No members match your search' : 'No team members yet'}
      description={
        hasActiveFilters
          ? 'Try a different name or role filter.'
          : canManage
            ? 'Add teammates so they can reply to customer chats.'
            : 'Team members will appear here.'
      }
      action={
        canManage && !hasActiveFilters ? (
          <AppButton icon={<Plus size={16} />} onClick={openCreate}>
            Add member
          </AppButton>
        ) : undefined
      }
    />
  );

  const renderTable = () => (
    <DataTable
      headers={canManage ? ['Member', 'Status', 'Role', 'Actions'] : ['Member', 'Status', 'Role']}
      className="border-0 bg-transparent shadow-none"
    >
      {filteredMembers.map((member, index) => {
        const editable = canManage && member.orgRole !== 'OWNER';

        return (
          <tr
            key={member.id}
            className={`border-t border-theme-border transition-colors ${
              editable ? 'cursor-pointer hover:bg-theme-subtle/40' : ''
            }`}
            onClick={() => editable && openEdit(member)}
          >
            <TableSerialCell rowIndex={index} />
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <ContactAvatar name={member.name} phone={member.email} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-theme-fg">
                    {member.name}
                    {member.isCurrentUser && (
                      <span className="ml-2 text-[11px] font-medium text-whatsapp-700 dark:text-whatsapp-300">
                        You
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[12px] text-theme-muted">{member.email}</p>
                  {member.department && (
                    <p className="mt-0.5 truncate text-[11px] text-theme-secondary">
                      {member.department.name}
                    </p>
                  )}
                </div>
              </div>
            </td>
            <td className="px-5 py-3.5">
              <AvailabilityBadge status={member.availability} />
            </td>
            <td className="px-5 py-3.5">
              <RoleBadge role={member.orgRole} />
            </td>
            {canManage && (
              <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-1.5">
                  {editable ? (
                    <TableIconButton
                      onClick={() => openEdit(member)}
                      icon={Pencil}
                      label="Edit member"
                    />
                  ) : (
                    <span className="text-[12px] text-theme-muted">—</span>
                  )}
                </div>
              </td>
            )}
          </tr>
        );
      })}
    </DataTable>
  );

  return (
    <>
      <div className="inbox-shell overflow-hidden">
        <ListToolbar
          embedded
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name or email..."
          filters={
            <AppSelect
              className="w-full sm:w-40"
              value={roleFilter}
              placeholder="All roles"
              isSearchable={false}
              options={roleFilterOptions}
              onChange={(e) => setRoleFilter(e.target.value)}
            />
          }
          actions={
            canManage ? (
              <AppButton size="sm" icon={<Plus size={15} />} onClick={openCreate}>
                Add member
              </AppButton>
            ) : undefined
          }
        />

        {loading ? (
          <div className="p-6">
            <LoadingState label="Loading team..." />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-4 sm:p-6">{emptyState}</div>
        ) : (
          <ResponsiveDataView
            items={filteredMembers}
            cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
            tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
            renderCard={(member) => (
              <TeamMemberCard
                member={member}
                canEdit={canManage && member.orgRole !== 'OWNER'}
                onEdit={() => openEdit(member)}
              />
            )}
            renderTable={renderTable}
          />
        )}
      </div>

      {canManage && (
        <SlideOver
          open={slideOpen}
          onClose={closeSlide}
          title={editing ? 'Edit member' : 'Add member'}
          subtitle={editing ? editing.email : 'Create a teammate account'}
          icon={UserPlus}
          accent="emerald"
          footer={
            <SlideOverFooter
              onCancel={closeSlide}
              submitLabel={editing ? 'Save changes' : 'Add member'}
              loading={saving}
              onDelete={editing && editing.orgRole !== 'OWNER' ? () => setRemoveOpen(true) : undefined}
              deleteLabel="Remove"
            />
          }
        >
          <form id="slideover-form" onSubmit={handleSubmit} className="space-y-4">
            <AppInput
              id="team-name"
              label="Name"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            {!editing && (
              <>
                <AppInput
                  id="team-email"
                  label="Email"
                  type="email"
                  placeholder="agent@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
                <AppInput
                  id="team-password"
                  label="Password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                />
              </>
            )}

            {editing && (
              <AppInput
                id="team-password"
                label="New password"
                type="password"
                placeholder="Leave blank to keep current"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            )}

            {(!editing || (editing.orgRole !== 'OWNER' && orgRole === 'OWNER')) && (
              <AppSelect
                id="team-role"
                label="Role"
                value={form.orgRole}
                isSearchable={false}
                options={(['AGENT', 'SUPERVISOR', 'ADMIN'] as OrgRole[]).map((r) => ({
                  value: r,
                  label: roleLabels[r],
                }))}
                onChange={(e) => setForm({ ...form, orgRole: e.target.value as OrgRole })}
              />
            )}

            {departments.length > 0 && (
              <AppSelect
                id="team-dept"
                label="Department"
                value={form.departmentId}
                isSearchable={false}
                options={[
                  { value: '', label: 'No department' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              />
            )}

            {editing?.orgRole === 'OWNER' && (
              <p className="text-[12px] text-theme-secondary">
                Owner accounts cannot change role.
              </p>
            )}
          </form>
        </SlideOver>
      )}

      <ConfirmDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        onConfirm={() => void handleRemove()}
        title={`Remove ${editing?.name ?? 'member'}?`}
        description="They will lose access to this workspace."
        confirmLabel="Remove"
        variant="danger"
        loading={saving}
      >
        {editing && editing.assignedCount > 0 && (
          <div className="mt-4">
            <AppSelect
              id="reassign-on-remove"
              label="Reassign their chats to"
              value={reassignToId}
              isSearchable={false}
              options={[
                { value: '', label: 'Leave unassigned' },
                ...agents.filter((a) => a.id !== editing.id).map((a) => ({ value: a.id, label: a.name })),
              ]}
              onChange={(e) => setReassignToId(e.target.value)}
            />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
