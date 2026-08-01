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
          : 'Sign in to continue to your workspace'
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

        <div className="pt-2">
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
          <GoogleAuthButton onClick={signInWithGoogle} />

          <p className="mt-6 text-center text-[13.5px] text-slate-600">
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
