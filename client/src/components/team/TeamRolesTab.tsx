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
import InfoTip from '../ui/InfoTip';
import { FormPageSkeleton } from '../ui/ListLayoutSkeleton';
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
  roleInfo,
  roleLabels,
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

function RoleInfoTooltipContent({ role }: { role: OrgRole }) {
  const info = roleInfo[role];
  return (
    <span className="block space-y-2">
      <span className="block font-bold text-slate-900">{info.tagline}</span>
      <span className="block text-slate-700">{info.description}</span>
      <span className="block space-y-1">
        {info.responsibilities.map((item) => (
          <span key={item} className="block text-slate-600">
            · {item}
          </span>
        ))}
      </span>
    </span>
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
      toastSuccess('Role access saved');
    } catch {
      toastError('Failed to save role access');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!savedMatrix) return;
    setMatrix(cloneMatrix(savedMatrix));
  };

  if (loading || !matrix) {
    return <FormPageSkeleton label="Loading roles and permissions" blocks={5} />;
  }

  const permissionTotal = PERMISSION_KEYS.length;

  return (
    <div className="inbox-shell overflow-hidden">
      <div className="border-b border-theme-border bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-violet-500/[0.05] px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              Access control
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold tracking-tight text-theme-fg sm:text-xl">
                Roles & responsibilities
              </h3>
              <InfoTip
                label="About roles and access"
                content="You decide what Admin, Supervisor, and Agent can access. Owner always has full access — use the toggles below for everyone else."
              />
            </div>
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

        <div className="mt-5 grid grid-cols-2 gap-4">
          {ROLE_COLUMNS.map((role) => {
            const accent = roleAccentStyles[role];
            const Icon = roleIcons[role];
            const info = roleInfo[role];
            const enabled = countEnabled(matrix, role);
            const pct = Math.round((enabled / permissionTotal) * 100);

            return (
              <div
                key={role}
                className={`flex min-h-[168px] flex-col justify-between rounded-2xl border bg-theme-surface/90 p-4 sm:min-h-[188px] sm:p-5 ${accent.border}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${accent.bg}`}
                    >
                      <Icon className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${accent.icon}`} strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-bold text-theme-fg sm:text-[15px]">{roleLabels[role]}</p>
                        <InfoTip
                          label={`About ${roleLabels[role]}`}
                          content={<RoleInfoTooltipContent role={role} />}
                        />
                      </div>
                      <p className="mt-0.5 text-[11px] font-semibold text-theme-muted sm:text-[12px]">
                        {info.tagline}
                      </p>
                    </div>
                  </div>
                  <RoleBadge role={role} />
                </div>

                {role === 'OWNER' ? (
                  <p className="text-[11px] font-semibold text-violet-600 dark:text-violet-300 sm:text-[12px]">
                    Full access · always on
                  </p>
                ) : (
                  <p className="text-[11px] text-theme-muted sm:text-[12px]">You control access below</p>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-theme-muted sm:text-[12px]">
                      {enabled}/{permissionTotal} enabled
                    </span>
                    <span className="text-[11px] font-bold tabular-nums text-theme-fg sm:text-[12px]">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        role === 'OWNER'
                          ? 'bg-violet-500'
                          : role === 'ADMIN'
                            ? 'bg-sky-500'
                            : role === 'SUPERVISOR'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-b border-theme-border px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[13px] font-bold text-theme-fg">Feature access</h4>
          <InfoTip
            label="How feature access works"
            content="Each toggle is enforced on the server. Off = that role gets 403 on the matching APIs (Inbox, Campaigns, Templates, etc.). Owner always has full access. Sidebar visibility may still show links until the next session — API calls will be blocked."
          />
        </div>
        <p className="mt-0.5 text-[11px] text-theme-secondary">
          Turn each area on or off per role. Changes apply to every member on that role.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-theme-border bg-theme-subtle/60">
              <th
                scope="col"
                className="min-w-[200px] px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted"
              >
                Feature
              </th>
              {ROLE_COLUMNS.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className={`min-w-[100px] border-l border-theme-border/60 px-3 py-3.5 text-center ${roleAccentStyles[role].column}`}
                >
                  <span className="text-[12px] font-extrabold text-theme-fg">{roleLabels[role]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <Fragment key={group.id}>
                <tr className="bg-theme-subtle/40">
                  <td
                    colSpan={ROLE_COLUMNS.length + 1}
                    className="border-y border-theme-border/70 px-5 py-2.5"
                  >
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-theme-fg">
                      {group.label}
                    </p>
                  </td>
                </tr>
                {group.keys.map((key, rowIndex) => {
                  const Icon = permissionIcons[key];
                  const meta = permissionMeta[key];

                  return (
                    <tr
                      key={key}
                      className={`border-b border-theme-border/70 transition-colors hover:bg-theme-subtle/25 ${
                        rowIndex % 2 === 0 ? 'bg-theme-surface' : 'bg-theme-subtle/15'
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-theme-border bg-theme-surface text-theme-secondary">
                            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-[13px] font-bold text-theme-fg">{meta.label}</p>
                              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                Live
                              </span>
                              <InfoTip
                                content={
                                  <span className="block space-y-1.5">
                                    <span className="block">{meta.description}</span>
                                    <span className="block text-[10px] font-semibold text-slate-600">
                                      Applies to: {meta.mapsTo}
                                    </span>
                                  </span>
                                }
                                label={meta.label}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      {ROLE_COLUMNS.map((role) => {
                        const checked = matrix[role][key];
                        const locked = role === 'OWNER' || !canManage;

                        return (
                          <td
                            key={role}
                            className={`border-l border-theme-border/50 px-3 py-3.5 text-center ${roleAccentStyles[role].column}`}
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
              You have unsaved access changes
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
