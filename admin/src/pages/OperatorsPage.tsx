import { useEffect, useState } from 'react';
import {
  KeyRound,
  Laptop,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { ApiError, platformRequest } from '../api';
import {
  Button,
  Drawer,
  EmptyState,
  Input,
  Notice,
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
        Could not load operator directory. {error} SUPER_ADMIN permission is required.
      </Notice>
    );
  }
  if (!operators) return <PageLoading label="Loading operator security directory…" />;

  return (
    <div className="space-y-6 pb-12">
      {/* Operator List Card */}
      <SectionCard
        title="Platform Operators"
        purpose="ANALYST is read-only. SUPPORT can modify accounts. SUPER_ADMIN controls all platform settings and staff."
        action={
          <Button
            onClick={() => {
              setOpen(true);
              setReason('');
              setSaveError('');
            }}
          >
            <UserPlus className="h-4 w-4 mr-1.5" /> Add New Operator
          </Button>
        }
      >
        {operators.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No operators configured"
              description="Create the primary super admin account to secure this console."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Operator Email</th>
                  <th>Assigned Role</th>
                  <th>MFA Status</th>
                  <th>Access Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {operators.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <p className="font-bold text-slate-900">{row.email}</p>
                    </td>
                    <td>
                      <StatusBadge status={row.role} />
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs">
                        {row.mfaEnabled ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-success-700">
                            <ShieldCheck className="h-3.5 w-3.5" /> Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <KeyRound className="h-3.5 w-3.5" /> Pending setup
                          </span>
                        )}
                      </div>
                    </td>
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
                        Edit permissions
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Active Sessions List */}
      <SectionCard title="Active Device Sessions" purpose="Active operator login tokens with one-click remote termination.">
        {sessions.length === 0 ? (
          <p className="p-6 text-center text-xs text-slate-400">No active sessions tracked.</p>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <Laptop className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900">{session.operatorEmail}</p>
                      {session.current && <StatusBadge status="ACTIVE" label="Current device" />}
                    </div>
                    <p className="text-[11px] text-slate-500">Last active {formatWhen(session.lastSeenAt)}</p>
                  </div>
                </div>

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
                    Revoke session
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Drawer: Add Operator */}
      <Drawer
        open={open}
        title="Create Platform Operator"
        subtitle="Passwords are cryptographically hashed and never logged."
        onClose={closeDrawers}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawers}>
              Cancel
            </Button>
            <Button type="submit" form="add-operator-form" loading={saving}>
              Create Operator
            </Button>
          </>
        }
      >
        <form
          id="add-operator-form"
          className="space-y-4"
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
          <Input name="email" label="Operator Email Address" type="email" required />
          <Input
            name="password"
            label="Initial Password"
            type="password"
            required
            minLength={8}
            hint="Minimum 8 characters with upper, lower, and numbers."
          />
          <Select name="role" label="Platform Security Role" defaultValue="SUPPORT">
            <option value="SUPPORT">SUPPORT (Account writes & outreach)</option>
            <option value="ANALYST">ANALYST (Read-only observation)</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN (Full platform permissions)</option>
          </Select>
          <Input
            label="Operator Justification (Audit requirement)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>

      {/* Drawer: Edit Operator */}
      <Drawer
        open={Boolean(editing)}
        title="Modify Operator Access"
        subtitle={editing?.email}
        onClose={closeDrawers}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawers}>
              Cancel
            </Button>
            <Button type="submit" form="edit-operator-form" loading={saving}>
              Save Changes
            </Button>
          </>
        }
      >
        <form
          id="edit-operator-form"
          className="space-y-4"
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
          <Select name="role" label="Platform Security Role" defaultValue={editing?.role}>
            <option value="SUPPORT">SUPPORT</option>
            <option value="ANALYST">ANALYST</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </Select>

          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
            <input
              name="disabled"
              type="checkbox"
              defaultChecked={editing?.disabled}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Disable account login (Suspends access without deleting audit history)
          </label>

          <Input
            label="Operator Justification (Audit requirement)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={8}
          />
          {saveError && <Notice tone="error">{saveError}</Notice>}
        </form>
      </Drawer>

      {/* Drawer: Revoke Session */}
      <Drawer
        open={Boolean(revoking)}
        title="Revoke Device Session"
        subtitle={revoking?.operatorEmail}
        onClose={closeDrawers}
        footer={
          <>
            <Button variant="ghost" onClick={closeDrawers}>
              Cancel
            </Button>
            <Button type="submit" form="revoke-session-form" variant="danger" loading={saving}>
              Revoke Session
            </Button>
          </>
        }
      >
        <form
          id="revoke-session-form"
          className="space-y-4"
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
          <p className="text-xs text-slate-600">
            This will immediately invalidate the session cookie on that device and force a re-login.
          </p>
          <Input
            label="Operator Justification (Audit requirement)"
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
