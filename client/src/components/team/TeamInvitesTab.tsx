import { useEffect, useState } from 'react';
import { Copy, UserPlus, XCircle } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import ConfirmDialog from '../ui/ConfirmDialog';
import ListLayoutSkeleton from '../ui/ListLayoutSkeleton';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { ModalPanel } from '../ui/modalUi';
import { teamApi } from '../../services/api';
import type { OrgRole, TeamDepartment, TeamInvite } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import { RoleBadge } from './AvailabilityBadge';
import TeamEmptyHero from './TeamEmptyHero';
import { formatJoinedDate, roleLabels } from './teamUi';

interface TeamInvitesTabProps {
  departments: TeamDepartment[];
  canManage: boolean;
  onChanged?: () => void;
}

function inviteInitials(email: string) {
  return email.slice(0, 2).toUpperCase();
}

export default function TeamInvitesTab({ departments, canManage, onChanged }: TeamInvitesTabProps) {
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
      onChanged?.();
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
      onChanged?.();
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
          <TeamEmptyHero
            variant="invites"
            canManage={canManage}
            onAction={() => setSlideOpen(true)}
          />
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {invites.map((invite) => (
            <article
              key={invite.id}
              className="min-w-0 overflow-hidden bg-white transition-colors hover:bg-neutral-50/80 dark:bg-neutral-950 dark:hover:bg-neutral-900/50"
            >
              <div className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
                <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-blue-100 text-[10px] font-extrabold text-sky-800 sm:h-10 sm:w-10 sm:rounded-xl dark:from-sky-900/50 dark:to-blue-900/40 dark:text-sky-200">
                    {inviteInitials(invite.email)}
                  </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[12.5px] font-bold text-neutral-900 sm:text-[13px] dark:text-neutral-100">
                      {invite.email}
                    </p>
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
            </article>
          ))}
        </div>
      )}

      {canManage && (
        <SlideOver
          open={slideOpen}
          onClose={() => setSlideOpen(false)}
          title="Send team invite"
          subtitle="They get a secure join link by email, choose their own password, and land in the role you pick. Links expire after 7 days."
          icon={UserPlus}
          accent="sky"
          size="lg"
          multilineSubtitle
          footer={
            <SlideOverFooter
              onCancel={() => setSlideOpen(false)}
              submitLabel="Send invite"
              loading={saving}
            />
          }
        >
          <form id="slideover-form" onSubmit={handleInvite} className="flex min-h-[min(58vh,26rem)] flex-col">
            <ModalPanel accent="sky" bodyClassName="flex flex-1 flex-col p-5 sm:p-6">
              <div className="space-y-5">
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
