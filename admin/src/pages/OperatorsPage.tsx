import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import { Button, Drawer, EmptyState, Input, Notice, Select, StatusBadge } from '../components/ui/index';
import { formatWhen } from '../lib/format';
import type { PlatformRole } from '../types';

type OperatorRow = {
  id: string;
  email: string;
  role: PlatformRole;
  mfaEnabled: boolean;
  disabled: boolean;
};

type SessionRow = {
  id: string;
  operatorEmail: string;
  operatorRole?: PlatformRole;
  lastSeenAt: string;
  current?: boolean;
};

export function OperatorsPage() {
  const [operators, setOperators] = useState<OperatorRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorRow | null>(null);
  const [revoking, setRevoking] = useState<SessionRow | null>(null);
  const [reason, setReason] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [ops, sess] = await Promise.all([
      platformRequest<{ operators: OperatorRow[] }>('/operators'),
      platformRequest<{ sessions: SessionRow[] }>('/sessions'),
    ]);
    setOperators(ops.operators);
    setSessions(sess.sessions);
  }

  useEffect(() => {
    void load()
      .then(() => setError(''))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  function closeDrawers() {
    setOpen(false);
    setEditing(null);
    setRevoking(null);
    setReason('');
    setSaveError('');
  }

  if (error) return <Notice tone="error">{error}</Notice>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Operators</h1>
        <Button
          onClick={() => {
            setOpen(true);
            setReason('');
            setSaveError('');
          }}
        >
          Add operator
        </Button>
      </div>
      <div className="rounded-2xl border border-dust bg-white">
        {operators.length === 0 && (
          <EmptyState icon={Users} title="No operators" description="Create the first platform operator." />
        )}
        {operators.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 border-b border-dust px-4 py-3 last:border-0 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold">{row.email}</p>
              <p className="text-xs text-ink/50">
                {row.role} · MFA {row.mfaEnabled ? 'on' : 'pending'} · {row.disabled ? 'disabled' : 'active'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(row);
                setReason('');
                setSaveError('');
              }}
            >
              Change
            </Button>
          </div>
        ))}
      </div>
      <section>
        <h2 className="text-lg font-semibold">Sessions</h2>
        <div className="mt-3 rounded-2xl border border-dust bg-white">
          {sessions.length === 0 && <p className="p-4 text-sm text-ink/50">No active sessions.</p>}
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-2 border-b border-dust px-4 py-3 last:border-0 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm">{session.operatorEmail}</p>
                <p className="text-xs text-ink/50">Last seen {formatWhen(session.lastSeenAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {session.current && <StatusBadge status="ACTIVE" label="this device" />}
                {!session.current && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setRevoking(session);
                      setReason('');
                      setSaveError('');
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Drawer open={open} title="Add operator" onClose={closeDrawers}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            setSaving(true);
            setSaveError('');
            void platformRequest('/operators', {
              method: 'POST',
              body: JSON.stringify({
                reason,
                email: (form.elements.namedItem('email') as HTMLInputElement).value,
                password: (form.elements.namedItem('password') as HTMLInputElement).value,
                role: (form.elements.namedItem('role') as HTMLSelectElement).value,
              }),
            })
              .then(() => {
                closeDrawers();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Create failed'))
              .finally(() => setSaving(false));
          }}
        >
          <Input name="email" label="Email" type="email" required />
          <Input
            name="password"
            label="Password"
            type="password"
            required
            minLength={8}
            hint="At least 8 characters, with uppercase, lowercase, and a number."
          />
          <Select name="role" label="Role" defaultValue="SUPPORT">
            <option value="SUPPORT">SUPPORT</option>
            <option value="ANALYST">ANALYST</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </Select>
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
          <Button type="submit" loading={saving}>
            Create
          </Button>
        </form>
      </Drawer>

      <Drawer open={Boolean(editing)} title="Change operator" subtitle={editing?.email} onClose={closeDrawers}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editing) return;
            const form = event.currentTarget;
            const role = (form.elements.namedItem('role') as HTMLSelectElement).value as PlatformRole;
            const disabled = (form.elements.namedItem('disabled') as HTMLInputElement).checked;
            setSaving(true);
            setSaveError('');
            void platformRequest(`/operators/${editing.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ reason, role, disabled }),
            })
              .then(() => {
                closeDrawers();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Save failed'))
              .finally(() => setSaving(false));
          }}
        >
          <Select name="role" label="Role" defaultValue={editing?.role}>
            <option value="SUPPORT">SUPPORT</option>
            <option value="ANALYST">ANALYST</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input name="disabled" type="checkbox" defaultChecked={editing?.disabled} /> Disabled
          </label>
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
          <Button type="submit" loading={saving}>
            Save
          </Button>
        </form>
      </Drawer>

      <Drawer open={Boolean(revoking)} title="Revoke session" onClose={closeDrawers}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!revoking) return;
            setSaving(true);
            setSaveError('');
            void platformRequest(`/sessions/${revoking.id}`, {
              method: 'DELETE',
              body: JSON.stringify({ reason }),
            })
              .then(() => {
                closeDrawers();
                void load();
              })
              .catch((err) => setSaveError(err instanceof ApiError ? err.message : 'Revoke failed'))
              .finally(() => setSaving(false));
          }}
        >
          <p className="text-sm text-ink/60">{revoking?.operatorEmail}</p>
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
          <Button type="submit" variant="danger" loading={saving}>
            Revoke
          </Button>
        </form>
      </Drawer>
    </div>
  );
}
