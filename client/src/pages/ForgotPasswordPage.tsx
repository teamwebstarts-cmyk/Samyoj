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
  const [mailReady, setMailReady] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      const configured = res.data?.data?.smtpConfigured !== false;
      setMailReady(configured);
      setSent(true);
      toastSuccess(configured ? 'Check your email for a reset link' : 'Email delivery is not configured on this server');
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
          ? mailReady
            ? 'If that email is registered, you will receive a reset link shortly.'
            : 'This server is not sending email yet. A reset link was not delivered.'
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
