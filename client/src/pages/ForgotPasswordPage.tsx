import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import AuthButton from '../components/auth/AuthButton';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import { authApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
      toastSuccess('Check your email for a reset link');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Failed to send reset email'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle={
        sent
          ? 'If that email is registered, you will receive a reset link shortly.'
          : 'Enter your work email and we will send you a reset link.'
      }
    >
      {sent ? (
        <Link
          to="/login"
          className="block text-center text-[13px] font-semibold text-whatsapp-700 hover:underline"
        >
          Back to sign in
        </Link>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <AuthInput
            id="email"
            label="Work email"
            type="email"
            icon={Mail}
            value={email}
            onChange={setEmail}
            required
          />
          <AuthButton loading={loading} loadingText="Sending...">
            Send reset link
          </AuthButton>
          <p className="text-center text-[13px] text-theme-secondary">
            <Link to="/login" className="font-semibold text-theme-fg hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
