import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Lock, Mail, UserPlus } from 'lucide-react';
import AuthButton from '../components/auth/AuthButton';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuth } from '../contexts/AuthContext';
import { teamApi } from '../services/api';
import { RoleBadge } from '../components/team/AvailabilityBadge';
import { roleLabels } from '../components/team/teamUi';
import type { OrgRole } from '../types';
import { toastError, toastSuccess } from '../utils/toast';

interface InvitePreview {
  email: string;
  name?: string | null;
  orgRole: OrgRole;
  companyName: string;
  department?: { id: string; name: string } | null;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [existingAccount, setExistingAccount] = useState(false);

  useEffect(() => {
    if (!token) return;
    teamApi.invites
      .getByToken(token)
      .then(({ data }) => {
        setInvite(data.data);
        setName(data.data.name ?? '');
      })
      .catch(() => toastError('Invalid or expired invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (password !== confirmPassword) {
      toastError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await teamApi.invites.accept({
        token,
        name: name.trim() || undefined,
        password,
      });
      await refreshSession();
      toastSuccess(`Welcome to ${data.data.organization.companyName}!`);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to accept invite';
      // Existing account for this email — server refuses to overwrite it.
      if (message.includes('already exists') || message.includes('already a member')) {
        setExistingAccount(true);
        toastError(message);
      } else {
        toastError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Loading invite..." subtitle="Please wait">
        <div className="py-12 text-center text-theme-secondary">Verifying your invite...</div>
      </AuthLayout>
    );
  }

  if (!invite) {
    return (
      <AuthLayout title="Invite not found" subtitle="This link may have expired or been revoked">
      <p className="text-center text-[13px] text-theme-secondary">
        Ask your admin to send a new invite, or{' '}
        <Link to="/login" className="font-semibold text-whatsapp-700 underline">
          sign in
        </Link>{' '}
        if you already have an account.
      </p>

      {existingAccount && (
        <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 text-[12px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="font-semibold">This email already has an account.</p>
          <p className="mt-1">
            Sign in instead — your admin can re-invite you to this team after you sign in.
          </p>
          <Link
            to="/login"
            className="mt-2 inline-block font-semibold text-whatsapp-700 underline"
          >
            Go to sign in →
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}

  return (
    <AuthLayout
      title="Join your team"
      subtitle={`You've been invited to ${invite.companyName}`}
    >
      <div className="mb-6 rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-500/10 to-whatsapp-500/5 p-4 dark:border-emerald-800/40">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-600 to-emerald-700 text-white">
            <UserPlus className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="text-[13px] font-bold text-theme-fg">{invite.email}</p>
            <div className="flex flex-wrap items-center gap-2">
              <RoleBadge role={invite.orgRole} />
              <span className="text-[11px] text-theme-secondary">{roleLabels[invite.orgRole]}</span>
            </div>
            {invite.department && (
              <p className="flex items-center gap-1.5 text-[12px] text-theme-secondary">
                <Building2 className="h-3.5 w-3.5" />
                {invite.department.name}
              </p>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="invite-name"
          label="Your name"
          icon={Mail}
          value={name}
          onChange={setName}
          placeholder="Full name"
          required
        />
        <AuthInput
          id="invite-password"
          label="Create password"
          type="password"
          icon={Lock}
          value={password}
          onChange={setPassword}
          placeholder="Minimum 8 characters"
          required
          minLength={8}
        />
        <AuthInput
          id="invite-confirm"
          label="Confirm password"
          type="password"
          icon={Lock}
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Repeat password"
          required
        />
        <AuthButton loading={submitting} loadingText="Joining...">
          Accept invite & join
        </AuthButton>
      </form>
    </AuthLayout>
  );
}
