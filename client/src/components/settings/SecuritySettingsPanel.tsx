import { useState } from 'react';
import { Shield, KeyRound, Smartphone } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import { useAuth } from '../../contexts/AuthContext';
import { teamApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';

export default function SecuritySettingsPanel() {
  const { twoFactorEnabled: initial2FA } = useAuth();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initial2FA);
  const [twoFactorStep, setTwoFactorStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
      toastSuccess('Two-factor authentication enabled successfully');
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toastError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toastError('Password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await teamApi.changePassword(currentPassword, newPassword);
      toastSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to change password'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password Change */}
      <SettingsPanel
        title="Account Password"
        description="Update your credentials to maintain strict account security."
        icon={KeyRound}
        accent="violet"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <AppInput
            id="current-password"
            label="Current password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <AppInput
            id="new-password"
            label="New password"
            type="password"
            required
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <AppInput
            id="confirm-new-password"
            label="Confirm new password"
            type="password"
            required
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
          />

          <AppButton
            type="submit"
            loading={changingPassword}
            disabled={!currentPassword || !newPassword || !confirmNewPassword}
          >
            Update password
          </AppButton>
        </form>
      </SettingsPanel>

      {/* Two-Factor Authentication (2FA) */}
      <SettingsPanel
        title="Two-Factor Authentication (2FA)"
        description="Require a one-time passcode from Google Authenticator, 1Password, or Authy when signing in."
        icon={Shield}
        accent="emerald"
      >
        <div className="space-y-4">
          <div
            className={`flex items-center justify-between rounded-2xl p-4 ring-1 ${
              twoFactorEnabled
                ? 'bg-emerald-50/90 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/40'
                : 'bg-theme-subtle/50 ring-theme-border'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  twoFactorEnabled
                    ? 'bg-emerald-100 text-whatsapp-600 dark:bg-emerald-900/50 dark:text-whatsapp-400'
                    : 'bg-theme-surface text-theme-muted'
                }`}
              >
                <Smartphone size={20} />
              </div>
              <div>
                <p className="font-extrabold text-theme-fg text-[14px]">
                  {twoFactorEnabled ? '2FA is Enabled' : '2FA is Disabled'}
                </p>
                <p className="text-[12px] font-medium text-theme-secondary">
                  {twoFactorEnabled
                    ? 'Your account is protected with two-factor verification.'
                    : 'Add an extra layer of protection to your workspace.'}
                </p>
              </div>
            </div>

            {!twoFactorEnabled && twoFactorStep === 'idle' && (
              <AppButton onClick={startSetup} loading={busy}>
                Enable 2FA
              </AppButton>
            )}
          </div>

          {twoFactorStep === 'setup' && (
            <div className="rounded-2xl border border-theme-border bg-theme-subtle/30 p-5 space-y-4">
              <p className="text-[13px] font-bold text-theme-fg">
                Scan QR Code with Authenticator App
              </p>
              <p className="text-[12px] text-theme-secondary">
                Use Google Authenticator, Microsoft Authenticator, or Authy to scan this code:
              </p>

              {otpauthUrl && (
                <div className="flex flex-col items-center gap-3 py-2 sm:flex-row">
                  <div className="rounded-xl border border-theme-border bg-white p-3 shadow-sm">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        otpauthUrl
                      )}`}
                      alt="2FA QR Code"
                      className="h-36 w-36"
                    />
                  </div>
                  <div className="space-y-1.5 text-[12px]">
                    <p className="font-medium text-theme-secondary">Manual entry secret key:</p>
                    <code className="block rounded-lg bg-theme-surface px-3 py-2 font-mono text-[12px] font-bold text-theme-fg ring-1 ring-theme-border select-all">
                      {secret}
                    </code>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3 pt-2">
                <div className="w-48">
                  <AppInput
                    label="6-digit verification code"
                    maxLength={6}
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <AppButton onClick={enable2FA} disabled={verifyCode.length !== 6} loading={busy}>
                  Verify & Activate 2FA
                </AppButton>
                <AppButton variant="secondary" onClick={() => setTwoFactorStep('idle')}>
                  Cancel
                </AppButton>
              </div>
            </div>
          )}

          {twoFactorEnabled && (
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/20 space-y-3">
              <p className="text-[13px] font-bold text-rose-900 dark:text-rose-200">
                Disable Two-Factor Authentication
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <AppInput
                  label="Current 6-digit code"
                  maxLength={6}
                  placeholder="123456"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                />
                <AppInput
                  label="Your account password"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
              </div>
              <AppButton
                variant="danger"
                size="sm"
                onClick={disable2FA}
                disabled={disableCode.length !== 6 || !disablePassword}
                loading={busy}
              >
                Disable 2FA
              </AppButton>
            </div>
          )}
        </div>
      </SettingsPanel>
    </div>
  );
}
