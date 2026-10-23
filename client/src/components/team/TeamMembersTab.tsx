import { useCallback, useEffect, useState } from 'react';
import { Headset, Plus, UserPlus } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ListToolbar from '../ui/ListToolbar';
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
import ResponsiveDataView from '../ui/ResponsiveDataView';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { teamApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import type { OrgRole, TeamDepartment, TeamMember, TeamSummary } from '../../types';
import TeamEmptyHero from './TeamEmptyHero';
import TeamMemberCard from './TeamMemberCard';
import TeamMemberTable from './TeamMemberTable';
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
      orgRole: member.orgRole,
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

  const emptyState = hasActiveFilters ? (
    <EmptyState
      icon={Headset}
      variant="filter"
      compact
      title="No members match your search"
      description="Try a different name or role filter."
    />
  ) : (
    <TeamEmptyHero variant="members" canManage={canManage} onAction={openCreate} />
  );

  return (
    <>
      <div className="inbox-shell min-w-0 overflow-hidden">
        <ListToolbar
          embedded
          compactMobile
          inlineDesktop
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name or email..."
          filters={
            <AppSelect
              className="w-full min-w-0 sm:w-[10.25rem] sm:max-w-[10.25rem]"
              size="compact"
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

        {loading && members.length === 0 ? (
          <ListLayoutSkeleton
            label="Loading team"
            tableHeaders={['Member', 'Role', 'Status', 'Actions']}
          />
        ) : filteredMembers.length === 0 ? (
          <div className="p-4 sm:p-6">{emptyState}</div>
        ) : (
          <ResponsiveDataView
            items={filteredMembers}
            tableFrom="2xl"
            cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 2xl:hidden"
            tableClassName=""
            renderCard={(member) => (
              <TeamMemberCard
                member={member}
                canEdit={canManage && member.orgRole !== 'OWNER'}
                onEdit={() => openEdit(member)}
              />
            )}
            renderTable={() => (
              <TeamMemberTable
                members={filteredMembers}
                canManage={canManage}
                onEdit={openEdit}
              />
            )}
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
          accent="violet"
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
