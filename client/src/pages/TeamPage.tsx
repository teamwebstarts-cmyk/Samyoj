import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Headset, Mail, Shield, Users } from 'lucide-react';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import TeamDepartmentsTab from '../components/team/TeamDepartmentsTab';
import TeamInvitesTab from '../components/team/TeamInvitesTab';
import TeamMembersTab from '../components/team/TeamMembersTab';
import TeamRolesTab from '../components/team/TeamRolesTab';
import { useAuth } from '../contexts/AuthContext';
import { teamApi } from '../services/api';
import type { TeamDepartment, TeamSummary } from '../types';

type TeamTab = 'members' | 'invites' | 'departments' | 'roles';

const tabMeta: Record<
  TeamTab,
  { label: string; shortLabel: string; icon: typeof Users; adminOnly?: boolean }
> = {
  members: { label: 'Members', shortLabel: 'Members', icon: Users },
  invites: { label: 'Invites', shortLabel: 'Invites', icon: Mail, adminOnly: true },
  departments: { label: 'Departments', shortLabel: 'Depts', icon: Building2 },
  roles: { label: 'Roles', shortLabel: 'Roles', icon: Shield, adminOnly: true },
};

const heroCopy: Record<TeamTab, { title: string; description: string }> = {
  members: {
    title: 'Team members',
    description: 'View agents, roles, and availability.',
  },
  invites: {
    title: 'Pending invites',
    description: 'Send secure email links for teammates to join your workspace.',
  },
  departments: {
    title: 'Departments',
    description: 'Group agents into teams for routing and filters.',
  },
  roles: {
    title: 'Roles & responsibilities',
    description: 'Configure permissions for each role in your workspace.',
  },
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

  const copy = heroCopy[activeTab];

  return (
    <PageShell>
      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Team"
          badgeIcon={Headset}
          title={copy.title}
          description={copy.description}
          accent="emerald"
          stats={[
            { label: 'Members', value: summary.total },
            {
              label: 'Online',
              value: summary.online,
              tone: 'text-emerald-700 dark:text-emerald-300',
            },
            {
              label: 'Agents',
              value: summary.agents,
              tone: 'text-sky-700 dark:text-sky-300',
            },
          ]}
        />

        <SegmentedControl
          embedded
          value={activeTab}
          onChange={setActiveTab}
          options={tabOptions}
          ariaLabel="Team sections"
        />

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
        {activeTab === 'roles' && canManageTeam && (
          <TeamRolesTab canManage={canManageTeam} />
        )}
      </div>
    </PageShell>
  );
}
