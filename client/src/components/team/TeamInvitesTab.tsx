import { useEffect, useState } from 'react';
import { Copy, Mail, UserPlus, XCircle } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import EmptyState from '../ui/EmptyState';
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { ModalCallout, ModalPanel, ModalSection } from '../ui/modalUi';
import { teamApi } from '../../services/api';
import type { OrgRole, TeamDepartment, TeamInvite } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import { RoleBadge } from './AvailabilityBadge';
import { formatJoinedDate, roleLabels } from './teamUi';

interface TeamInvitesTabProps {
  departments: TeamDepartment[];
  canManage: boolean;
}

function inviteInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function TeamInvitesTab({ departments, canManage }: TeamInvitesTabProps) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<TeamInvite | null>(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    orgRole: 'AGENT' as OrgRole,
    departmentId: '',
  });

  const load = () => {
    setLoading(true);
    teamApi.invites
      .list()
      .then(({ data }) => setInvites(data.data.invites))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await teamApi.invites.create({
        email: form.email,
        name: form.name || undefined,
        orgRole: form.orgRole,
        departmentId: form.departmentId || null,
      });
      toastSuccess('Invite sent');
      setSlideOpen(false);
      setForm({ email: '', name: '', orgRole: 'AGENT', departmentId: '' });
      load();
      if (data.data.inviteUrl) {
        await navigator.clipboard.writeText(data.data.inviteUrl);
        toastSuccess('Invite link copied to clipboard');
      }
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to send invite'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setSaving(true);
    try {
      await teamApi.invites.revoke(revokeTarget.id);
      toastSuccess('Invite revoked');
      setRevokeTarget(null);
      load();
    } catch {
      toastError('Failed to revoke invite');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (url?: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toastSuccess('Link copied');
  };

  return (
    <div className="inbox-shell overflow-hidden">
      {canManage && (
        <div className="flex items-center justify-end border-b border-theme-border px-4 py-3.5 sm:px-5">
          <AppButton size="sm" icon={<UserPlus size={15} />} onClick={() => setSlideOpen(true)}>
            Send invite
          </AppButton>
        </div>
      )}

      {loading && invites.length === 0 ? (
        <ListLayoutSkeleton label="Loading invites" tableHeaders={['Invite', 'Role', 'Status', 'Actions']} />
      ) : invites.length === 0 ? (
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Mail}
            title="No pending invites"
            description="Invite teammates by email — they will set their own password when joining."
            steps={['Tap Send invite', 'Enter their email address', 'They receive a link to join your team']}
            action={
              canManage ? (
                <AppButton icon={<UserPlus size={16} />} onClick={() => setSlideOpen(true)}>
                  Send invite
                </AppButton>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-3 bg-white px-4 py-3.5 transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-100 text-[11px] font-extrabold text-sky-800 dark:from-sky-900/50 dark:to-blue-900/40 dark:text-sky-200">
                  {inviteInitials(invite.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-theme-fg">{invite.email}</p>
                    <RoleBadge role={invite.orgRole} />
                    {invite.status === 'EXPIRED' && (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                        Expired
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-theme-secondary">
                    {invite.invitedBy?.name ? `Invited by ${invite.invitedBy.name} · ` : ''}
                    Expires {formatJoinedDate(invite.expiresAt)}
                    {invite.department ? ` · ${invite.department.name}` : ''}
                  </p>
                </div>
              </div>
              {canManage && invite.status === 'PENDING' && (
                <div className="flex shrink-0 gap-2">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={<Copy size={14} />}
                    onClick={() => copyLink(invite.inviteUrl)}
                  >
                    Copy link
                  </AppButton>
                  <AppButton
                    variant="ghost"
                    size="sm"
                    icon={<XCircle size={14} />}
                    onClick={() => setRevokeTarget(invite)}
                  >
                    Revoke
                  </AppButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <SlideOver
          open={slideOpen}
          onClose={() => setSlideOpen(false)}
          title="Invite team member"
          subtitle="They'll receive a link to join your workspace"
          icon={Mail}
          accent="sky"
          footer={
            <SlideOverFooter
              onCancel={() => setSlideOpen(false)}
              submitLabel="Send invite"
              loading={saving}
            />
          }
        >
          <form id="slideover-form" onSubmit={handleInvite} className="space-y-5">
            <ModalCallout
              icon={Mail}
              accent="sky"
              title="Email invite"
              description="We'll send a secure join link. They choose their own password when accepting the invite."
            />

            <ModalSection step={1} title="Invite details" subtitle="Who you're inviting and their role">
              <ModalPanel accent="sky">
                <div className="space-y-4">
                  <AppInput
                    id="invite-email"
                    label="Email address"
                    type="email"
                    placeholder="agent@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                  <AppInput
                    id="invite-name"
                    label="Name (optional)"
                    placeholder="Agent name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <AppSelect
                    id="invite-role"
                    label="Role"
                    value={form.orgRole}
                    isSearchable={false}
                    options={(['AGENT', 'SUPERVISOR', 'ADMIN'] as OrgRole[]).map((r) => ({
                      value: r,
                      label: roleLabels[r],
                    }))}
                    onChange={(e) => setForm({ ...form, orgRole: e.target.value as OrgRole })}
                  />
                  {departments.length > 0 && (
                    <AppSelect
                      id="invite-dept"
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
                </div>
              </ModalPanel>
            </ModalSection>
          </form>
        </SlideOver>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => void handleRevoke()}
        title={`Revoke invite for ${revokeTarget?.email ?? 'member'}?`}
        description="The invite link will stop working immediately."
        confirmLabel="Revoke invite"
        variant="danger"
        loading={saving}
      />
    </div>
  );
}
