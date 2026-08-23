import { useState } from 'react';
import { Shield, KeyRound, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
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
  const [qrDataUrl, setQrDataUrl] = useState('');
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
      setQrDataUrl(await QRCode.toDataURL(data.data.otpauthUrl, { margin: 1, width: 140 }));
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
      toastSuccess('Password changed');
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
    <SettingsPanel
      title="Account security"
      description="Password and two-factor login for your account."
      icon={Shield}
    >
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Password */}
        <section className="rounded-xl border border-theme-border/80 bg-theme-subtle/20 p-3.5">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-whatsapp-600" strokeWidth={2.25} />
            <h3 className="text-[13px] font-bold text-theme-fg">Password</h3>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-2.5">
            <AppInput
              id="current-password"
              label="Current"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <AppInput
                id="new-password"
                label="New"
                type="password"
                required
                placeholder="8+ chars"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <AppInput
                id="confirm-new-password"
                label="Confirm"
                type="password"
                required
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <AppButton
              type="submit"
              size="sm"
              loading={changingPassword}
              disabled={!currentPassword || !newPassword || !confirmNewPassword}
            >
              Update password
            </AppButton>
          </form>
        </section>

        {/* 2FA */}
        <section className="rounded-xl border border-theme-border/80 bg-theme-subtle/20 p-3.5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-whatsapp-600" strokeWidth={2.25} />
              <h3 className="text-[13px] font-bold text-theme-fg">Two-factor (2FA)</h3>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                twoFactorEnabled
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                  : 'bg-theme-subtle text-theme-muted ring-1 ring-theme-border'
              }`}
            >
              {twoFactorEnabled ? 'On' : 'Off'}
            </span>
          </div>

          <p className="mb-3 text-[11px] leading-relaxed text-theme-secondary">
            {twoFactorEnabled
              ? 'A code from your authenticator app is required at login.'
              : 'Add a code from Google Authenticator, Authy, or 1Password at login.'}
          </p>

          {!twoFactorEnabled && twoFactorStep === 'idle' && (
            <AppButton size="sm" onClick={startSetup} loading={busy}>
              Enable 2FA
            </AppButton>
          )}

          {twoFactorStep === 'setup' && (
            <div className="space-y-3">
              {qrDataUrl && (
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-theme-border bg-white p-2">
                    <img src={qrDataUrl} alt="2FA QR code" className="h-28 w-28" />
                  </div>
                  <code className="block flex-1 rounded-lg bg-theme-surface px-2 py-1.5 font-mono text-[10px] text-theme-fg ring-1 ring-theme-border select-all">
                    {secret}
                  </code>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-36">
                  <AppInput
                    label="6-digit code"
                    maxLength={6}
                    placeholder="123456"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <AppButton size="sm" onClick={enable2FA} disabled={verifyCode.length !== 6} loading={busy}>
                  Verify
                </AppButton>
                <AppButton size="sm" variant="secondary" onClick={() => setTwoFactorStep('idle')}>
                  Cancel
                </AppButton>
              </div>
            </div>
          )}

          {twoFactorEnabled && (
            <div className="space-y-2 border-t border-theme-border/60 pt-3">
              <p className="text-[11px] font-semibold text-theme-secondary">Disable 2FA</p>
              <div className="grid grid-cols-2 gap-2">
                <AppInput
                  label="Code"
                  maxLength={6}
                  placeholder="123456"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
                />
                <AppInput
                  label="Password"
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
        </section>
      </div>
    </SettingsPanel>
  );
}
