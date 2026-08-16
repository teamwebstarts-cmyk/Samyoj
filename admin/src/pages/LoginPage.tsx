import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError, platformRequest } from '../api';
import { Button, Input, Notice } from '../components/ui';
import { LifecycleRail } from '../components/LifecycleRail';
import { useOperator } from '../context/OperatorContext';
import type { LoginState, Operator } from '../types';

export function LoginPage() {
  const { operator, setOperator } = useOperator();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [phase, setPhase] = useState<'password' | 'enroll' | 'totp'>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (operator) return <Navigate to="/" replace />;

  async function submitPassword() {
    setLoading(true);
    setError('');
    try {
      const data = await platformRequest<{
        state: LoginState;
        enrollment?: { secret: string; otpauthUrl: string };
        operator?: Operator;
        csrfToken?: string;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          totpCode: phase === 'totp' ? code : undefined,
        }),
      });
      if (data.state === 'AUTHENTICATED' && data.operator) {
        setOperator(data.operator);
        return;
      }
      if (data.state === 'MFA_ENROLLMENT_REQUIRED') {
        setOtpauthUrl(data.enrollment?.otpauthUrl || '');
        setSecret(data.enrollment?.secret || '');
        setPhase('enroll');
        return;
      }
      setPhase('totp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function enroll() {
    setLoading(true);
    setError('');
    try {
      const data = await platformRequest<{ operator: Operator }>('/auth/mfa/enroll', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      setOperator(data.operator);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'MFA enrollment failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[minmax(16rem,22rem)_1fr]">
      <aside className="hidden bg-graphite px-8 py-10 text-white md:flex md:flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          Samyoj platform
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Where orgs stall</h1>
        <p className="mt-3 text-sm text-white/60">
          Activation is a rail, not a dashboard widget. Connect, first contact, first send, then live
          inbox.
        </p>
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-4 text-white">
          <LifecycleRail decorative compact />
        </div>
      </aside>
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/45 md:hidden">
          Samyoj platform
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Operator sign in</h1>
        <p className="mt-2 text-sm text-ink/60">
          Separate from customer Samyoj. TOTP is required. Org founder ADMIN is not platform staff.
        </p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (phase === 'enroll' ? enroll() : submitPassword());
          }}
        >
          {phase === 'password' && (
            <>
              <Input
                label="Email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </>
          )}
          {phase === 'enroll' && (
            <div className="space-y-3 rounded-xl border border-dust bg-white p-4 text-sm">
              <p>Add this authenticator secret, then enter the 6-digit code. It is shown only during setup.</p>
              <p className="break-all font-mono text-xs">{secret}</p>
              <p className="break-all font-mono text-[11px] text-ink/50">{otpauthUrl}</p>
              <Input
                label="Authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          )}
          {phase === 'totp' && (
            <Input
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          )}
          {error && <Notice tone="error">{error}</Notice>}
          <Button className="w-full" type="submit" loading={loading}>
            {phase === 'enroll' ? 'Verify and continue' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}
