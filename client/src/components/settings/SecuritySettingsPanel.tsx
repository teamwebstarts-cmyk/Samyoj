import { useState } from 'react';
import { Shield, KeyRound } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import { teamApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';

export default function SecuritySettingsPanel() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
      description="Update the password for your account."
      icon={Shield}
    >
      <section className="max-w-md rounded-xl border border-theme-border/80 bg-theme-subtle/20 p-3.5">
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
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <AppInput
              id="new-password"
              label="New"
              type="password"
              required
              placeholder="8+ characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <AppInput
              id="confirm-new-password"
              label="Confirm"
              type="password"
              required
              placeholder="Repeat password"
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
    </SettingsPanel>
  );
}
