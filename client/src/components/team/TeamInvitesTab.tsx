import { useEffect, useState } from 'react';
import { BarChart3, Clock, Copy, Link2, Mail, Send, UserPlus, XCircle } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';
import SectionCard from '../ui/SectionCard';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { teamApi } from '../../services/api';
import type { OrgRole, TeamDepartment, TeamInvite } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import { RoleBadge } from './AvailabilityBadge';
import { formatJoinedDate, roleLabels } from './teamUi';

interface TeamInvitesTabProps {
  departments: TeamDepartment[];
  canManage: boolean;
}

export default function TeamInvitesTab({ departments, canManage }: TeamInvitesTabProps) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const handleRevoke = async (invite: TeamInvite) => {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return;
    try {
      await teamApi.invites.revoke(invite.id);
      toastSuccess('Invite revoked');
      load();
    } catch {
      toastError('Failed to revoke invite');
    }
  };

  const copyLink = async (url?: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toastSuccess('Link copied');
  };

  if (loading) return <LoadingState label="Loading invites..." />;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Pending invites"
        subtitle="Send email invites with secure join links — no manual passwords needed"
        headerAction={
          canManage ? (
            <AppButton icon={<UserPlus size={16} />} onClick={() => setSlideOpen(true)}>
              Send invite
            </AppButton>
          ) : undefined
        }
      >
        {invites.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No pending invites"
            description="Invite teammates by email. They'll set their own password when joining."
            action={
              canManage ? (
                <AppButton icon={<Send size={16} />} onClick={() => setSlideOpen(true)}>
                  Send first invite
                </AppButton>
              ) : undefined
            }
          />
        ) : (
          <div className="divide-y divide-theme-border/60">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-theme-fg">{invite.email}</p>
                    <RoleBadge role={invite.orgRole} />
                    {invite.status === 'EXPIRED' && (
                      <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-600">
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
                      onClick={() => handleRevoke(invite)}
                    >
                      Revoke
                    </AppButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Link2,
            title: 'Secure links',
            desc: '7-day expiring invite URLs with one-time acceptance',
          },
          {
            icon: Clock,
            title: 'Self onboarding',
            desc: 'New agents choose their own password on join',
          },
          {
            icon: BarChart3,
            title: 'Seat tracking',
            desc: 'Pending invites count toward your plan seat limit',
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="dashboard-card flex gap-3 p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-whatsapp-500/10 text-whatsapp-600">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-theme-fg">{title}</p>
              <p className="mt-0.5 text-[12px] text-theme-secondary">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <SlideOver
          open={slideOpen}
          onClose={() => setSlideOpen(false)}
          title="Invite team member"
          subtitle="They'll receive a link to join your workspace"
          footer={
            <SlideOverFooter
              onCancel={() => setSlideOpen(false)}
              submitLabel="Send invite"
              loading={saving}
            />
          }
        >
          <form id="slideover-form" onSubmit={handleInvite} className="space-y-4">
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
          </form>
        </SlideOver>
      )}
    </div>
  );
}
