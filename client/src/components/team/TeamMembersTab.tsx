import { useCallback, useEffect, useState } from 'react';
import { Headset, Plus, Shield, UserCheck } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import DataTable, { TableSerialCell } from '../ui/DataTable';
import EmptyState from '../ui/EmptyState';
import ListToolbar from '../ui/ListToolbar';
import LoadingState from '../ui/LoadingState';
import RowActions from '../ui/RowActions';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { teamApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import type { OrgRole, TeamDepartment, TeamMember, TeamSummary } from '../../types';
import AvailabilityBadge, { RoleBadge } from './AvailabilityBadge';
import TeamMemberDetailPanel from './TeamMemberDetailPanel';
import { formatJoinedDate, roleLabels } from './teamUi';

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
  maxConcurrentChats: '10',
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
  const [, setSummary] = useState<TeamSummary>({
    total: 0,
    owners: 0,
    admins: 0,
    supervisors: 0,
    agents: 0,
    online: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [deptFilter, setDeptFilter] = useState('');
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reassignToId, setReassignToId] = useState('');

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (deptFilter) params.departmentId = deptFilter;

    teamApi
      .list(params)
      .then(({ data }) => {
        setMembers(data.data.members);
        setSummary(data.data.summary);
        onSummaryChange?.(data.data.summary);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, deptFilter, onSummaryChange]);

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
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: '',
      orgRole: member.orgRole === 'OWNER' ? 'ADMIN' : member.orgRole,
      departmentId: member.department?.id ?? '',
      maxConcurrentChats: String(member.maxConcurrentChats ?? 10),
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
          maxConcurrentChats: parseInt(form.maxConcurrentChats, 10),
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
          maxConcurrentChats: parseInt(form.maxConcurrentChats, 10),
        });
      }
      closeSlide();
      load();
      toastSuccess(editing ? 'Team member updated' : 'Team member added');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save team member'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!editing || !confirm(`Remove ${editing.name} from the team?`)) return;
    setSaving(true);
    try {
      await teamApi.remove(editing.id, {
        reassignToId: reassignToId || undefined,
      });
      closeSlide();
      load();
      toastSuccess('Team member removed');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to remove team member'
      );
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = Boolean(search || roleFilter || deptFilter);

  return (
    <>
      <div className="space-y-5">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name or email..."
          filters={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <AppSelect
                className="w-full sm:w-40"
                value={roleFilter}
                placeholder="All roles"
                isSearchable={false}
                options={roleFilterOptions}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
              {departments.length > 0 && (
                <AppSelect
                  className="w-full sm:w-44"
                  value={deptFilter}
                  placeholder="All departments"
                  isSearchable={false}
                  options={[
                    { value: '', label: 'All departments' },
                    ...departments.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                  onChange={(e) => setDeptFilter(e.target.value)}
                />
              )}
            </div>
          }
          actions={
            canManage ? (
              <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                Add member
              </AppButton>
            ) : undefined
          }
        />

        {loading ? (
          <LoadingState label="Loading team..." />
        ) : filteredMembers.length === 0 ? (
          <EmptyState
            icon={Headset}
            title="No team members found"
            description={
              hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : canManage
                  ? 'Add your first agent or send an email invite.'
                  : 'Your team list will appear here once members are added.'
            }
            action={
              canManage && !hasActiveFilters ? (
                <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                  Add member
                </AppButton>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            headers={['Member', 'Status', 'Role', 'Workload', 'Department', 'Joined', 'Actions']}
          >
            {filteredMembers.map((member, index) => (
              <tr
                key={member.id}
                className="cursor-pointer transition hover:bg-whatsapp-500/[0.03]"
                onClick={() => setDetailId(member.id)}
              >
                <TableSerialCell rowIndex={index} />
                <td>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <ContactAvatar name={member.name} phone={member.email} size="sm" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-theme-fg">
                        {member.name}
                        {member.isCurrentUser && (
                          <span className="ml-2 text-[11px] font-bold text-whatsapp-700">You</span>
                        )}
                      </p>
                      <p className="truncate text-[12px] font-medium text-theme-secondary">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td>
                  <AvailabilityBadge status={member.availability} />
                </td>
                <td>
                  <RoleBadge role={member.orgRole} />
                </td>
                <td>
                  <div className="text-[13px] font-semibold tabular-nums text-theme-fg">
                    {member.openCount ?? 0}
                    <span className="font-normal text-theme-muted">
                      {' '}
                      / {member.maxConcurrentChats}
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-muted">{member.assignedCount} total</p>
                </td>
                <td>
                  {member.department ? (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-theme-secondary">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: member.department.color }}
                      />
                      {member.department.name}
                    </span>
                  ) : (
                    <span className="text-[12px] text-theme-muted">—</span>
                  )}
                </td>
                <td className="text-[13px] text-theme-secondary">
                  {formatJoinedDate(member.joinedAt)}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  {canManage && member.orgRole !== 'OWNER' ? (
                    <RowActions onEdit={() => openEdit(member)} />
                  ) : (
                    <span className="text-[12px] text-theme-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <TeamMemberDetailPanel
        memberId={detailId}
        onClose={() => setDetailId(null)}
        canManage={canManage}
        agents={agents}
        onUpdated={load}
      />

      {canManage && (
        <SlideOver
          open={slideOpen}
          onClose={closeSlide}
          title={editing ? 'Edit team member' : 'Add team member'}
          subtitle={
            editing
              ? 'Update profile, role, capacity, or department'
              : 'Create an account for a new support agent'
          }
          footer={
            <SlideOverFooter
              onCancel={closeSlide}
              submitLabel={editing ? 'Update member' : 'Add member'}
              loading={saving}
              onDelete={editing && editing.orgRole !== 'OWNER' ? handleRemove : undefined}
              deleteLabel="Remove from team"
            />
          }
        >
          <form id="slideover-form" onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-500/10 to-whatsapp-500/5 p-4 dark:border-emerald-800/40">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)]">
                    <UserCheck className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-[13px] font-extrabold text-theme-fg">Direct add</p>
                    <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
                      Or use the Invites tab to send a secure email link instead.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <AppInput
              id="team-name"
              label="Full name"
              placeholder="Agent name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            <AppInput
              id="team-email"
              label="Email"
              type="email"
              placeholder="agent@company.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              disabled={!!editing}
              hint={editing ? 'Email cannot be changed' : undefined}
            />

            <AppInput
              id="team-password"
              label={editing ? 'New password' : 'Password'}
              type="password"
              placeholder={editing ? 'Leave blank to keep current password' : 'Minimum 8 characters'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
              minLength={editing ? undefined : 8}
            />

            <AppInput
              id="team-capacity"
              label="Max concurrent chats"
              type="number"
              min={1}
              max={100}
              value={form.maxConcurrentChats}
              onChange={(e) => setForm({ ...form, maxConcurrentChats: e.target.value })}
            />

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

            {editing?.orgRole === 'OWNER' && (
              <div className="flex items-start gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/60 p-4 dark:border-violet-800/40 dark:bg-violet-900/20">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <p className="text-[12px] font-medium text-violet-800 dark:text-violet-200">
                  Organization owners keep full access. Role changes are not available for this account.
                </p>
              </div>
            )}

            {editing && editing.assignedCount > 0 && (
              <AppSelect
                id="reassign-on-remove"
                label="On remove, reassign chats to"
                value={reassignToId}
                isSearchable={false}
                options={[
                  { value: '', label: 'Unassign (leave in queue)' },
                  ...agents.filter((a) => a.id !== editing.id).map((a) => ({ value: a.id, label: a.name })),
                ]}
                onChange={(e) => setReassignToId(e.target.value)}
              />
            )}
          </form>
        </SlideOver>
      )}
    </>
  );
}
