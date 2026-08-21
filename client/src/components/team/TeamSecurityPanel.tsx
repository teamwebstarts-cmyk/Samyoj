import { useEffect, useState } from 'react';
import {
  KeyRound,
  Laptop,
  LogOut,
  Shield,
  Smartphone,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import { FormPageSkeleton } from '../ui/ListLayoutSkeleton';
import SectionCard from '../ui/SectionCard';
import { useAuth } from '../../contexts/AuthContext';
import { teamApi } from '../../services/api';
import type { UserSession } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import { getRefreshToken } from '../../utils/authStorage';
import { formatJoinedDate } from './teamUi';

export default function TeamSecurityPanel() {
  const { twoFactorEnabled: initial2FA } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [twoFactorStep, setTwoFactorStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initial2FA);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const loadSessions = () => {
    teamApi.sessions
      .list()
      .then(({ data }) => setSessions(data.data.sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const { data } = await teamApi.twoFactor.setup();
      setSecret(data.data.secret);
      setOtpauthUrl(data.data.otpauthUrl);
      setTwoFactorStep('setup');
    } catch {
      toastError('Failed to start 2FA setup');
    } finally {
      setBusy(false);
    }
  };

  const enable2FA = async () => {
    setBusy(true);
    try {
      await teamApi.twoFactor.enable(verifyCode);
      setTwoFactorEnabled(true);
      setTwoFactorStep('idle');
      setVerifyCode('');
      toastSuccess('Two-factor authentication enabled');
    } catch {
      toastError('Invalid verification code');
    } finally {
      setBusy(false);
    }
  };

  const disable2FA = async () => {
    setBusy(true);
    try {
      await teamApi.twoFactor.disable(disableCode, disablePassword);
      setTwoFactorEnabled(false);
      setDisableCode('');
      setDisablePassword('');
      toastSuccess('Two-factor authentication disabled');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to disable 2FA'
      );
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (id: string) => {
    try {
      await teamApi.sessions.revoke(id);
      toastSuccess('Session revoked');
      loadSessions();
    } catch {
      toastError('Failed to revoke session');
    }
  };

  const revokeAll = async () => {
    const current = getRefreshToken() ?? undefined;
    try {
      await teamApi.sessions.revokeAll(current);
      toastSuccess('All other sessions revoked');
      loadSessions();
    } catch {
      toastError('Failed to revoke sessions');
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toastError('New passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await teamApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toastSuccess('Password updated. Other devices were signed out.');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not change password'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <FormPageSkeleton label="Loading security settings" blocks={3} />;

  return (
    <div className="space-y-5">
      <SectionCard title="Change password" subtitle="Update your sign-in password">
        <div className="space-y-4">
          <AppInput
            id="pw-current"
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput
              id="pw-new"
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="8+ chars, mixed case, number"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <AppInput
              id="pw-confirm"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
            />
          </div>
          <AppButton
            icon={<KeyRound size={14} />}
            loading={changingPassword}
            disabled={!currentPassword || newPassword.length < 8 || newPassword !== confirmNewPassword}
            onClick={() => void handleChangePassword()}
          >
            Update password
          </AppButton>
        </div>
      </SectionCard>

      <SectionCard title="Two-factor authentication" subtitle="Add an extra layer of security to your account">
        {twoFactorStep === 'idle' && !twoFactorEnabled && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-theme-fg">Authenticator app</p>
                <p className="mt-0.5 max-w-md text-[12px] text-theme-secondary">
                  Use Google Authenticator, Authy, or any TOTP app to generate login codes.
                </p>
              </div>
            </div>
            <AppButton onClick={startSetup} loading={busy}>
              Enable 2FA
            </AppButton>
          </div>
        )}

        {twoFactorStep === 'setup' && (
          <div className="space-y-4">
            <p className="text-[13px] text-theme-secondary">
              Scan this secret in your authenticator app, then enter the 6-digit code to verify.
            </p>
            <div className="rounded-xl border border-theme-border bg-theme-subtle/40 p-3 font-mono text-[12px] break-all">
              {secret}
            </div>
            <p className="text-[11px] text-theme-muted break-all">{otpauthUrl}</p>
            <AppInput
              id="2fa-verify"
              label="Verification code"
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              maxLength={6}
            />
            <div className="flex gap-2">
              <AppButton onClick={enable2FA} loading={busy} disabled={verifyCode.length !== 6}>
                Verify & enable
              </AppButton>
              <AppButton variant="secondary" onClick={() => setTwoFactorStep('idle')}>
                Cancel
              </AppButton>
            </div>
          </div>
        )}

        {twoFactorEnabled && twoFactorStep === 'idle' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
              <Shield className="h-4 w-4" />
              2FA is enabled on your account
            </div>
            <AppInput
              id="2fa-disable-code"
              label="Authenticator code"
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              maxLength={6}
            />
            <AppInput
              id="2fa-disable-pass"
              label="Password"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
            />
            <AppButton variant="danger" onClick={disable2FA} loading={busy}>
              Disable 2FA
            </AppButton>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Active sessions"
        subtitle="Devices where you're currently signed in"
        headerAction={
          sessions.length > 1 ? (
            <AppButton variant="secondary" size="sm" icon={<LogOut size={14} />} onClick={revokeAll}>
              Sign out others
            </AppButton>
          ) : undefined
        }
      >
        <div className="divide-y divide-theme-border/60">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-theme-subtle text-theme-muted">
                  {(session.userAgent ?? '').includes('Mobile') ? (
                    <Smartphone className="h-4 w-4" />
                  ) : (
                    <Laptop className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-theme-fg">
                    {session.userAgent?.slice(0, 60) || 'Unknown device'}
                  </p>
                  <p className="text-[11px] text-theme-secondary">
                    {session.ipAddress && `${session.ipAddress} · `}
                    Started {formatJoinedDate(session.createdAt)}
                  </p>
                </div>
              </div>
              <AppButton variant="ghost" size="sm" onClick={() => revokeSession(session.id)}>
                Revoke
              </AppButton>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
