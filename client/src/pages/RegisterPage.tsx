import { Building2, Lock, Mail, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthButton from '../components/auth/AuthButton';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errors';
import { toastError } from '../utils/toast';

function getPasswordStrength(password: string) {
  if (!password) return { label: '', width: '0%', color: 'bg-neutral-200' };
  if (password.length < 8) return { label: 'Too short', width: '25%', color: 'bg-red-400' };
  if (password.length < 10) return { label: 'Fair', width: '50%', color: 'bg-amber-400' };
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) {
    return { label: 'Strong', width: '100%', color: 'bg-whatsapp-500' };
  }
  return { label: 'Good', width: '75%', color: 'bg-emerald-400' };
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const passwordStrength = useMemo(
    () => getPasswordStrength(form.password),
    [form.password],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      navigate('/');
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start free — no credit card required."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
            hint="Min. 8 chars"
            required
            minLength={8}
          />
          {form.password && (
            <div className="mt-2.5">
              <div className="h-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                  style={{ width: passwordStrength.width }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-medium text-neutral-600">
                Strength: <span className="text-neutral-600">{passwordStrength.label}</span>
              </p>
            </div>
          )}
        </div>

        <div className="pt-2">
          <AuthButton loading={loading} loadingText="Creating account...">
            Create account
          </AuthButton>
        </div>
      </form>

      <p className="mt-5 text-center text-[13px] text-theme-secondary">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-semibold text-theme-fg underline decoration-whatsapp-500/40 underline-offset-2 transition hover:decoration-whatsapp-500"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
