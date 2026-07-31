import { ArrowRight, Clock, Lock, Mail, Rocket, ShieldCheck } from 'lucide-react';
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

const highlights = [
  { icon: Rocket, label: 'Free to start' },
  { icon: Clock, label: 'Setup in minutes' },
];

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
      eyebrow={requires2FA ? 'Security' : 'Sign in'}
      title={requires2FA ? 'Two-factor authentication' : 'Welcome back'}
      subtitle={
        requires2FA
          ? 'Enter the 6-digit code from your authenticator app to continue.'
          : 'Access your team inbox, campaigns, and automations from one workspace.'
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
                    className="h-4 w-4 rounded border-theme-border text-whatsapp-600 focus:ring-whatsapp-500/25"
                  />
                  <span className="text-[12px] font-medium text-theme-secondary">Remember me</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[12px] font-semibold text-whatsapp-700 transition hover:text-whatsapp-600 dark:text-whatsapp-400 dark:hover:text-whatsapp-300"
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
              className="text-[12px] font-semibold text-theme-secondary transition hover:text-theme-fg"
            >
              ← Back to password
            </button>
          </>
        )}

        <div className="pt-1">
          <AuthButton loading={loading} loadingText="Signing in...">
            <span className="flex items-center gap-2">
              {requires2FA ? 'Verify & sign in' : 'Sign in'}
              <ArrowRight className="h-4 w-4" />
            </span>
          </AuthButton>
        </div>
      </form>

      {!requires2FA && (
        <>
          <AuthDivider label="or" />
          <GoogleAuthButton onClick={signInWithGoogle} />

          <div className="mt-6 flex items-center justify-center gap-5 text-theme-muted">
            {highlights.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-xs">{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[13px] text-theme-secondary">
            No account yet?{' '}
            <Link
              to="/register"
              className="font-semibold text-whatsapp-700 underline decoration-whatsapp-500/40 underline-offset-2 transition hover:decoration-whatsapp-500 dark:text-whatsapp-400"
            >
              Create one free
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
