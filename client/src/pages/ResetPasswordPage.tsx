import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock } from 'lucide-react';
import AuthButton from '../components/auth/AuthButton';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import { authApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toastError('Passwords do not match');
      return;
    }
    if (!token) {
      toastError('Invalid reset link');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      toastSuccess('Password updated. Sign in with your new password.');
      navigate('/login');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to reset password'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout title="Invalid link" subtitle="This password reset link is missing or expired.">
        <Link to="/forgot-password" className="text-[13px] font-semibold text-whatsapp-700">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set new password" subtitle="Choose a strong password with at least 8 characters.">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <AuthInput
          id="password"
          label="New password"
          type="password"
          icon={Lock}
          value={password}
          onChange={setPassword}
          required
          minLength={8}
        />
        <AuthInput
          id="confirm"
          label="Confirm password"
          type="password"
          icon={Lock}
          value={confirm}
          onChange={setConfirm}
          required
          minLength={8}
        />
        <AuthButton loading={loading} loadingText="Saving...">
          Update password
        </AuthButton>
      </form>
    </AuthLayout>
  );
}
