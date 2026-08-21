import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  ClipboardList,
  Headset,
  Mail,
  Settings2,
  Shield,
  Users,
} from 'lucide-react';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import TeamAuditTab from '../components/team/TeamAuditTab';
import TeamDepartmentsTab from '../components/team/TeamDepartmentsTab';
import TeamInvitesTab from '../components/team/TeamInvitesTab';
import TeamMembersTab from '../components/team/TeamMembersTab';
import TeamRolesTab from '../components/team/TeamRolesTab';
import TeamSettingsTab from '../components/team/TeamSettingsTab';
import { useAuth } from '../contexts/AuthContext';
import { teamApi } from '../services/api';
import type { TeamDepartment, TeamSummary } from '../types';

type TeamTab = 'members' | 'invites' | 'departments' | 'roles' | 'settings' | 'audit';

const tabMeta: Record<
  TeamTab,
  { label: string; shortLabel: string; icon: typeof Users; adminOnly?: boolean }
> = {
  members: { label: 'Members', shortLabel: 'Members', icon: Users },
  invites: { label: 'Invites', shortLabel: 'Invites', icon: Mail, adminOnly: true },
  departments: { label: 'Departments', shortLabel: 'Depts', icon: Building2 },
  roles: { label: 'Roles', shortLabel: 'Roles', icon: Shield, adminOnly: true },
  settings: { label: 'Settings', shortLabel: 'Settings', icon: Settings2, adminOnly: true },
  audit: { label: 'Audit log', shortLabel: 'Audit', icon: ClipboardList, adminOnly: true },
};

export default function TeamPage() {
  const { canManageTeam, orgRole } = useAuth();
  const [activeTab, setActiveTab] = useState<TeamTab>('members');
  const [departments, setDepartments] = useState<TeamDepartment[]>([]);
  const [summary, setSummary] = useState<TeamSummary>({
    total: 0,
    owners: 0,
    admins: 0,
    supervisors: 0,
    agents: 0,
    online: 0,
  });

  const loadDepartments = useCallback(() => {
    teamApi.departments
      .list()
      .then(({ data }) => setDepartments(data.data.departments))
      .catch(console.error);
  }, []);

  const loadSummary = useCallback(() => {
    teamApi
      .list()
      .then(({ data }) => setSummary(data.data.summary))
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadDepartments();
    loadSummary();
  }, [loadDepartments, loadSummary]);

  const visibleTabIds = useMemo(
    () =>
      (Object.keys(tabMeta) as TeamTab[]).filter((id) => !tabMeta[id].adminOnly || canManageTeam),
    [canManageTeam],
  );

  const tabOptions = visibleTabIds.map((id) => ({
    value: id,
    label: tabMeta[id].label,
    shortLabel: tabMeta[id].shortLabel,
    icon: tabMeta[id].icon,
  }));

  const heroStats = useMemo(
    () => [
      { label: 'Members', value: summary.total },
      {
        label: 'Online',
        value: summary.online,
        tone: 'text-emerald-700 dark:text-emerald-300',
      },
      { label: 'Departments', value: departments.length },
      {
        label: 'Roles',
        value: summary.owners + summary.admins + summary.supervisors + summary.agents > 0 ? 4 : 0,
        tone: 'text-violet-700 dark:text-violet-300',
      },
    ],
    [summary, departments],
  );

  return (
    <PageShell>
      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Team"
          badgeIcon={Headset}
          title="Team management"
          description="Invite agents, assign roles, and organize departments."
          accent="emerald"
          stats={heroStats}
        />

        <SegmentedControl
          embedded
          value={activeTab}
          onChange={setActiveTab}
          options={tabOptions}
          ariaLabel="Team sections"
        />

        <div className="space-y-4">
          {activeTab === 'members' && (
            <TeamMembersTab
              canManage={canManageTeam}
              orgRole={orgRole}
              departments={departments}
              onSummaryChange={setSummary}
            />
          )}
          {activeTab === 'invites' && canManageTeam && (
            <TeamInvitesTab departments={departments} canManage={canManageTeam} />
          )}
          {activeTab === 'departments' && (
            <TeamDepartmentsTab canManage={canManageTeam} onChanged={loadDepartments} />
          )}
          {activeTab === 'roles' && canManageTeam && <TeamRolesTab canManage={canManageTeam} />}
          {activeTab === 'settings' && canManageTeam && (
            <TeamSettingsTab canManage={canManageTeam} />
          )}
          {activeTab === 'audit' && canManageTeam && <TeamAuditTab />}
        </div>
      </div>
    </PageShell>
  );
}
