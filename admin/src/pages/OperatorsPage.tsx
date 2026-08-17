import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import {
  Button,
  Drawer,
  EmptyState,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  SectionCard,
  Select,
  StatusBadge,
} from '../components/ui/index';
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
  const [operators, setOperators] = useState<OperatorRow[] | null>(null);
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

  if (error) {
    return (
      <Notice tone="error">
        Could not load operators. {error} SUPER_ADMIN is required for this screen.
      </Notice>
    );
  }
  if (!operators) return <PageLoading label="Loading operators…" />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Operators"
        purpose="Platform staff only. ANALYST is read-only. SUPPORT can write orgs. SUPER_ADMIN manages this list and sessions."
        action={
          <Button
            onClick={() => {
              setOpen(true);
              setReason('');
              setSaveError('');
            }}
          >
            Add operator
          </Button>
        }
      />
      <SectionCard title="Staff" purpose="Disable a row instead of deleting history.">
        {operators.length === 0 ? (
          <div className="p-[var(--card-pad)]">
            <EmptyState
              icon={Users}
              title="No operators"
              description="Create the first platform operator. Bootstrap CLI is locked after one exists."
              action={
                <Button
                  onClick={() => {
                    setOpen(true);
                    setReason('');
                    setSaveError('');
                  }}
                >
                  Add operator
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table hidden md:table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>MFA</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {operators.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold">{row.email}</td>
                    <td>
                      <StatusBadge status={row.role} />
                    </td>
                    <td>{row.mfaEnabled ? 'on' : 'pending'}</td>
                    <td>
                      <StatusBadge status={row.disabled ? 'DISABLED' : 'ACTIVE'} />
                    </td>
                    <td className="text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-2 p-[var(--card-pad)] md:hidden">
              {operators.map((row) => (
                <div key={row.id} className="dashboard-card p-[var(--card-pad)]">
                  <p className="font-semibold">{row.email}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                    <StatusBadge status={row.role} />
                    MFA {row.mfaEnabled ? 'on' : 'pending'}
                    <StatusBadge status={row.disabled ? 'DISABLED' : 'ACTIVE'} />
                  </p>
                  <Button
                    className="mt-3"
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
          </div>
        )}
      </SectionCard>
      <SectionCard title="Sessions" purpose="current is this browser session. Revoke others.">
        {sessions.length === 0 ? (
          <p className="p-[var(--card-pad)] text-[13px] text-ink/50">No active sessions.</p>
        ) : (
          <div>
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-1.5 border-b border-dust px-3 py-2.5 last:border-0 md:flex-row md:items-center md:justify-between"
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
        )}
      </SectionCard>

      <Drawer
        open={open}
        title="Add operator"
        subtitle="Password never appears in the audit log."
        onClose={closeDrawers}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawers}>
              Cancel
            </Button>
            <Button type="submit" form="add-operator-form" loading={saving}>
              Create
            </Button>
          </>
        }
      >
        <form
          id="add-operator-form"
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
        </form>
      </Drawer>

      <Drawer
        open={Boolean(editing)}
        title="Change operator"
        subtitle={editing?.email}
        onClose={closeDrawers}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawers}>
              Cancel
            </Button>
            <Button type="submit" form="edit-operator-form" loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        <form
          id="edit-operator-form"
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
        </form>
      </Drawer>

      <Drawer
        open={Boolean(revoking)}
        title="Revoke session"
        subtitle={revoking?.operatorEmail}
        onClose={closeDrawers}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawers}>
              Cancel
            </Button>
            <Button type="submit" form="revoke-session-form" variant="danger" loading={saving}>
              Revoke
            </Button>
          </>
        }
      >
        <form
          id="revoke-session-form"
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
          <p className="text-sm text-ink/60">This signs that device out. Your current session stays.</p>
          <Input
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>
    </div>
  );
}
