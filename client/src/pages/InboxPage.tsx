import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Bot, MessageSquare, MessageSquarePlus, Phone } from 'lucide-react';
import ChatComposer, { type PendingAttachment } from '../components/inbox/ChatComposer';
import TemplateComposer from '../components/inbox/TemplateComposer';
import MediaViewer, { type MediaViewerItem } from '../components/inbox/MediaViewer';
import ChatContextMenu from '../components/inbox/ChatContextMenu';
import ChatPlaceholder from '../components/inbox/ChatPlaceholder';
import ContactAvatar from '../components/inbox/ContactAvatar';
import ConversationItem from '../components/inbox/ConversationItem';
import ConversationListSkeleton from '../components/inbox/ConversationListSkeleton';
import MessageBubble, { DateDivider } from '../components/inbox/MessageBubble';
import NewChatSlideOver from '../components/inbox/NewChatSlideOver';
import ServiceWindowBanner, { ServiceWindowBadge } from '../components/inbox/ServiceWindowBanner';
import {
  formatDateDivider,
  getServiceWindowInfo,
  groupMessagesByDate,
  messageHasMedia,
} from '../components/inbox/inboxUtils';
import EmptyState from '../components/ui/EmptyState';
import AppSelect from '../components/ui/AppSelect';
import InboxSelect, { type InboxSelectOption } from '../components/inbox/InboxSelect';
import Pagination from '../components/ui/Pagination';
import PageShell from '../components/ui/PageShell';
import SearchInput from '../components/ui/SearchInput';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import api, { aiBotApi, callingApi, inboxApi, teamApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';
import type { AiBot, Conversation, Message, ServiceWindowInfo, TeamAgent } from '../types';

const CLOSED_WINDOW: ServiceWindowInfo = {
  open: false,
  lastInboundAt: null,
  expiresAt: null,
};

const statusFilterOptions: InboxSelectOption[] = [
  { value: '', label: 'All chats' },
  { value: 'OPEN', label: 'Open', dotColor: '#22c55e' },
  { value: 'PENDING', label: 'Pending', dotColor: '#f59e0b' },
  { value: 'CLOSED', label: 'Closed', dotColor: '#94a3b8' },
];

export default function InboxPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [serviceWindow, setServiceWindow] = useState<ServiceWindowInfo>(CLOSED_WINDOW);
  const [newMessage, setNewMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [botToggling, setBotToggling] = useState(false);
  const [callingBack, setCallingBack] = useState(false);
  const [aiBots, setAiBots] = useState<AiBot[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [templateMode, setTemplateMode] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerItem | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    conversationId: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    teamApi
      .agents()
      .then(({ data }) => setAgents(data.data.agents))
      .catch(console.error);
    aiBotApi
      .list()
      .then(({ data }) => setAiBots(data.data.bots.filter((b: AiBot) => b.enabled)))
      .catch(console.error);
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page),
        limit: String(DEFAULT_PAGE_SIZE),
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (agentFilter === '__mine__' && user?.id) {
        params.assignedTo = user.id;
      } else if (agentFilter && agentFilter !== '__mine__') {
        params.assignedTo = agentFilter;
      }

      const { data } = await inboxApi.list(params);
      setConversations(data.data.conversations);
      setTotal(data.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, agentFilter, page, user?.id]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, agentFilter]);

  useEffect(() => {
    setTemplateMode(false);
  }, [selected?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = async (conversationId: string) => {
    const { data } = await inboxApi.messages(conversationId);
    setMessages(data.data.messages);
    setServiceWindow(data.data.serviceWindow ?? CLOSED_WINDOW);
  };

  const selectConversation = async (conv: Conversation) => {
    setSelected(conv);
    setNewMessage('');
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setMediaViewer((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setServiceWindow(CLOSED_WINDOW);
    await loadMessages(conv.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (!conversationId) return;

    let cancelled = false;

    inboxApi
      .get(conversationId)
      .then(async ({ data }) => {
        if (cancelled) return;
        const conv = data.data as Conversation;
        setConversations((prev) => {
          if (prev.some((c) => c.id === conv.id)) return prev;
          return [conv, ...prev];
        });
        await selectConversation(conv);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setSearchParams({}, { replace: true });
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams, setSearchParams]);

  const handleSocketEvent = useCallback(
    (event: string, data: unknown) => {
      const payload = data as {
        conversationId: string;
        message?: Message;
        messageId?: string;
        status?: string;
      };

      if (event === 'message:new') {
        loadConversations();
        if (selected?.id === payload.conversationId && payload.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.message!.id)) return prev;
            return [...prev, payload.message!];
          });
          if (payload.message.direction === 'INBOUND') {
            setServiceWindow(getServiceWindowInfo(payload.message.createdAt));
          }
        }
      }

      if (event === 'message:status' && selected?.id === payload.conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === payload.messageId ? { ...m, status: payload.status || m.status } : m
          )
        );
      }

      if (event === 'conversation:assigned') {
        const assignedPayload = data as {
          conversationId: string;
          assignedAgent?: { id: string; name: string } | null;
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === assignedPayload.conversationId
              ? { ...c, assignedAgent: assignedPayload.assignedAgent || undefined }
              : c
          )
        );
        if (selected?.id === assignedPayload.conversationId) {
          setSelected((prev) =>
            prev
              ? {
                  ...prev,
                  assignedAgent: assignedPayload.assignedAgent || undefined,
                }
              : prev
          );
        }
      }

      if (event === 'conversation:bot') {
        const botPayload = data as {
          conversationId: string;
          botActive: boolean;
          botHandoffAt?: string | null;
          activeBot?: { id: string; name: string } | null;
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === botPayload.conversationId
              ? {
                  ...c,
                  botActive: botPayload.botActive,
                  botHandoffAt: botPayload.botHandoffAt,
                  activeBot: botPayload.activeBot ?? c.activeBot,
                }
              : c
          )
        );
        if (selected?.id === botPayload.conversationId) {
          setSelected((prev) =>
            prev
              ? {
                  ...prev,
                  botActive: botPayload.botActive,
                  botHandoffAt: botPayload.botHandoffAt,
                  activeBot: botPayload.activeBot ?? prev.activeBot,
                }
              : prev
          );
        }
      }

      if (event === 'conversation:handoff') {
        const handoffPayload = data as {
          conversationId: string;
          reason?: string;
          assignedAgent?: { id: string; name: string } | null;
          botActive?: boolean;
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === handoffPayload.conversationId
              ? {
                  ...c,
                  botActive: handoffPayload.botActive ?? false,
                  botHandoffAt: new Date().toISOString(),
                  botHandoffReason: handoffPayload.reason,
                  status: 'PENDING',
                  assignedAgent: handoffPayload.assignedAgent || c.assignedAgent,
                }
              : c
          )
        );
        if (selected?.id === handoffPayload.conversationId) {
          setSelected((prev) =>
            prev
              ? {
                  ...prev,
                  botActive: handoffPayload.botActive ?? false,
                  botHandoffAt: new Date().toISOString(),
                  botHandoffReason: handoffPayload.reason,
                  status: 'PENDING',
                  assignedAgent: handoffPayload.assignedAgent || prev.assignedAgent,
                }
              : prev
          );
          toastSuccess(
            handoffPayload.assignedAgent
              ? `Handed off to ${handoffPayload.assignedAgent.name}`
              : 'Customer handed off to your team'
          );
        }
      }
    },
    [selected, loadConversations]
  );

  useSocket(handleSocketEvent);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAttach = (file: File) => {
    const type = file.type.startsWith('image/')
      ? 'IMAGE'
      : file.type.startsWith('video/')
        ? 'VIDEO'
        : file.type.startsWith('audio/')
          ? 'AUDIO'
          : 'DOCUMENT';

    const previewUrl = type === 'IMAGE' ? URL.createObjectURL(file) : undefined;
    setAttachment({ file, previewUrl, type });
  };

  const handleRemoveAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSendTemplate = async (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
  }) => {
    if (!selected) return;
    setSending(true);
    try {
      const { data } = await inboxApi.send(selected.id, {
        type: 'TEMPLATE',
        templateName: payload.templateName,
        templateLanguage: payload.templateLanguage,
        templateParams: payload.templateParams,
      });
      const sent = data.data as Message;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, lastMessageAt: sent.createdAt, messages: [sent] }
            : c,
        ),
      );
      setTemplateMode(false);
      toastSuccess('Template sent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
        ?.error?.message;
      toastError(msg || 'Failed to send template');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !serviceWindow.open) return;
    if (!newMessage.trim() && !attachment) return;

    setSending(true);
    try {
      let payload;
      if (attachment) {
        const base64 = await fileToBase64(attachment.file);
        payload = {
          type: attachment.type,
          content: newMessage.trim() || undefined,
          media: {
            data: base64,
            mimeType: attachment.file.type || 'application/octet-stream',
            filename: attachment.file.name,
          },
        };
      } else {
        payload = { content: newMessage.trim() };
      }

      const { data } = await inboxApi.send(selected.id, payload);
      const sent = data.data as Message;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, lastMessageAt: sent.createdAt, messages: [sent] }
            : c
        )
      );
      setNewMessage('');
      handleRemoveAttachment();
      toastSuccess(attachment ? 'Media sent' : 'Message sent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toastError(msg || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const mediaGallery = useMemo(() => {
    return messages.filter(
      (m) => messageHasMedia(m) && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(m.type?.toUpperCase() || '')
    );
  }, [messages]);

  const openMediaViewer = useCallback(
    async (item: MediaViewerItem) => {
      setMediaViewer(item);
    },
    []
  );

  const mediaViewerIndex = mediaViewer
    ? mediaGallery.findIndex((m) => m.id === mediaViewer.messageId)
    : -1;

  const navigateMedia = async (direction: 'prev' | 'next') => {
    const nextIndex = direction === 'prev' ? mediaViewerIndex - 1 : mediaViewerIndex + 1;
    const nextMsg = mediaGallery[nextIndex];
    if (!nextMsg) return;

    try {
      const { data } = await api.get(`/inbox/messages/${nextMsg.id}/media`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      if (mediaViewer?.url) URL.revokeObjectURL(mediaViewer.url);
      setMediaViewer({
        messageId: nextMsg.id,
        type: nextMsg.type?.toUpperCase() as MediaViewerItem['type'],
        url,
        filename: nextMsg.metadata?.filename,
      });
    } catch {
      toastError('Could not load media');
    }
  };

  const handleStartChat = async (phone: string, name?: string) => {
    const { data } = await inboxApi.start({ phone, name });
    const conversation = data.data as Conversation;

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === conversation.id);
      if (existing) {
        return prev.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c));
      }
      return [conversation, ...prev];
    });

    setNewChatOpen(false);
    toastSuccess('Chat started');
    await selectConversation(conversation);
  };

  const handleAssignAgent = async (agentId: string | null, conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    if (!targetId) return;
    setAssigning(true);
    try {
      const { data } = await inboxApi.assign(targetId, agentId);
      const updated = data.data as Conversation;
      setSelected((prev) =>
        prev?.id === targetId ? { ...prev, assignedAgent: updated.assignedAgent } : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId ? { ...c, assignedAgent: updated.assignedAgent } : c
        )
      );
      toastSuccess(agentId ? 'Agent assigned' : 'Agent unassigned');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to assign agent';
      toastError(msg);
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusChange = async (status: string, conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    if (!targetId) return;
    try {
      const { data } = await inboxApi.setStatus(targetId, status);
      const updated = data.data as Conversation;
      setSelected((prev) => (prev?.id === targetId ? { ...prev, status: updated.status } : prev));
      setConversations((prev) =>
        prev.map((c) => (c.id === targetId ? { ...c, status: updated.status } : c))
      );
      toastSuccess('Status updated');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to update status'
      );
    }
  };

  const openChatContextMenu = (event: React.MouseEvent, conversation: Conversation) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      conversationId: conversation.id,
    });
  };

  const handleChangeActiveBot = async (botId: string) => {
    if (!selected) return;
    setBotToggling(true);
    try {
      const { data } = await inboxApi.setBot(selected.id, {
        activeBotId: botId || null,
        active: true,
        resetHandoff: true,
      });
      const updated = data.data as Conversation;
      setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, ...updated } : c))
      );
      toastSuccess('Active bot updated');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to change bot'
      );
    } finally {
      setBotToggling(false);
    }
  };

  const handleCallBack = async () => {
    if (!selected) return;
    setCallingBack(true);
    try {
      const { data } = await callingApi.callback({
        contactId: selected.contact.id,
        conversationId: selected.id,
        phone: selected.contact.phone,
      });
      toastSuccess('Outbound call initiated.');
      const callId = (data.data as { call?: { id: string } })?.call?.id;
      if (callId) navigate(`/calls/${callId}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not start call.';
      toastError(msg);
    } finally {
      setCallingBack(false);
    }
  };

  const handleToggleBot = async (conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    const target =
      conversations.find((c) => c.id === targetId) ||
      (selected?.id === targetId ? selected : null);
    if (!target || !targetId) return;
    const turningOn = target.botActive === false || Boolean(target.botHandoffAt);
    setBotToggling(true);
    try {
      const { data } = await inboxApi.setBot(
        targetId,
        turningOn ? { active: true, resetHandoff: true } : { active: false }
      );
      const updated = data.data as Conversation;
      setSelected((prev) =>
        prev?.id === targetId
          ? {
              ...prev,
              botActive: updated.botActive,
              botHandoffAt: updated.botHandoffAt,
              activeBot: updated.activeBot ?? prev.activeBot,
            }
          : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === targetId
            ? {
                ...c,
                botActive: updated.botActive,
                botHandoffAt: updated.botHandoffAt,
                activeBot: updated.activeBot ?? c.activeBot,
              }
            : c
        )
      );
      toastSuccess(turningOn ? 'AI bot resumed' : 'AI bot paused');
    } catch (err: unknown) {
      toastError(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to update bot'
      );
    } finally {
      setBotToggling(false);
    }
  };

  const botIsLive =
    selected?.botActive !== false && !selected?.botHandoffAt;

  const contextMenuConversation = useMemo(
    () => conversations.find((c) => c.id === contextMenu?.conversationId) ?? null,
    [contextMenu, conversations]
  );

  const contextMenuBotIsLive =
    contextMenuConversation?.botActive !== false && !contextMenuConversation?.botHandoffAt;

  const agentFilterOptions = useMemo<InboxSelectOption[]>(
    () => [
      { value: '', label: 'All agents' },
      ...(user
        ? [
            {
              value: '__mine__',
              label: 'Assigned to me',
              description: 'Only my conversations',
              avatarKey: user.email,
              accent: 'mine' as const,
            },
          ]
        : []),
      ...agents.map((agent) => ({
        value: agent.id,
        label: agent.name,
        description: agent.email,
        avatarKey: agent.email,
      })),
    ],
    [agents, user]
  );

  const botSelectOptions = useMemo(
    () => [
      { value: '', label: 'Default bot' },
      ...aiBots.map((bot) => ({ value: bot.id, label: bot.name })),
    ],
    [aiBots],
  );

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const messageGroups = groupMessagesByDate(messages);
  const canSendText = serviceWindow.open;
  const hasPagination = total > DEFAULT_PAGE_SIZE;

  return (
    <PageShell fullBleed className="!h-[calc(100dvh-60px)] !max-h-[calc(100dvh-60px)] !min-h-0 !overflow-hidden">
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="inbox-shell flex h-full min-h-0 w-full flex-1 overflow-hidden md:rounded-2xl">
          {/* Conversation list */}
          <div
            className={`relative flex h-full min-h-0 w-full flex-col border-neutral-200/80 md:w-[320px] md:border-r lg:w-[360px] ${
              selected ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="border-b border-neutral-100 bg-gradient-to-b from-emerald-50/60 via-white to-white px-4 pb-4 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">
                    Chats
                  </span>
                  {!loading && total > 0 && (
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-neutral-600 ring-1 ring-neutral-200/60">
                      {total}
                    </span>
                  )}
                </div>
                {unreadTotal > 0 && (
                  <span className="rounded-full bg-gradient-to-r from-whatsapp-500 to-whatsapp-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.3)]">
                    {unreadTotal} unread
                  </span>
                )}
              </div>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by name or phone..."
              />
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InboxSelect
                  variant="filter"
                  value={statusFilter}
                  placeholder="All chats"
                  isSearchable={false}
                  options={statusFilterOptions}
                  ariaLabel="Filter by chat status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
                <InboxSelect
                  variant="filter"
                  value={agentFilter}
                  placeholder="All agents"
                  isSearchable={agents.length > 4}
                  options={agentFilterOptions}
                  ariaLabel="Filter by assigned agent"
                  onChange={(e) => setAgentFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {loading ? (
                  <ConversationListSkeleton />
                ) : conversations.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      icon={MessageSquare}
                      title={search || statusFilter || agentFilter ? 'No conversations found' : 'No conversations yet'}
                      description={
                        search || statusFilter || agentFilter
                          ? 'Try adjusting your search or filters.'
                          : 'When customers message you, conversations will show up here.'
                      }
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100/80">
                    {conversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        selected={selected?.id === conv.id}
                        onSelect={() => selectConversation(conv)}
                        onContextMenu={(event) => openChatContextMenu(event, conv)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {hasPagination && (
                <div className="shrink-0 border-t border-neutral-100 bg-white">
                  <Pagination
                    page={page}
                    pageSize={DEFAULT_PAGE_SIZE}
                    total={total}
                    onPageChange={setPage}
                    className="!border-t-0"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setNewChatOpen(true)}
              className={`absolute right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_4px_20px_rgba(37,211,102,0.45)] transition hover:scale-[1.03] hover:shadow-[0_6px_28px_rgba(37,211,102,0.5)] active:scale-95 ${
                hasPagination ? 'bottom-[4.75rem]' : 'bottom-5'
              }`}
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-6 w-6" strokeWidth={2.25} />
            </button>
          </div>

          {/* Chat area */}
          <div
            className={`flex h-full min-h-0 min-w-0 flex-1 flex-col bg-white ${!selected ? 'hidden md:flex' : 'flex'}`}
          >
            {selected ? (
              <>
                <div
                  className="flex min-h-0 flex-1 flex-col"
                  onContextMenu={(event) => openChatContextMenu(event, selected)}
                >
                <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 bg-gradient-to-r from-white via-emerald-50/30 to-white px-4 py-3">
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-700 shadow-input transition hover:border-whatsapp-500/30 hover:bg-emerald-50 md:hidden"
                    onClick={() => setSelected(null)}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={18} strokeWidth={2.25} />
                  </button>

                  <ContactAvatar
                    name={selected.contact.name}
                    phone={selected.contact.phone}
                    size="lg"
                  />

                  <div className="min-w-0 flex-1 basis-[140px]">
                    <p className="truncate text-[15px] font-extrabold tracking-tight text-neutral-900">
                      {selected.contact.name || selected.contact.phone}
                    </p>
                    <p className="truncate text-[12px] font-medium text-neutral-500">
                      {selected.contact.phone}
                      {selected.contact.name && (
                        <span className="text-neutral-400"> · WhatsApp</span>
                      )}
                      {selected.assignedAgent && (
                        <span className="text-emerald-600"> · {selected.assignedAgent.name}</span>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={botToggling}
                    onClick={() => handleToggleBot()}
                    title={
                      botIsLive
                        ? 'AI bot is replying — click to pause for this chat'
                        : 'AI bot is paused — click to enable auto-reply'
                    }
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold uppercase tracking-wide ring-1 transition ${
                      botIsLive
                        ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80 hover:bg-emerald-100'
                        : 'bg-neutral-100 text-neutral-600 ring-neutral-200/80 hover:bg-neutral-200/60'
                    } ${botToggling ? 'opacity-60' : ''}`}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {botToggling ? '...' : botIsLive ? 'AI ON' : 'AI OFF'}
                  </button>

                  {aiBots.length > 0 && (
                    <AppSelect
                      className="w-[148px] shrink-0"
                      size="compact"
                      value={selected.activeBot?.id || ''}
                      options={botSelectOptions}
                      placeholder="Default bot"
                      isSearchable={false}
                      disabled={botToggling}
                      ariaLabel="Active AI bot for this chat"
                      onChange={(e) => handleChangeActiveBot(e.target.value)}
                    />
                  )}

                  <button
                    type="button"
                    disabled={callingBack}
                    onClick={() => void handleCallBack()}
                    title="Call this contact via WhatsApp"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200/80 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-800 transition hover:bg-violet-100 disabled:opacity-60"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {callingBack ? 'Calling...' : 'Call'}
                  </button>

                  <ServiceWindowBadge serviceWindow={serviceWindow} />
                </div>

                {selected.botHandoffAt && (
                  <div className="border-b border-orange-200/60 bg-orange-50/80 px-4 py-2 text-center text-[12px] font-medium text-orange-900">
                    Handed off to team
                    {selected.botHandoffReason ? ` (${selected.botHandoffReason.replace(/_/g, ' ').toLowerCase()})` : ''}
                    {selected.assignedAgent ? ` · ${selected.assignedAgent.name}` : ''}
                  </div>
                )}

                {selected.activeFlow && (
                  <div className="border-b border-violet-200/60 bg-violet-50/80 px-4 py-2 text-center text-[12px] font-medium text-violet-900">
                    <span className="font-bold">{selected.activeFlow.flowName || 'Automation flow'}</span>
                    {' · '}
                    Step: {selected.activeFlow.currentStepLabel || selected.activeFlow.currentNodeId}
                    {selected.activeFlow.waitingFor && (
                      <span className="text-violet-600"> · waiting for {selected.activeFlow.waitingFor}</span>
                    )}
                  </div>
                )}

                {!botIsLive && (
                  <div className="border-b border-amber-200/60 bg-amber-50/80 px-4 py-2 text-center text-[12px] font-medium text-amber-900">
                    AI bot is paused for this chat.{' '}
                    <button
                      type="button"
                      onClick={() => handleToggleBot()}
                      className="font-bold underline hover:no-underline"
                    >
                      Turn ON
                    </button>{' '}
                    to auto-reply again.
                  </div>
                )}

                <div className="inbox-chat-bg flex-1 overflow-y-auto px-2 py-3 sm:px-3">
                  <div className="space-y-2">
                    {messageGroups.map((group) => (
                      <div key={group.date} className="space-y-2">
                        <DateDivider label={formatDateDivider(group.date)} />
                        {group.messages.map((msg) => (
                          <MessageBubble key={msg.id} message={msg} onOpenMedia={openMediaViewer} />
                        ))}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
                </div>

                {!canSendText && !templateMode && (
                  <ServiceWindowBanner serviceWindow={serviceWindow} />
                )}

                {templateMode ? (
                  <TemplateComposer
                    onSend={handleSendTemplate}
                    sending={sending}
                    onCancel={() => setTemplateMode(false)}
                  />
                ) : (
                  <ChatComposer
                    value={newMessage}
                    onChange={setNewMessage}
                    onSubmit={handleSend}
                    onAttach={handleAttach}
                    attachment={attachment}
                    onRemoveAttachment={handleRemoveAttachment}
                    sending={sending}
                    disabled={!canSendText}
                    disabledReason={
                      canSendText
                        ? 'Type a message...'
                        : '24-hour window closed — use a template'
                    }
                    onTemplateClick={!canSendText ? () => setTemplateMode(true) : undefined}
                  />
                )}
              </>
            ) : (
              <ChatPlaceholder />
            )}
          </div>
        </div>
      </div>

      <NewChatSlideOver
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onStart={handleStartChat}
      />

      <MediaViewer
        item={mediaViewer}
        onClose={() => {
          if (mediaViewer?.url) URL.revokeObjectURL(mediaViewer.url);
          setMediaViewer(null);
        }}
        onPrev={() => navigateMedia('prev')}
        onNext={() => navigateMedia('next')}
        hasPrev={mediaViewerIndex > 0}
        hasNext={mediaViewerIndex >= 0 && mediaViewerIndex < mediaGallery.length - 1}
      />

      <ChatContextMenu
        open={Boolean(contextMenu && contextMenuConversation)}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        conversation={contextMenuConversation}
        agents={agents}
        currentUserId={user?.id}
        botIsLive={contextMenuBotIsLive}
        assigning={assigning}
        botToggling={botToggling}
        onClose={() => setContextMenu(null)}
        onAssign={(agentId) =>
          handleAssignAgent(agentId, contextMenuConversation?.id)
        }
        onToggleBot={() => handleToggleBot(contextMenuConversation?.id)}
        onStatusChange={(status) =>
          handleStatusChange(status, contextMenuConversation?.id)
        }
      />
    </PageShell>
  );
}
