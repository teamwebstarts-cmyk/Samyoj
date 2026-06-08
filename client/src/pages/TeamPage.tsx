import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  ClipboardList,
  Headset,
  Mail,
  Settings2,
  Shield,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SegmentedControl from '../components/ui/SegmentedControl';
import TeamAuditTab from '../components/team/TeamAuditTab';
import TeamDepartmentsTab from '../components/team/TeamDepartmentsTab';
import TeamInvitesTab from '../components/team/TeamInvitesTab';
import TeamMembersTab from '../components/team/TeamMembersTab';
import TeamSecurityPanel from '../components/team/TeamSecurityPanel';
import TeamSettingsTab from '../components/team/TeamSettingsTab';
import { useAuth } from '../contexts/AuthContext';
import { teamApi } from '../services/api';
import type { AgentAvailability, TeamDepartment, TeamSummary } from '../types';

type TeamTab = 'members' | 'invites' | 'departments' | 'settings' | 'audit' | 'security';

const tabs: { id: TeamTab; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'invites', label: 'Invites', icon: Mail, adminOnly: true },
  { id: 'departments', label: 'Departments', icon: Building2 },
  { id: 'settings', label: 'Rules', icon: Settings2, adminOnly: true },
  { id: 'audit', label: 'Activity', icon: ClipboardList, adminOnly: true },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function TeamPage() {
  const { canManageTeam, orgRole, availability, setAvailability } = useAuth();
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

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const visibleTabs = tabs.filter((t) => !t.adminOnly || canManageTeam);

  const availabilityOptions: { value: AgentAvailability; label: string }[] = [
    { value: 'ONLINE', label: 'Online' },
    { value: 'AWAY', label: 'Away' },
    { value: 'OFFLINE', label: 'Offline' },
  ];

  return (
    <PageShell>
      <PageHeader
        actions={
          availability ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-[12px] font-medium text-theme-secondary sm:inline">
                Your status
              </span>
              <SegmentedControl
                value={availability}
                options={availabilityOptions}
                onChange={(v) => setAvailability(v as AgentAvailability)}
              />
            </div>
          ) : undefined
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Team"
          badgeIcon={Headset}
          title="Workforce hub"
          description="Manage agents, invites, departments, assignment rules, and security — all in one place."
          accent="emerald"
          stats={[
            { label: 'Members', value: summary.total },
            { label: 'Online now', value: summary.online, tone: 'text-emerald-700' },
            { label: 'Agents', value: summary.agents, tone: 'text-sky-700' },
          ]}
        />

        <div className="flex flex-wrap gap-2 border-b border-theme-border/60 pb-1">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-bold transition ${
                activeTab === id
                  ? 'bg-whatsapp-500/10 text-whatsapp-700 ring-1 ring-whatsapp-500/25 dark:text-whatsapp-300'
                  : 'text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

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
        {activeTab === 'settings' && canManageTeam && (
          <TeamSettingsTab canManage={canManageTeam} />
        )}
        {activeTab === 'audit' && canManageTeam && <TeamAuditTab />}
        {activeTab === 'security' && <TeamSecurityPanel />}
      </div>
    </PageShell>
  );
}
