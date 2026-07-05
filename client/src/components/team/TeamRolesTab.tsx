import { Fragment, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Check,
  Crown,
  FileText,
  Lock,
  MessageSquare,
  RotateCcw,
  Send,
  Settings2,
  Shield,
  Users,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import LoadingState from '../ui/LoadingState';
import { teamApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import type { OrgRole, RolePermissionsMatrix, TeamPermissions } from '../../types';
import { RoleBadge } from './AvailabilityBadge';
import {
  CONFIGURABLE_ROLES,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  ROLE_COLUMNS,
  permissionMeta,
  roleAccentStyles,
  roleLabels,
  roleSummaries,
} from './teamUi';

interface TeamRolesTabProps {
  canManage: boolean;
}

const permissionIcons: Record<keyof TeamPermissions, LucideIcon> = {
  manageInbox: MessageSquare,
  manageTeam: Users,
  manageCampaigns: Send,
  manageTemplates: FileText,
  manageFlows: Bot,
  viewAnalytics: BarChart3,
  manageSettings: Settings2,
};

const roleIcons: Record<OrgRole, LucideIcon> = {
  OWNER: Crown,
  ADMIN: Shield,
  SUPERVISOR: Users,
  AGENT: MessageSquare,
};

function cloneMatrix(matrix: RolePermissionsMatrix): RolePermissionsMatrix {
  return {
    OWNER: { ...matrix.OWNER },
    ADMIN: { ...matrix.ADMIN },
    SUPERVISOR: { ...matrix.SUPERVISOR },
    AGENT: { ...matrix.AGENT },
  };
}

function countEnabled(matrix: RolePermissionsMatrix, role: OrgRole) {
  return PERMISSION_KEYS.filter((key) => matrix[role][key]).length;
}

function PermissionToggle({
  checked,
  locked,
  label,
  onToggle,
}: {
  checked: boolean;
  locked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={locked}
      onClick={onToggle}
      className={`group relative inline-flex h-8 w-[52px] items-center rounded-full border p-0.5 transition-all duration-200 ${
        checked
          ? 'border-emerald-300 bg-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.35)] dark:border-emerald-500/40 dark:bg-emerald-600'
          : 'border-theme-border bg-neutral-200/80 dark:bg-neutral-800'
      } ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-[1.03] active:scale-[0.98]'}`}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0'
        }`}
      >
        {checked ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
        ) : locked ? (
          <Lock className="h-3 w-3 text-neutral-400" />
        ) : null}
      </span>
    </button>
  );
}

export default function TeamRolesTab({ canManage }: TeamRolesTabProps) {
  const [matrix, setMatrix] = useState<RolePermissionsMatrix | null>(null);
  const [savedMatrix, setSavedMatrix] = useState<RolePermissionsMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    teamApi.rolePermissions
      .get()
      .then(({ data }) => {
        const roles = data.data.roles as RolePermissionsMatrix;
        setMatrix(cloneMatrix(roles));
        setSavedMatrix(cloneMatrix(roles));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isDirty = useMemo(() => {
    if (!matrix || !savedMatrix) return false;
    return CONFIGURABLE_ROLES.some((role) =>
      PERMISSION_KEYS.some((key) => matrix[role][key] !== savedMatrix[role][key])
    );
  }, [matrix, savedMatrix]);

  const togglePermission = (role: OrgRole, key: keyof TeamPermissions) => {
    if (!canManage || role === 'OWNER' || !matrix) return;
    setMatrix({
      ...matrix,
      [role]: {
        ...matrix[role],
        [key]: !matrix[role][key],
      },
    });
  };

  const handleSave = async () => {
    if (!canManage || !matrix || !isDirty) return;
    setSaving(true);
    try {
      const rolePermissions = Object.fromEntries(
        CONFIGURABLE_ROLES.map((role) => [role, matrix[role]])
      ) as Partial<Record<OrgRole, Partial<TeamPermissions>>>;

      const { data } = await teamApi.rolePermissions.update(rolePermissions);
      const roles = data.data.roles as RolePermissionsMatrix;
      setMatrix(cloneMatrix(roles));
      setSavedMatrix(cloneMatrix(roles));
      toastSuccess('Role permissions saved');
    } catch {
      toastError('Failed to save role permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!savedMatrix) return;
    setMatrix(cloneMatrix(savedMatrix));
  };

  if (loading || !matrix) {
    return (
      <div className="p-6">
        <LoadingState label="Loading roles & permissions..." />
      </div>
    );
  }

  let serialNo = 0;

  return (
    <div className="inbox-shell overflow-hidden">
      <div className="border-b border-theme-border bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-violet-500/[0.05] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              Access control
            </div>
            <h3 className="mt-3 text-lg font-extrabold tracking-tight text-theme-fg sm:text-xl">
              Roles & responsibilities
            </h3>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-theme-secondary">
              Define what each role can do across your workspace. Toggle permissions below — changes
              apply to every member assigned that role.
            </p>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <AppButton
                size="sm"
                variant="secondary"
                icon={<RotateCcw size={14} />}
                onClick={handleReset}
                disabled={!isDirty || saving}
              >
                Discard
              </AppButton>
              <AppButton
                size="sm"
                icon={<Check size={14} />}
                onClick={() => void handleSave()}
                disabled={!isDirty}
                loading={saving}
              >
                Save changes
              </AppButton>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {ROLE_COLUMNS.map((role) => {
            const accent = roleAccentStyles[role];
            const Icon = roleIcons[role];
            const enabled = countEnabled(matrix, role);

            return (
              <div
                key={role}
                className={`rounded-2xl border bg-theme-surface/80 p-4 shadow-sm backdrop-blur-sm ${accent.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent.bg}`}>
                    <Icon className={`h-5 w-5 ${accent.icon}`} strokeWidth={2.25} />
                  </div>
                  <RoleBadge role={role} />
                </div>
                <p className="mt-3 text-[14px] font-bold text-theme-fg">{roleLabels[role]}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-theme-secondary">
                  {roleSummaries[role]}
                </p>
                <p className="mt-3 text-[12px] font-semibold tabular-nums text-theme-muted">
                  <span className="text-[18px] font-extrabold text-theme-fg">{enabled}</span>
                  <span className="mx-1">/</span>
                  {PERMISSION_KEYS.length} permissions
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-theme-border bg-theme-subtle/60">
              <th
                scope="col"
                className="sticky left-0 z-30 w-14 bg-theme-subtle/95 px-3 py-4 text-center backdrop-blur-sm"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-theme-muted">
                  S.No.
                </span>
              </th>
              <th
                scope="col"
                className="sticky left-14 z-20 min-w-[260px] bg-theme-subtle/95 px-5 py-4 text-left backdrop-blur-sm"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-theme-muted">
                  Capability
                </span>
              </th>
              {ROLE_COLUMNS.map((role) => {
                const accent = roleAccentStyles[role];
                return (
                  <th
                    key={role}
                    scope="col"
                    className={`min-w-[132px] border-l border-theme-border/60 px-3 py-4 text-center ${accent.column}`}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-[12px] font-extrabold text-theme-fg">{roleLabels[role]}</span>
                      {role === 'OWNER' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                          <Lock className="h-3 w-3" />
                          Locked
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.id}>
                <tr className="bg-theme-subtle/40">
                  <td
                    colSpan={ROLE_COLUMNS.length + 2}
                    className="sticky left-0 z-10 border-y border-theme-border/70 px-5 py-3"
                  >
                    <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-theme-fg">
                      {group.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-theme-secondary">{group.description}</p>
                  </td>
                </tr>
                {group.keys.map((key, rowIndex) => {
                  serialNo += 1;
                  const Icon = permissionIcons[key];
                  const meta = permissionMeta[key];

                  return (
                    <tr
                      key={key}
                      className={`border-b border-theme-border/70 transition-colors hover:bg-theme-subtle/25 ${
                        rowIndex % 2 === 0 ? 'bg-theme-surface' : 'bg-theme-subtle/15'
                      }`}
                    >
                      <td className="sticky left-0 z-10 w-14 bg-inherit px-3 py-4 text-center tabular-nums text-[12px] font-semibold text-theme-muted">
                        {serialNo}
                      </td>
                      <td className="sticky left-14 z-10 bg-inherit px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-theme-border bg-theme-surface text-theme-secondary shadow-sm">
                            <Icon className="h-4 w-4" strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0 pt-0.5">
                            <p className="text-[13px] font-bold text-theme-fg">{meta.label}</p>
                            <p className="mt-0.5 text-[11px] leading-snug text-theme-secondary">
                              {meta.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      {ROLE_COLUMNS.map((role) => {
                        const checked = matrix[role][key];
                        const locked = role === 'OWNER' || !canManage;

                        return (
                          <td
                            key={role}
                            className={`border-l border-theme-border/50 px-3 py-4 text-center ${roleAccentStyles[role].column}`}
                          >
                            <PermissionToggle
                              checked={checked}
                              locked={locked}
                              label={`${meta.label} for ${roleLabels[role]}`}
                              onToggle={() => togglePermission(role, key)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && isDirty && (
        <div className="sticky bottom-0 z-30 border-t border-emerald-200/80 bg-emerald-50/95 px-4 py-3 backdrop-blur-md dark:border-emerald-500/25 dark:bg-emerald-950/90 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-200">
              You have unsaved permission changes
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <AppButton size="sm" variant="secondary" onClick={handleReset} disabled={saving}>
                Discard
              </AppButton>
              <AppButton
                size="sm"
                icon={<Check size={14} />}
                onClick={() => void handleSave()}
                loading={saving}
              >
                Save changes
              </AppButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
