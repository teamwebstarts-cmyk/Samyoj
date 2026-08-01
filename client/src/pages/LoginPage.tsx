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
import { getErrorMessage } from '../utils/errors';
import { toastError } from '../utils/toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { signInWithGoogle } = useGoogleAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const oauth = searchParams.get('oauth');
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    if (oauth && accessToken && refreshToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      const returnTo = searchParams.get('returnTo');
      navigate(
        returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/',
        { replace: true }
      );
    }
  }, [searchParams, navigate]);

  const safeReturnTo = (value: string | null): string | null => {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
    return value;
  };

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
      navigate(safeReturnTo(searchParams.get('returnTo')) || '/');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={requires2FA ? 'Two-factor authentication' : 'Welcome back 👋'}
      subtitle={
        requires2FA
          ? 'Enter the 6-digit code from your authenticator app to continue.'
          : 'Sign in to continue to your workspace.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {!requires2FA ? (
          <>
            <AuthInput
              id="email"
              label="Work Email"
              type="email"
              icon={Mail}
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />

            <div className="space-y-2">
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
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-whatsapp-600 focus:ring-whatsapp-500/25"
                  />
                  <span className="text-[12px] font-medium text-neutral-600">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[12px] font-semibold text-whatsapp-600 transition hover:text-whatsapp-700"
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
              className="text-[12px] font-semibold text-neutral-500 transition hover:text-neutral-800"
            >
              ← Back to password
            </button>
          </>
        )}

        <div className="pt-1">
          <AuthButton loading={loading} loadingText="Signing in..." className="!h-12 !rounded-xl">
            <span className="flex w-full items-center justify-between gap-2 px-0.5">
              <span>{requires2FA ? 'Verify & sign in' : 'Sign in'}</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </span>
          </AuthButton>
        </div>
      </form>

      {!requires2FA && (
        <>
          <AuthDivider label="or" />
          <GoogleAuthButton onClick={signInWithGoogle} />

          <p className="mt-6 text-center text-[13px] text-neutral-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-semibold text-whatsapp-600 underline decoration-whatsapp-500/40 underline-offset-2 transition hover:decoration-whatsapp-500"
            >
              Create one free
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
