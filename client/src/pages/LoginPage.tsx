import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthButton from '../components/auth/AuthButton';
import AuthDivider from '../components/auth/AuthDivider';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { authApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError } from '../utils/toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const { login, refreshSession } = useAuth();
  const { signInWithGoogle } = useGoogleAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const safeReturnTo = (value: string | null): string | null => {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
    return value;
  };

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    const code = searchParams.get('code');
    const reason = searchParams.get('reason');

    if (oauth === 'error') {
      if (reason) {
        console.warn('[auth] Google OAuth redirect error:', reason);
      }
      const oauthErrors: Record<string, string> = {
        '2fa_required':
          'This account requires two-factor authentication. Sign in with email and your authenticator code.',
        unverified_email:
          'Google sign-in requires a verified email address. Verify it on your Google account or use email sign-in.',
      };
      toastError(
        (reason && oauthErrors[reason]) ||
          'Google sign-in was cancelled or could not be completed. Please try again or use email sign-in.'
      );
      navigate('/login', { replace: true });
      return;
    }

    if (oauth === 'google' && code) {
      setOauthLoading(true);
      void authApi
        .exchangeOAuthCode(code)
        .then(async () => {
          await refreshSession();
          navigate(safeReturnTo(searchParams.get('returnTo')) || '/', { replace: true });
        })
        .catch((err) => {
          toastError(getErrorMessage(err, 'Google sign-in failed'));
          navigate('/login', { replace: true });
        })
        .finally(() => setOauthLoading(false));
    }
  }, [searchParams, navigate, refreshSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password, requires2FA ? totpCode : undefined);
      if (result.requires2FA) {
        setRequires2FA(true);
        toastError('Enter your authenticator code to continue');
        return;
      }
      if (result.mustResetPassword) {
        toastError('Your account needs a new password. Set one to continue.');
        navigate('/settings?tab=security&resetPassword=1', { replace: true });
        return;
      }
      navigate(safeReturnTo(searchParams.get('returnTo')) || '/');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  if (oauthLoading) {
    return (
      <AuthLayout title="Signing you in…" subtitle="Finishing Google authentication.">
        <p className="text-center text-sm text-slate-500">Please wait a moment.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={requires2FA ? 'Two-factor authentication' : 'Welcome back'}
      subtitle={
        requires2FA
          ? 'Enter the 6-digit code from your authenticator app to continue.'
          : 'Sign in to continue to your workspace.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!requires2FA ? (
          <>
            <AuthInput
              id="email"
              label="Work email"
              type="email"
              icon={Mail}
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />

            <div className="space-y-2.5">
              <AuthInput
                id="password"
                label="Password"
                type="password"
                icon={Lock}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />

              <div className="pt-0.5">
                <Link
                  to="/forgot-password"
                  className="auth-link text-[13px] font-semibold"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <AuthInput
              id="totp"
              label="Authenticator code"
              icon={ShieldCheck}
              value={totpCode}
              onChange={setTotpCode}
              placeholder="000000"
              required
            />
            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setTotpCode('');
              }}
              className="text-[13px] font-semibold text-slate-500 transition hover:text-slate-800"
            >
              ← Back to password
            </button>
          </>
        )}

        <div className="pt-1">
          <AuthButton loading={loading} loadingText="Signing in...">
            <span className="flex items-center gap-2">
              {requires2FA ? 'Verify & sign in' : 'Sign in'}
              <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.4} />
            </span>
          </AuthButton>
        </div>

        {!requires2FA && (
          <p className="pt-1 text-center text-[13px] font-medium text-slate-500">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="auth-link font-bold"
            >
              Sign up
            </Link>
          </p>
        )}
      </form>

      {!requires2FA && (
        <>
          <AuthDivider label="or" />
          <GoogleAuthButton
            onClick={() =>
              void signInWithGoogle(safeReturnTo(searchParams.get('returnTo')) || undefined)
            }
          />
        </>
      )}
    </AuthLayout>
  );
}
