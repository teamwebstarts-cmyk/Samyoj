import { Building2, Lock, Mail, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthButton from '../components/auth/AuthButton';
import AuthDivider from '../components/auth/AuthDivider';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import GoogleAuthButton from '../components/auth/GoogleAuthButton';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { authApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';

function getPasswordStrength(password: string) {
  if (!password) return { label: '', width: '0%', color: 'bg-neutral-200' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (score <= 1) return { label: 'Weak', width: '25%', color: 'bg-red-400' };
  if (score === 2) return { label: 'Fair', width: '45%', color: 'bg-amber-400' };
  if (score === 3) return { label: 'Good', width: '70%', color: 'bg-emerald-400' };
  return { label: 'Strong', width: '100%', color: 'bg-whatsapp-500' };
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
  });
  const [loading, setLoading] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(true);
  const { register } = useAuth();
  const { signInWithGoogle } = useGoogleAuth();
  const navigate = useNavigate();

  const passwordStrength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await register(form);
      if (result.emailVerificationRequired) {
        setPendingVerifyEmail(result.email);
        setSmtpConfigured(result.smtpConfigured);
        toastSuccess('Account created — verify your email to sign in');
        return;
      }
      toastSuccess('Account created — welcome!');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerifyEmail) {
    return (
      <AuthLayout
        compact
        title="Check your email"
        subtitle={`We sent a verification link to ${pendingVerifyEmail}. Verify before signing in.`}
      >
        {!smtpConfigured && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900">
            We&apos;re unable to send email right now. If you don&apos;t receive a verification link
            within a few minutes, try resending below or contact support.
          </p>
        )}
        <button
          type="button"
          className="mb-3 w-full text-[13px] font-semibold text-[#0A8954]"
          onClick={() =>
            void authApi
              .resendVerification(pendingVerifyEmail)
              .then(() => toastSuccess('Verification email resent. Check your inbox.'))
              .catch((err) => toastError(getErrorMessage(err, 'Could not resend')))
          }
        >
          Resend verification email
        </button>
        <Link
          to="/login"
          className="flex h-12 w-full items-center justify-center rounded-[14px] bg-[#0A8954] text-sm font-semibold text-white"
        >
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      compact
      title="Create your account"
      subtitle="Set up your workspace in minutes — free to start."
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <AuthInput
            id="name"
            label="Full name"
            icon={User}
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
          <AuthInput
            id="companyName"
            label="Company"
            icon={Building2}
            value={form.companyName}
            onChange={(value) => setForm({ ...form, companyName: value })}
            placeholder="Acme Inc."
            autoComplete="organization"
            required
          />
        </div>

        <AuthInput
          id="email"
          label="Work email"
          type="email"
          icon={Mail}
          value={form.email}
          onChange={(value) => setForm({ ...form, email: value })}
          placeholder="you@company.com"
          autoComplete="email"
          required
        />

        <div>
          <AuthInput
            id="password"
            label="Password"
            type="password"
            icon={Lock}
            value={form.password}
            onChange={(value) => setForm({ ...form, password: value })}
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            hint="Upper + lower + number"
            required
            minLength={8}
          />
          {form.password && (
            <div className="mt-2">
              <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                  style={{ width: passwordStrength.width }}
                />
              </div>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                Strength: <span className="text-slate-700">{passwordStrength.label}</span>
              </p>
            </div>
          )}
        </div>

        <div className="pt-0.5">
          <AuthButton loading={loading} loadingText="Creating account...">
            Create account
          </AuthButton>
        </div>

        <p className="pt-1.5 text-center text-[11px] leading-relaxed text-slate-400">
          By creating an account, you agree to our{' '}
          <a
            href="/terms.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 underline hover:text-slate-800"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-600 underline hover:text-slate-800"
          >
            Privacy Policy
          </a>.
        </p>

        <p className="pt-1 text-center text-[13px] font-medium text-slate-500">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-bold text-[#0A8954] transition hover:text-[#087A4A]"
          >
            Sign in
          </Link>
        </p>
      </form>

      <AuthDivider label="or" />
      <GoogleAuthButton onClick={signInWithGoogle} label="Continue with Google" />
    </AuthLayout>
  );
}
