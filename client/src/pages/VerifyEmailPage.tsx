import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout';
import { authApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    void authApi
      .verifyEmail(token)
      .then(({ data }) => {
        setStatus('ok');
        setMessage(data.data.message || 'Email verified. You can sign in now.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err, 'Invalid or expired verification link'));
      });
  }, [searchParams]);

  return (
    <AuthLayout
      title={status === 'ok' ? 'Email verified' : status === 'error' ? 'Verification failed' : 'Verifying…'}
      subtitle={message}
      compact
    >
      <div className="text-center">
        <Link
          to="/login"
          className="inline-flex h-12 items-center justify-center rounded-[14px] bg-[#0A8954] px-5 text-sm font-semibold text-white"
        >
          Go to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
