import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthButton from '../components/auth/AuthButton';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { toastError } from '../utils/toast';

const trustPoints = [
  { icon: ShieldCheck, label: '256-bit encryption' },
  { icon: Lock, label: 'SOC 2 compliant' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
      navigate('/');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={requires2FA ? 'Two-factor authentication' : 'Welcome back'}
      subtitle={
        requires2FA
          ? 'Enter the 6-digit code from your authenticator app'
          : 'Sign in to manage conversations, campaigns, and your team inbox.'
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
              className="text-[12px] font-semibold text-theme-secondary hover:text-theme-fg"
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
          <div className="mt-6 flex items-center justify-center gap-4 border-t border-theme-border/70 pt-5">
            {trustPoints.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-theme-muted">
                <Icon className="h-3.5 w-3.5 shrink-0 text-whatsapp-600 dark:text-whatsapp-400" />
                <span className="text-[11px] font-medium">{label}</span>
              </div>
            ))}
          </div>

          <p className="mt-5 text-center text-[13px] text-theme-secondary">
            No account yet?{' '}
            <Link
              to="/register"
              className="font-semibold text-theme-fg underline decoration-whatsapp-500/40 underline-offset-2 transition hover:decoration-whatsapp-500"
            >
              Create one free
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
