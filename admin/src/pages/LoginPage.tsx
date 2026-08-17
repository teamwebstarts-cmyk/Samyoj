import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError, platformRequest } from '../api';
import { LifecycleRail } from '../components/LifecycleRail';
import { PlatformBrand } from '../components/PlatformBrand';
import { Button, Input, Notice } from '../components/ui';
import { useOperator } from '../context/OperatorContext';
import { phaseAfterPasswordLogin } from '../lib/login';
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
      const next = phaseAfterPasswordLogin(data.state);
      if (next === 'authenticated') {
        if (data.operator) setOperator(data.operator);
        return;
      }
      if (next === 'enroll') {
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

  const heading =
    phase === 'enroll' ? 'Add an authenticator' : phase === 'totp' ? 'Enter authenticator code' : 'Operator sign in';
  const purpose =
    phase === 'enroll'
      ? 'Save this secret in your authenticator, then enter the 6-digit code. It is shown only during setup.'
      : phase === 'totp'
        ? 'This environment requires TOTP. Local often skips this step.'
        : 'Separate from customer Samyoj. Org founder ADMIN is not platform staff.';

  return (
    <div className="min-h-screen md:grid md:grid-cols-[minmax(16rem,20rem)_1fr]">
      <aside className="hidden bg-graphite px-6 py-8 text-white md:flex md:flex-col">
        <PlatformBrand size="sm" />
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
          Platform console
        </p>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight leading-tight">Where orgs stall</h1>
        <p className="mt-2 text-[13px] leading-snug text-white/58">
          Activation is a rail: registered, connect WhatsApp, first contact, first send, then live inbox.
        </p>
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-3">
          <LifecycleRail decorative compact inverted />
        </div>
      </aside>
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-10 md:max-w-md md:px-8">
        <div className="mb-5 flex items-center gap-2 md:hidden">
          <PlatformBrand size="sm" collapsed />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/45">Samyoj platform</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-1.5 text-[13px] text-ink/60">{purpose}</p>
        <form
          className="dashboard-card mt-6 space-y-3 p-[var(--card-pad)]"
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
            <div className="space-y-2.5 text-[13px]">
              <div className="rounded-lg bg-sage-faint px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sage">Authenticator secret</p>
                <p className="mt-0.5 break-all font-mono text-[11px]">{secret}</p>
              </div>
              <p className="break-all font-mono text-[10px] text-ink/45">{otpauthUrl}</p>
              <Input
                label="Authenticator code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                hint="6 digits from the app you just added."
              />
              <button
                type="button"
                className="text-[11px] text-ink/55 underline"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  setError('');
                  void platformRequest<{ enrollment?: { secret: string; otpauthUrl: string } }>(
                    '/auth/mfa/reset-enrollment',
                    { method: 'POST', body: JSON.stringify({}) }
                  )
                    .then((data) => {
                      setOtpauthUrl(data.enrollment?.otpauthUrl || '');
                      setSecret(data.enrollment?.secret || '');
                    })
                    .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not reset secret'))
                    .finally(() => setLoading(false));
                }}
              >
                Generate a new authenticator secret
              </button>
            </div>
          )}
          {phase === 'totp' && (
            <Input
              label="Authenticator code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              hint="6-digit code. Shown only when the API asks for MFA."
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
