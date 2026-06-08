import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  MessageSquare,
  Phone,
  Send,
  Shield,
  User,
} from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import LoadingState from '../ui/LoadingState';
import SlideOver from '../ui/SlideOver';
import { contactApi } from '../../services/api';
import {
  formatContactPhone,
  formatContactRelativeTime,
} from '../../utils/contactUtils';
import type { Contact, ContactDetail } from '../../types';
import {
  ContactConversationBadge,
  ContactOptInBadge,
  ContactSourceBadge,
  ContactTagBadge,
} from './contactUi';

type DetailTab = 'overview' | 'activity' | 'conversations';

interface ContactDetailPanelProps {
  contact: Contact | null;
  open: boolean;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onUpdated: () => void;
}

const activityIcons = {
  message: MessageSquare,
  call: Phone,
  campaign: Send,
};

const conversationStatusTone: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-800 ring-emerald-200/60 dark:bg-emerald-900/40 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-800 ring-amber-200/60 dark:bg-amber-900/40 dark:text-amber-300',
  CLOSED: 'bg-neutral-100 text-neutral-600 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-300',
};

export default function ContactDetailPanel({
  contact,
  open,
  onClose,
  onEdit,
  onUpdated,
}: ContactDetailPanelProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [togglingOptIn, setTogglingOptIn] = useState(false);

  useEffect(() => {
    if (!open || !contact?.id) {
      setDetail(null);
      setTab('overview');
      return;
    }

    setLoading(true);
    contactApi
      .detail(contact.id)
      .then(({ data }) => setDetail(data.data as ContactDetail))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [open, contact?.id]);

  const current = detail?.contact || contact;
  if (!current) return null;

  const handleToggleOptIn = async () => {
    if (!current.id) return;
    setTogglingOptIn(true);
    try {
      await contactApi.update(current.id, { optedIn: !current.optedIn });
      onUpdated();
      const { data } = await contactApi.detail(current.id);
      setDetail(data.data as ContactDetail);
    } finally {
      setTogglingOptIn(false);
    }
  };

  const openConversation = (conversationId: string) => {
    onClose();
    navigate(`/inbox?conversation=${conversationId}`);
  };

  const openCampaign = () => {
    onClose();
    navigate(`/campaigns?contacts=${current.id}`);
  };

  const tabs: { id: DetailTab; label: string; icon: typeof Activity }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'conversations', label: 'Chats', icon: MessageSquare },
  ];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={current.name || 'Unnamed contact'}
      subtitle={formatContactPhone(current.phone)}
      size="xl"
      icon={User}
      accent="sky"
    >
      {loading ? (
        <LoadingState label="Loading contact profile..." />
      ) : (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/40 p-5 dark:border-sky-800/40 dark:from-sky-950/25 dark:via-theme-surface dark:to-indigo-950/15">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sky-400/10 blur-2xl" />
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <ContactAvatar
                name={current.name}
                phone={current.phone}
                size="lg"
                active={Boolean(detail?.conversations.length)}
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <ContactSourceBadge source={current.source} />
                  <ContactOptInBadge optedIn={current.optedIn} />
                  {current.conversation?.status && (
                    <ContactConversationBadge status={current.conversation.status} />
                  )}
                </div>

                {current.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {current.tags.map((tag) => (
                      <ContactTagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                )}

                {current.notes && (
                  <p className="text-[12px] font-medium leading-relaxed text-neutral-600 dark:text-slate-400">
                    {current.notes}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {detail?.conversations[0] && (
                    <AppButton
                      size="sm"
                      icon={<MessageSquare size={14} />}
                      onClick={() => openConversation(detail.conversations[0].id)}
                    >
                      Open chat
                    </AppButton>
                  )}
                  <AppButton size="sm" variant="secondary" icon={<Send size={14} />} onClick={openCampaign}>
                    Add to campaign
                  </AppButton>
                  <AppButton size="sm" variant="secondary" onClick={() => onEdit(current)}>
                    Edit
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="secondary"
                    icon={<Shield size={14} />}
                    onClick={handleToggleOptIn}
                    loading={togglingOptIn}
                  >
                    {current.optedIn ? 'Opt out' : 'Opt in'}
                  </AppButton>
                </div>
              </div>
            </div>
          </div>

          {detail && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: 'Messages', value: detail.stats.totalMessages, tone: 'text-sky-700 dark:text-sky-300', bg: 'from-sky-500/8 to-blue-500/4' },
                { label: 'Calls', value: detail.stats.totalCalls, tone: 'text-violet-700 dark:text-violet-300', bg: 'from-violet-500/8 to-purple-500/4' },
                { label: 'Campaigns', value: detail.stats.campaignsReceived, tone: 'text-emerald-700 dark:text-emerald-300', bg: 'from-emerald-500/8 to-teal-500/4' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`rounded-2xl border border-theme-border bg-gradient-to-br ${stat.bg} px-3 py-3.5 text-center`}
                >
                  <p className={`text-xl font-extrabold tabular-nums ${stat.tone}`}>
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="dashboard-card p-1.5">
            <div className="flex gap-1 rounded-xl bg-theme-subtle p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-[12px] font-bold transition ${
                  tab === id
                    ? 'bg-theme-surface text-sky-700 shadow-sm ring-1 ring-sky-500/20 dark:text-sky-300'
                    : 'text-theme-secondary hover:text-theme-fg'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
            </div>
          </div>

          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-theme-border bg-theme-surface p-4">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500 dark:text-slate-400">
                  Contact details
                </h4>
                <dl className="mt-3 space-y-2.5">
                  {[
                    { label: 'Phone', value: formatContactPhone(current.phone) },
                    { label: 'Email', value: current.email || '—' },
                    {
                      label: 'Last active',
                      value: formatContactRelativeTime(
                        detail?.conversations[0]?.lastMessageAt || current.lastActiveAt
                      ),
                    },
                    {
                      label: 'Assigned agent',
                      value: current.conversation?.assignedAgent?.name || 'Unassigned',
                    },
                    {
                      label: 'Added',
                      value: current.createdAt
                        ? new Date(current.createdAt).toLocaleDateString()
                        : '—',
                    },
                  ].map((row) => (
                    <div key={row.label} className="flex items-start justify-between gap-4">
                      <dt className="text-[12px] font-medium text-neutral-500 dark:text-slate-400">
                        {row.label}
                      </dt>
                      <dd className="text-right text-[12px] font-semibold text-neutral-900 dark:text-slate-100">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-2">
              {!detail?.activity.length ? (
                <div className="rounded-2xl border border-dashed border-theme-border px-4 py-10 text-center">
                  <p className="text-[13px] font-semibold text-theme-secondary">No activity yet</p>
                  <p className="mt-1 text-[12px] text-theme-muted">
                    Messages, calls, and campaigns will appear here.
                  </p>
                </div>
              ) : (
                detail.activity.map((item) => {
                  const Icon = activityIcons[item.type];
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-start gap-3 rounded-2xl border border-theme-border bg-theme-surface p-3"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-subtle text-theme-secondary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-bold text-neutral-900 dark:text-slate-100">
                            {item.title}
                          </p>
                          <span className="shrink-0 text-[10px] font-semibold text-neutral-400">
                            {formatContactRelativeTime(item.at)}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="mt-0.5 truncate text-[12px] text-neutral-500 dark:text-slate-400">
                            {item.subtitle}
                          </p>
                        )}
                        {item.type === 'message' &&
                          typeof item.meta?.conversationId === 'string' && (
                          <button
                            type="button"
                            onClick={() => openConversation(item.meta!.conversationId as string)}
                            className="mt-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                          >
                            View in inbox →
                          </button>
                        )}
                        {item.type === 'call' && typeof item.meta?.callId === 'string' && (
                          <a
                            href={`/calls/${item.meta.callId}`}
                            className="mt-1 inline-block text-[11px] font-bold text-violet-600 hover:text-violet-700 dark:text-violet-400"
                          >
                            View in calls →
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'conversations' && (
            <div className="space-y-2">
              {!detail?.conversations.length ? (
                <div className="rounded-2xl border border-dashed border-theme-border px-4 py-10 text-center">
                  <p className="text-[13px] font-semibold text-theme-secondary">No conversations</p>
                  <p className="mt-1 text-[12px] text-theme-muted">
                    Start a chat from inbox to engage this contact.
                  </p>
                </div>
              ) : (
                detail.conversations.map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => openConversation(conv.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-theme-border bg-theme-surface p-3 text-left transition hover:border-sky-200 hover:bg-sky-50/50 dark:hover:border-sky-800/50 dark:hover:bg-sky-950/20"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${
                            conversationStatusTone[conv.status] || conversationStatusTone.CLOSED
                          }`}
                        >
                          {conv.status}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[12px] text-neutral-500 dark:text-slate-400">
                        {conv.assignedAgent?.name || 'Unassigned'} ·{' '}
                        {formatContactRelativeTime(conv.lastMessageAt)}
                      </p>
                    </div>
                    <Calendar className="h-4 w-4 shrink-0 text-neutral-300" />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </SlideOver>
  );
}
