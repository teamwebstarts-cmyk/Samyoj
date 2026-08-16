import { useEffect, useState } from 'react';
import { platformRequest } from '../api';
import { Button, Drawer, Input } from '../components/ui';
import type { PlatformRole } from '../types';

type OperatorRow = {
  id: string;
  email: string;
  role: PlatformRole;
  mfaEnabled: boolean;
  disabled: boolean;
};

export function OperatorsPage() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [sessions, setSessions] = useState<Array<{ id: string; operatorEmail: string; lastSeenAt: string }>>([]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('Add platform operator');

  async function load() {
    const [ops, sess] = await Promise.all([
      platformRequest<{ operators: OperatorRow[] }>('/operators'),
      platformRequest<{ sessions: Array<{ id: string; operatorEmail: string; lastSeenAt: string }> }>('/sessions'),
    ]);
    setOperators(ops.operators);
    setSessions(sess.sessions);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Operators</h1>
        <Button onClick={() => setOpen(true)}>Add operator</Button>
      </div>
      <div className="rounded-2xl border border-dust bg-white">
        {operators.map((row) => (
          <div key={row.id} className="flex items-center justify-between border-b border-dust px-4 py-3 last:border-0">
            <div>
              <p className="font-semibold">{row.email}</p>
              <p className="text-xs text-ink/50">{row.role} · MFA {row.mfaEnabled ? 'on' : 'pending'} · {row.disabled ? 'disabled' : 'active'}</p>
            </div>
          </div>
        ))}
      </div>
      <section>
        <h2 className="text-lg font-semibold">Sessions</h2>
        <div className="mt-3 rounded-2xl border border-dust bg-white">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between border-b border-dust px-4 py-3 last:border-0">
              <p className="text-sm">{session.operatorEmail}</p>
              <Button
                variant="danger"
                onClick={() =>
                  void platformRequest(`/sessions/${session.id}`, {
                    method: 'DELETE',
                    body: JSON.stringify({ reason: 'Revoke operator session' }),
                  }).then(load)
                }
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      </section>
      <Drawer open={open} title="Add operator" onClose={() => setOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void platformRequest('/operators', {
              method: 'POST',
              body: JSON.stringify({
                reason,
                email: (form.elements.namedItem('email') as HTMLInputElement).value,
                password: (form.elements.namedItem('password') as HTMLInputElement).value,
                role: (form.elements.namedItem('role') as HTMLSelectElement).value,
              }),
            }).then(() => {
              setOpen(false);
              void load();
            });
          }}
        >
          <Input name="email" label="Email" type="email" required />
          <Input name="password" label="Password" type="password" required />
          <label className="block text-sm">
            Role
            <select name="role" className="mt-1 h-11 w-full rounded-lg border border-dust px-3">
              <option value="SUPPORT">SUPPORT</option>
              <option value="ANALYST">ANALYST</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </label>
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={8} />
          <Button type="submit">Create</Button>
        </form>
      </Drawer>
    </div>
  );
}
