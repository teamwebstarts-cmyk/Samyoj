import { useCallback, useEffect, useState } from 'react';
import { Headset, Plus, Shield, UserCheck } from 'lucide-react';
import ContactAvatar from '../components/inbox/ContactAvatar';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import RowActions from '../components/ui/RowActions';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useAuth } from '../contexts/AuthContext';
import { teamApi } from '../services/api';
import type { OrgRole, TeamMember, TeamSummary } from '../types';

const emptyForm = { name: '', email: '', password: '', orgRole: 'AGENT' as 'ADMIN' | 'AGENT' };

const ALL_ROLES = '';
const roleFilterOptions = [
  { value: ALL_ROLES, label: 'All roles' },
  { value: 'OWNER', label: 'Owners' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'AGENT', label: 'Agents' },
];

const roleBadgeStyles: Record<OrgRole, string> = {
  OWNER: 'bg-violet-50 text-violet-700 ring-violet-100',
  ADMIN: 'bg-sky-50 text-sky-700 ring-sky-100',
  AGENT: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
};

const roleLabels: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  AGENT: 'Agent',
};

function formatJoinedDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TeamPage() {
  const { canManageTeam, orgRole } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [summary, setSummary] = useState<TeamSummary>({ total: 0, owners: 0, admins: 0, agents: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (debouncedSearch) params.search = debouncedSearch;

    teamApi
      .list(params)
      .then(({ data }) => {
        setMembers(data.data.members);
        setSummary(data.data.summary);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  useEffect(load, [load]);

  const filteredMembers = roleFilter
    ? members.filter((member) => member.orgRole === roleFilter)
    : members;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSlideOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: '',
      orgRole: member.orgRole === 'OWNER' ? 'ADMIN' : member.orgRole,
    });
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
        const payload: { name?: string; orgRole?: 'ADMIN' | 'AGENT'; password?: string } = {
          name: form.name,
        };
        if (editing.orgRole !== 'OWNER' && orgRole === 'OWNER') {
          payload.orgRole = form.orgRole;
        }
        if (form.password.trim()) {
          payload.password = form.password.trim();
        }
        await teamApi.update(editing.id, payload);
      } else {
        await teamApi.create({
          name: form.name,
          email: form.email,
          password: form.password,
          orgRole: form.orgRole,
        });
      }
      closeSlide();
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save team member';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!editing || !confirm(`Remove ${editing.name} from the team?`)) return;
    setSaving(true);
    try {
      await teamApi.remove(editing.id);
      closeSlide();
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to remove team member';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = Boolean(search || roleFilter);

  return (
    <PageShell>
      <PageHeader
        actions={
          canManageTeam ? (
            <AppButton icon={<Plus size={16} />} onClick={openCreate}>
              Add Agent
            </AppButton>
          ) : undefined
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Team"
          badgeIcon={Headset}
          title="Manage your support agents"
          description="Invite teammates, assign roles, and keep inbox ownership clear across your WhatsApp workspace."
          accent="emerald"
          stats={[
            { label: 'Members', value: summary.total },
            { label: 'Admins', value: summary.admins + summary.owners, tone: 'text-sky-700' },
            { label: 'Agents', value: summary.agents, tone: 'text-emerald-700' },
          ]}
        />

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name or email..."
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
                : canManageTeam
                  ? 'Add your first agent to start sharing the inbox.'
                  : 'Your team list will appear here once members are added.'
            }
            action={
              canManageTeam && !hasActiveFilters ? (
                <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                  Add Agent
                </AppButton>
              ) : undefined
            }
          />
        ) : (
          <DataTable headers={['Member', 'Role', 'Assigned chats', 'Joined', 'Actions']}>
            {filteredMembers.map((member, index) => (
              <tr key={member.id}>
                <TableSerialCell rowIndex={index} />
                <td>
                  <div className="flex items-center gap-3">
                    <ContactAvatar name={member.name} phone={member.email} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900">
                        {member.name}
                        {member.isCurrentUser && (
                          <span className="ml-2 text-[11px] font-bold text-whatsapp-700">You</span>
                        )}
                      </p>
                      <p className="truncate text-[12px] font-medium text-neutral-500">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${roleBadgeStyles[member.orgRole]}`}
                  >
                    {roleLabels[member.orgRole]}
                  </span>
                </td>
                <td className="text-[13px] font-semibold tabular-nums text-neutral-700">
                  {member.assignedCount}
                </td>
                <td className="text-[13px] text-neutral-500">{formatJoinedDate(member.joinedAt)}</td>
                <td>
                  {canManageTeam && member.orgRole !== 'OWNER' ? (
                    <RowActions onEdit={() => openEdit(member)} />
                  ) : (
                    <span className="text-[12px] text-neutral-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      {canManageTeam && (
        <SlideOver
          open={slideOpen}
          onClose={closeSlide}
          title={editing ? 'Edit team member' : 'Add team member'}
          subtitle={
            editing ? 'Update name, role, or password' : 'Create an account for a new support agent'
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
              <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-500/10 to-whatsapp-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(37,211,102,0.3)]">
                    <UserCheck className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-[13px] font-extrabold text-neutral-900">New support agent</p>
                    <p className="mt-0.5 text-[12px] font-medium text-neutral-600">
                      They can sign in with this email and password to access the shared inbox.
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

            {(!editing || (editing.orgRole !== 'OWNER' && orgRole === 'OWNER')) && (
              <AppSelect
                id="team-role"
                label="Role"
                value={form.orgRole}
                isSearchable={false}
                options={[
                  { value: 'AGENT', label: 'Agent — inbox access only' },
                  { value: 'ADMIN', label: 'Admin — manage team & settings' },
                ]}
                onChange={(e) =>
                  setForm({ ...form, orgRole: e.target.value as 'ADMIN' | 'AGENT' })
                }
              />
            )}

            {editing?.orgRole === 'OWNER' && (
              <div className="flex items-start gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/60 p-4">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <p className="text-[12px] font-medium text-violet-800">
                  Organization owners keep full access. Role changes are not available for this account.
                </p>
              </div>
            )}
          </form>
        </SlideOver>
      )}
    </PageShell>
  );
}
