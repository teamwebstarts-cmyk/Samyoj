import { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  MessageSquare,
  Phone,
  Timer,
  TrendingUp,
  UserCheck,
  X,
} from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import LoadingState from '../ui/LoadingState';
import StatCard from '../dashboard/StatCard';
import { teamApi } from '../../services/api';
import type { AgentMetrics, TeamMember } from '../../types';
import { toastError, toastSuccess } from '../../utils/toast';
import AvailabilityBadge, { RoleBadge } from './AvailabilityBadge';
import { formatJoinedDate, formatRelativeTime } from './teamUi';

interface AssignedConversation {
  id: string;
  status: string;
  lastMessageAt?: string | null;
  unreadCount: number;
  contact: { id: string; name?: string | null; phone: string };
}

interface TeamMemberDetailPanelProps {
  memberId: string | null;
  onClose: () => void;
  canManage: boolean;
  agents: { id: string; name: string }[];
  onUpdated: () => void;
}

export default function TeamMemberDetailPanel({
  memberId,
  onClose,
  canManage,
  agents,
  onUpdated,
}: TeamMemberDetailPanelProps) {
  const [member, setMember] = useState<TeamMember | null>(null);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [conversations, setConversations] = useState<AssignedConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [reassignTo, setReassignTo] = useState('');

  useEffect(() => {
    if (!memberId) {
      setMember(null);
      return;
    }
    setLoading(true);
    teamApi
      .get(memberId)
      .then(({ data }) => {
        setMember(data.data.member);
        setMetrics(data.data.metrics);
        setConversations(data.data.conversations);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [memberId]);

  const handleReassignAll = async () => {
    if (!memberId) return;
    try {
      await teamApi.reassign(memberId, reassignTo || null);
      toastSuccess('Conversations reassigned');
      onUpdated();
      onClose();
    } catch {
      toastError('Failed to reassign');
    }
  };

  if (!memberId) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-theme-border bg-theme-bg shadow-2xl animate-slide-in-right">
        <div className="flex items-start justify-between gap-3 border-b border-theme-border px-5 py-4">
          {loading || !member ? (
            <LoadingState label="Loading member..." />
          ) : (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <ContactAvatar name={member.name} phone={member.email} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold text-theme-fg">{member.name}</p>
                  <p className="truncate text-[12px] text-theme-secondary">{member.email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <RoleBadge role={member.orgRole} />
                    <AvailabilityBadge status={member.availability} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-theme-muted hover:bg-theme-subtle"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {!loading && member && metrics && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Open chats" value={metrics.openCount} icon={MessageSquare} accent="emerald" />
              <StatCard label="Resolved (7d)" value={metrics.closedLast7d} icon={UserCheck} accent="blue" />
              <StatCard label="Messages (7d)" value={metrics.messagesSentLast7d} icon={TrendingUp} accent="violet" />
              <StatCard
                label="Avg response"
                value={metrics.avgFirstResponseMinutes != null ? `${metrics.avgFirstResponseMinutes}m` : '—'}
                icon={Timer}
                accent="amber"
              />
              <StatCard label="Handoffs (7d)" value={metrics.handoffsLast7d} icon={ArrowRightLeft} accent="rose" />
              <StatCard label="Calls (7d)" value={metrics.callsHandledLast7d} icon={Phone} accent="slate" />
            </div>

            <div className="rounded-2xl border border-theme-border/70 bg-theme-subtle/30 p-4 space-y-2 text-[13px]">
              <Row label="Joined" value={formatJoinedDate(member.joinedAt)} />
              <Row label="Capacity" value={`${member.openCount ?? metrics.openCount} / ${member.maxConcurrentChats} chats`} />
              {member.department && (
                <Row
                  label="Department"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: member.department.color }} />
                      {member.department.name}
                    </span>
                  }
                />
              )}
              {member.lastActiveAt && (
                <Row label="Last active" value={formatRelativeTime(member.lastActiveAt)} />
              )}
            </div>

            <div>
              <h3 className="mb-3 text-[13px] font-extrabold text-theme-fg">
                Assigned conversations ({conversations.length})
              </h3>
              {conversations.length === 0 ? (
                <p className="text-[12px] text-theme-secondary">No assigned conversations</p>
              ) : (
                <div className="space-y-2">
                  {conversations.map((c) => (
                    <a
                      key={c.id}
                      href={`/inbox?conversation=${c.id}`}
                      className="flex items-center justify-between rounded-xl border border-theme-border/60 px-3 py-2.5 transition hover:border-whatsapp-500/30 hover:bg-whatsapp-500/5"
                    >
                      <div>
                        <p className="text-[13px] font-semibold text-theme-fg">
                          {c.contact.name || c.contact.phone}
                        </p>
                        <p className="text-[11px] capitalize text-theme-secondary">{c.status.toLowerCase()}</p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="rounded-full bg-whatsapp-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {canManage && member.orgRole !== 'OWNER' && conversations.length > 0 && (
              <div className="rounded-2xl border border-amber-200/60 bg-amber-500/5 p-4 space-y-3">
                <p className="text-[13px] font-bold text-theme-fg">Bulk reassign</p>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  className="w-full rounded-xl border border-theme-border bg-theme-bg px-3 py-2 text-[13px]"
                >
                  <option value="">Unassign all</option>
                  {agents.filter((a) => a.id !== memberId).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                <AppButton variant="secondary" size="sm" onClick={handleReassignAll}>
                  Reassign all conversations
                </AppButton>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-theme-secondary">{label}</span>
      <span className="font-semibold text-theme-fg">{value}</span>
    </div>
  );
}
