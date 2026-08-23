import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Calendar,
  MessageSquare,
  Phone,
  Send,
  Shield,
  Target,
  User,
} from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import LoadingState from '../ui/LoadingState';
import SegmentedControl from '../ui/SegmentedControl';
import SlideOver from '../ui/SlideOver';
import StatusBadge from '../ui/StatusBadge';
import { leadStageLabel } from '../leads/leadUi';
import { ModalPanel } from '../ui/modalUi';
import { contactApi, leadApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { messagingConsent } from '../../utils/plainLanguage';
import { toastError, toastSuccess } from '../../utils/toast';
import {
  formatContactPhone,
  formatContactRelativeTime,
} from '../../utils/contactUtils';
import { beginOutboundDialing } from '../../utils/outboundLiveCallStore';
import type { Contact, ContactDetail } from '../../types';
import { contactGetsCampaignMessages, getContactConsentDisplay } from '../../utils/contactConsent';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import {
  ContactConversationBadge,
  ContactOptInBadge,
  ContactSourceBadge,
  ContactTagBadge,
} from './contactUi';

type DetailTab = 'overview' | 'activity' | 'conversations' | 'timeline';

interface ContactDetailPanelProps {
  contact: Contact | null;
  open: boolean;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onUpdated: () => void;
  onLeadCreated?: () => void;
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

const detailTabs = [
  { value: 'overview', label: 'Overview', shortLabel: 'Overview', icon: User },
  { value: 'timeline', label: 'Timeline', shortLabel: 'Timeline', icon: Calendar },
  { value: 'activity', label: 'Activity', shortLabel: 'Activity', icon: Activity },
  { value: 'conversations', label: 'Chats', shortLabel: 'Chats', icon: MessageSquare },
] as const;

export default function ContactDetailPanel({
  contact,
  open,
  onClose,
  onEdit,
  onUpdated,
  onLeadCreated,
}: ContactDetailPanelProps) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [togglingOptIn, setTogglingOptIn] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);
  const [timeline, setTimeline] = useState<Array<{ id: string; type: string; title: string; detail?: string; at: string }>>([]);
  const { activeNumber, resolved } = useWhatsAppNumber();
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);

  useEffect(() => {
    if (!open || !contact?.id) {
      requestGenerationRef.current += 1;
      setDetail(null);
      setTab('overview');
      setTimeline([]);
      return;
    }

    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    Promise.all([
      contactApi.detail(contact.id),
      contactApi.timeline(contact.id).catch(() => null),
    ])
      .then(([detailRes, timelineRes]) => {
        if (
          requestNumberId !== activeNumberIdRef.current ||
          generation !== requestGenerationRef.current
        ) return;
        setDetail(detailRes.data.data as ContactDetail);
        if (timelineRes?.data?.data?.timeline) {
          setTimeline(timelineRes.data.data.timeline);
        }
      })
      .catch(() => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          setDetail(null);
        }
      })
      .finally(() => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          setLoading(false);
        }
      });
  }, [activeNumber, contact?.id, open, resolved]);

  const current = detail?.contact || contact;
  const primaryConversationId = detail?.conversations?.[0]?.id;
  const getsCampaignMessages = current ? contactGetsCampaignMessages(current) : false;
  const consentDisplay = getContactConsentDisplay(current);
  const consentHint =
    consentDisplay === 'eligible'
      ? 'Included in WhatsApp campaign audiences.'
      : consentDisplay === 'stopped'
        ? 'Opted out of marketing messages. You can still chat in Inbox.'
        : 'Not on campaign lists yet. Use Allow messages below to add them.';

  if (!current) return null;

  const handleToggleOptIn = async () => {
    if (!current.id) return;
    setTogglingOptIn(true);
    try {
      await contactApi.update(current.id, { optedIn: !getsCampaignMessages });
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

  const startNewChat = () => {
    onClose();
    const phone = encodeURIComponent(current.phone);
    const name = encodeURIComponent(current.name || '');
    navigate(`/inbox?new=true&phone=${phone}&name=${name}`);
  };

  const handleCall = () => {
    if (!current?.phone) return;
    beginOutboundDialing({
      phone: current.phone,
      contactName: current.name || undefined,
      conversationId: primaryConversationId,
    });
    onClose();
  };

  const openCampaign = () => {
    onClose();
    navigate(`/campaigns?contacts=${current.id}`);
  };

  const handleConvertToLead = async () => {
    if (!current.id) return;
    setConvertingLead(true);
    try {
      const { data } = await leadApi.fromContact(current.id);
      const payload = data.data as { created?: boolean };
      toastSuccess(
        payload?.created === false
          ? 'This contact is already in the pipeline'
          : 'Lead added — opening pipeline'
      );
      onLeadCreated?.();
      onClose();
    } catch (err: unknown) {
      toastError(getErrorMessage(err, 'Could not create lead'));
    } finally {
      setConvertingLead(false);
    }
  };

  const openPipeline = () => {
    onClose();
    onLeadCreated?.();
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={current.name || 'Unnamed contact'}
      subtitle={formatContactPhone(current.phone)}
      size="lg"
      icon={User}
      accent="sky"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <AppButton variant="secondary" size="sm" onClick={onClose} className="flex-1 sm:flex-none">
            Close
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            icon={<Phone size={14} />}
            onClick={handleCall}
            className="flex-1 sm:flex-none"
          >
            Call
          </AppButton>
          {primaryConversationId ? (
            <AppButton
              size="sm"
              icon={<MessageSquare size={14} />}
              onClick={() => openConversation(primaryConversationId)}
              className="flex-1 sm:flex-none"
            >
              Open chat
            </AppButton>
          ) : (
            <AppButton
              size="sm"
              icon={<MessageSquare size={14} />}
              onClick={startNewChat}
              className="flex-1 sm:flex-none"
            >
              Start chat
            </AppButton>
          )}
        </div>
      }
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
                  <ContactOptInBadge contact={current} showInfo />
                  {current.conversation?.status && (
                    <ContactConversationBadge status={current.conversation.status} />
                  )}
                  {current.callingAiEnabled === false && (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-600 ring-1 ring-inset ring-neutral-200/70 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700/50">
                      Calls · person only
                    </span>
                  )}
                  {detail?.lead && (
                    <StatusBadge
                      status={detail.lead.stage}
                      label={`Pipeline · ${leadStageLabel(detail.lead.stage)}`}
                    />
                  )}
                </div>

                <p className="text-[11px] font-medium leading-relaxed text-theme-muted">{consentHint}</p>

                {current.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {current.tags.map((tag) => (
                      <ContactTagBadge key={tag} tag={tag} />
                    ))}
                  </div>
                )}

                {current.notes && (
                  <p className="text-[12px] font-medium leading-relaxed text-theme-secondary">
                    {current.notes}
                  </p>
                )}
              </div>
            </div>
          </div>

          <ModalPanel title="Quick actions" accent="sky">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <AppButton size="sm" variant="secondary" icon={<Phone size={14} />} onClick={handleCall}>
                Call
              </AppButton>
              <AppButton size="sm" variant="secondary" icon={<Send size={14} />} onClick={openCampaign}>
                Campaign
              </AppButton>
              <AppButton
                size="sm"
                variant="secondary"
                icon={<Target size={14} />}
                onClick={() => (detail?.lead ? openPipeline() : void handleConvertToLead())}
                loading={convertingLead}
              >
                {detail?.lead ? 'Pipeline' : 'Convert'}
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
                className="col-span-2 sm:col-span-4"
              >
                {getsCampaignMessages ? messagingConsent.stopMessages : messagingConsent.allowMessages}
              </AppButton>
            </div>
          </ModalPanel>

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

          <SegmentedControl
            embedded
            value={tab}
            onChange={(v) => setTab(v as DetailTab)}
            options={detailTabs as unknown as Array<{ value: DetailTab; label: string; shortLabel?: string; icon?: typeof User }>}
            ariaLabel="Contact profile sections"
          />

          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-theme-border bg-theme-surface p-4">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted">
                  Contact details
                </h4>
                <dl className="mt-3 space-y-2.5">
                  {[
                    { label: 'Phone', value: formatContactPhone(current.phone) },
                    { label: 'Email', value: current.email || '—' },
                    {
                      label: 'Pipeline',
                      value: detail?.lead
                        ? leadStageLabel(detail.lead.stage)
                        : 'Not a lead',
                    },
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
                      <dt className="text-[12px] font-medium text-theme-muted">{row.label}</dt>
                      <dd className="text-right text-[12px] font-semibold text-theme-fg">{row.value}</dd>
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
                          <p className="text-[13px] font-bold text-theme-fg">{item.title}</p>
                          <span className="shrink-0 text-[10px] font-semibold text-theme-muted">
                            {formatContactRelativeTime(item.at)}
                          </span>
                        </div>
                        {item.subtitle && (
                          <p className="mt-0.5 truncate text-[12px] text-theme-secondary">
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

          {tab === 'timeline' && (
            <div className="space-y-2">
              {!timeline.length ? (
                <div className="rounded-2xl border border-dashed border-theme-border px-4 py-10 text-center">
                  <p className="text-[13px] font-semibold text-theme-secondary">No timeline events</p>
                </div>
              ) : (
                timeline.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-theme-border bg-theme-surface px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-theme-fg">{entry.title}</p>
                      <span className="text-[10px] font-medium uppercase text-theme-muted">
                        {entry.type}
                      </span>
                    </div>
                    {entry.detail && (
                      <p className="mt-1 text-[12px] text-theme-secondary">{entry.detail}</p>
                    )}
                    <p className="mt-1 text-[11px] text-theme-muted">
                      {formatContactRelativeTime(entry.at)}
                    </p>
                  </div>
                ))
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
                      <p className="mt-1 text-[12px] text-theme-secondary">
                        {conv.assignedAgent?.name || 'Unassigned'} ·{' '}
                        {formatContactRelativeTime(conv.lastMessageAt)}
                      </p>
                    </div>
                    <Calendar className="h-4 w-4 shrink-0 text-theme-muted" />
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
