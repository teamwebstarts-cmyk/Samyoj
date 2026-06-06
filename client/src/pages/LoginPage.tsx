import { Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthButton from '../components/auth/AuthButton';
import AuthError from '../components/auth/AuthError';
import AuthInput from '../components/auth/AuthInput';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../utils/errors';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Enter your credentials to access your workspace."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <AuthError message={error} />}

        <AuthInput
          id="email"
          label="Email"
          type="email"
          icon={Mail}
          value={email}
          onChange={setEmail}
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
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <p className="mt-2 text-right">
            <span className="cursor-pointer text-[12px] font-semibold text-neutral-600 transition hover:text-neutral-900">
              Forgot password?
            </span>
          </p>
        </div>

        <div className="pt-2">
          <AuthButton loading={loading} loadingText="Signing in...">
            Continue
          </AuthButton>
        </div>
      </form>

      <p className="mt-6 text-center text-[13px] text-neutral-600">
        No account?{' '}
        <Link to="/register" className="font-semibold text-neutral-900 hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
