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
import { setAuthTokens } from '../utils/authStorage';
import { toastError, toastSuccess } from '../utils/toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
        .then(async ({ data }) => {
          setAuthTokens(data.data.accessToken, data.data.refreshToken);
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
    setNeedsVerify(false);
    try {
      const result = await login(email, password, requires2FA ? totpCode : undefined);
      if (result.requires2FA) {
        setRequires2FA(true);
        toastError('Enter your authenticator code to continue');
        return;
      }
      if (result.requiresEmailVerification) {
        setNeedsVerify(true);
        toastError('Verify your email before signing in');
        return;
      }
      navigate(safeReturnTo(searchParams.get('returnTo')) || '/');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    try {
      await authApi.resendVerification(email);
      toastSuccess('If verification is needed, a new email was sent. Check your inbox.');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not resend verification'));
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
      title={requires2FA ? 'Two-factor authentication' : 'Welcome'}
      subtitle={
        requires2FA
          ? 'Enter the 6-digit code from your authenticator app to continue.'
          : 'Sign in to continue to your workspace'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-[17px] w-[17px] rounded-[5px] border-slate-300 text-[#0A8954] focus:ring-[#0A8954]/25"
                  />
                  <span className="text-[13px] font-medium text-slate-600">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[13px] font-semibold text-[#0A8954] transition hover:text-[#087A4A]"
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

        {needsVerify && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900">
            <p className="font-semibold">Email not verified</p>
            <p className="mt-1 text-amber-800/90">
              Check your inbox for the verification link, or resend it.
            </p>
            <button
              type="button"
              onClick={() => void resendVerification()}
              className="mt-2 font-semibold text-[#0A8954] underline-offset-2 hover:underline"
            >
              Resend verification email
            </button>
          </div>
        )}

        <div className="pt-3">
          <AuthButton loading={loading} loadingText="Signing in...">
            <span className="flex items-center gap-2.5">
              {requires2FA ? 'Verify & sign in' : 'Sign in'}
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.35} />
            </span>
          </AuthButton>
        </div>
      </form>

      {!requires2FA && (
        <>
          <AuthDivider label="or" />
          <GoogleAuthButton
            onClick={() =>
              void signInWithGoogle(safeReturnTo(searchParams.get('returnTo')) || undefined)
            }
          />

          <p className="mt-7 text-center text-[13.5px] text-slate-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-[#0A8954] underline-offset-2 transition hover:text-[#087A4A] hover:underline"
            >
              Create one free
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
