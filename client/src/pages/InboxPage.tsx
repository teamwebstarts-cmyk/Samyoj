import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquarePlus } from 'lucide-react';
import ChatComposer, { type PendingAttachment } from '../components/inbox/ChatComposer';
import TemplateComposer from '../components/inbox/TemplateComposer';
import MediaViewer, { type MediaViewerItem } from '../components/inbox/MediaViewer';
import ChatContextMenu from '../components/inbox/ChatContextMenu';
import ChatPlaceholder from '../components/inbox/ChatPlaceholder';
import ContactAvatar from '../components/inbox/ContactAvatar';
import ConversationItem from '../components/inbox/ConversationItem';
import ConversationListSkeleton from '../components/inbox/ConversationListSkeleton';
import InboxListEmpty from '../components/inbox/InboxListEmpty';
import MessageBubble, { DateDivider } from '../components/inbox/MessageBubble';
import NewChatSlideOver from '../components/inbox/NewChatSlideOver';
import ServiceWindowBanner, { ServiceWindowBadge } from '../components/inbox/ServiceWindowBanner';
import {
  formatDateDivider,
  formatHandoffReason,
  getServiceWindowInfo,
  groupMessagesByDate,
  messageHasMedia,
} from '../components/inbox/inboxUtils';
import InboxSelect, { type InboxSelectOption } from '../components/inbox/InboxSelect';
import Pagination from '../components/ui/Pagination';
import PageShell from '../components/ui/PageShell';
import SearchInput from '../components/ui/SearchInput';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useInboxKeyboardShortcuts } from '../hooks/useInboxKeyboardShortcuts';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import InboxDetailsPanel, { type PanelSection } from '../components/inbox/InboxDetailsPanel';
import InboxChatHeaderActions from '../components/inbox/InboxChatHeaderActions';
import InteractiveComposer from '../components/inbox/InteractiveComposer';
import api, { aiBotApi, billingApi, callingApi, cannedRepliesApi, inboxApi, teamApi, ticketApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';
import { useSocket } from '../hooks/useSocket';
import ConnectionStatusIndicator from '../components/ui/ConnectionStatusIndicator';
import { useAuth } from '../contexts/AuthContext';
import type { AiBot, CannedReply, Conversation, ConversationLabel, Message, ServiceWindowInfo, TeamAgent } from '../types';

const CLOSED_WINDOW: ServiceWindowInfo = {
  open: false,
  lastInboundAt: null,
  expiresAt: null,
  windowOpensAt: null,
};

const INBOX_CACHE_KEY = 'inbox';

type InboxNumberCache = {
  conversations: Conversation[];
  total: number;
  selected: Conversation | null;
  messages: Message[];
  serviceWindow: ServiceWindowInfo;
  page: number;
  search: string;
  statusFilter: string;
  agentFilter: string;
};

const statusFilterOptions: InboxSelectOption[] = [
  { value: '', label: 'All chats' },
  { value: 'OPEN', label: 'Open', dotColor: '#22c55e' },
  { value: 'PENDING', label: 'Pending', dotColor: '#f59e0b' },
  { value: 'CLOSED', label: 'Closed', dotColor: '#94a3b8' },
  { value: 'SNOOZED', label: 'Snoozed', dotColor: '#6366f1' },
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
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [detailsOverlay, setDetailsOverlay] = useState<{ open: boolean; section?: PanelSection }>({
    open: false,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const loadConversationsRef = useRef<() => Promise<void>>(async () => {});
  const inboxSnapshotRef = useRef<InboxNumberCache>({
    conversations: [],
    total: 0,
    selected: null,
    messages: [],
    serviceWindow: CLOSED_WINDOW,
    page: 1,
    search: '',
    statusFilter: '',
    agentFilter: '',
  });
  const [ticketConversationIds, setTicketConversationIds] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebouncedValue(search);

  inboxSnapshotRef.current = {
    conversations,
    total,
    selected,
    messages,
    serviceWindow,
    page,
    search,
    statusFilter,
    agentFilter,
  };

  useEffect(() => {
    ticketApi
      .list()
      .then((res) => {
        const ids = new Set<string>();
        for (const t of res.data.data.tickets || []) {
          if (
            t.conversation?.id &&
            !['RESOLVED', 'CLOSED'].includes(t.status)
          ) {
            ids.add(t.conversation.id);
          }
        }
        setTicketConversationIds(ids);
      })
      .catch(console.error);
  }, []);

  useInboxKeyboardShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCloseChat: () => setSelected(null),
    onOpenDetails: () => {
      if (selected) setDetailsOverlay({ open: true });
    },
    enabled: true,
  });

  useEffect(() => {
    teamApi
      .agents()
      .then(({ data }) => setAgents(data.data.agents))
      .catch(console.error);
    aiBotApi
      .list()
      .then(({ data }) => setAiBots(data.data.bots.filter((b: AiBot) => b.enabled)))
      .catch(console.error);
    cannedRepliesApi
      .list()
      .then(({ data }) => setCannedReplies(data.data.replies))
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

  loadConversationsRef.current = loadConversations;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;

    if (previousNumberId) {
      writeNumberCache(INBOX_CACHE_KEY, previousNumberId, inboxSnapshotRef.current);
    }

    const cached = readNumberCache<InboxNumberCache>(INBOX_CACHE_KEY, numberId);
    if (cached) {
      setConversations(cached.conversations);
      setTotal(cached.total);
      setSelected(cached.selected);
      setMessages(cached.messages);
      setServiceWindow(cached.serviceWindow);
      setPage(cached.page);
      setSearch(cached.search);
      setStatusFilter(cached.statusFilter);
      setAgentFilter(cached.agentFilter);
      setNewMessage('');
      setTemplateMode(false);
      setLoading(false);
      return;
    }

    setSelected(null);
    setMessages([]);
    setServiceWindow(CLOSED_WINDOW);
    setNewMessage('');
    setTemplateMode(false);
    void loadConversationsRef.current();
  });

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
            setServiceWindow(
              getServiceWindowInfo(payload.message.createdAt, payload.message.createdAt)
            );
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

  const { state: socketState } = useSocket(handleSocketEvent);

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

  const uploadAttachment = async (
    file: File,
  ): Promise<{ mediaPath: string; mimeType: string; filename: string }> => {
    const mimeType = file.type || 'application/octet-stream';
    const filename = file.name;

    try {
      const { data: urlRes } = await inboxApi.uploadUrl({
        mimeType,
        size: file.size,
        filename,
      });
      const info = urlRes.data as {
        mode: string;
        uploadUrl: string;
        mediaPath: string;
      };
      if (info.mode === 'presigned') {
        const put = await fetch(info.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': mimeType },
        });
        if (!put.ok) throw new Error('Presigned upload failed');
        return { mediaPath: info.mediaPath, mimeType, filename };
      }
    } catch {
      /* fall through to direct upload */
    }

    const base64 = await fileToBase64(file);
    const { data: upRes } = await inboxApi.uploadMedia({ mimeType, data: base64, filename });
    const uploaded = upRes.data as { mediaPath: string };
    return { mediaPath: uploaded.mediaPath, mimeType, filename };
  };

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
        const uploaded = await uploadAttachment(attachment.file);
        payload = {
          type: attachment.type,
          content: newMessage.trim() || undefined,
          media: {
            mediaPath: uploaded.mediaPath,
            mimeType: uploaded.mimeType,
            filename: uploaded.filename,
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
      toastSuccess('Calling…');
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

  const handleSnooze = async (hours: number) => {
    if (!selected) return;
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    try {
      await inboxApi.snooze(selected.id, until);
      toastSuccess(`Snoozed for ${hours} hour${hours > 1 ? 's' : ''}`);
      loadConversations();
      setSelected(null);
    } catch {
      toastError('Could not snooze conversation');
    }
  };

  const handleConvertToTicket = async () => {
    if (!selected) return;
    const title = prompt(
      'Ticket title',
      `Support: ${selected.contact.name || selected.contact.phone}`,
    );
    if (!title?.trim()) return;
    try {
      await ticketApi.fromConversation(selected.id, { title: title.trim() });
      toastSuccess('Ticket created — view in Tickets');
    } catch {
      toastError('Could not create ticket');
    }
  };

  const handlePaymentLink = async () => {
    if (!selected || !serviceWindow.open) return;
    const amountStr = prompt('Amount in INR', '500');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      toastError('Enter a valid amount');
      return;
    }
    const description = prompt('Payment description', 'Payment request')?.trim() || 'Payment request';
    setSending(true);
    try {
      const { data: linkRes } = await billingApi.createPaymentLink({
        amountPaise: Math.round(amount * 100),
        description,
        customerName: selected.contact.name || undefined,
        customerPhone: selected.contact.phone,
      });
      const url = linkRes.data.url as string;
      const { data } = await inboxApi.send(selected.id, {
        content: `${description}\n\nPay here: ${url}`,
      });
      const sent = data.data as Message;
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      toastSuccess('Payment link sent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
        ?.error?.message;
      toastError(msg || 'Could not send payment link');
    } finally {
      setSending(false);
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
    <PageShell inbox className="!h-[calc(100dvh-60px)] !max-h-[calc(100dvh-60px)] !min-h-0 !overflow-hidden">
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="inbox-shell flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden md:rounded-2xl">
          {/* Conversation list */}
          <div
            className={`inbox-sidebar relative flex h-full min-h-0 w-full flex-col md:w-[360px] lg:w-[400px] ${
              selected ? 'hidden md:flex' : 'flex'
            }`}
          >
            <div className="inbox-list-header shrink-0 px-4 pb-4 pt-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
                    <MessageSquarePlus className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight text-theme-fg leading-none">Inbox</h2>
                    {!loading && total > 0 && (
                      <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
                        {total} conversation{total !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ConnectionStatusIndicator
                    status={socketState.status}
                    reconnectAttempts={socketState.reconnectAttempts}
                    totalDisconnects={socketState.totalDisconnects}
                  />
                  {unreadTotal > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-whatsapp-500 to-whatsapp-600 px-3 py-1 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.35)]">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      {unreadTotal} unread
                    </span>
                  )}
                </div>
              </div>
              <SearchInput
                ref={searchInputRef}
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
                  <InboxListEmpty
                    filtered={Boolean(search || statusFilter || agentFilter)}
                    onNewChat={() => setNewChatOpen(true)}
                  />
                ) : (
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {conversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        selected={selected?.id === conv.id}
                        onSelect={() => selectConversation(conv)}
                        onContextMenu={(event) => openChatContextMenu(event, conv)}
                        hasTicket={ticketConversationIds.has(conv.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {hasPagination && (
                <div className="shrink-0 border-t border-neutral-100/80 bg-white/80 backdrop-blur-sm dark:border-neutral-800/80 dark:bg-neutral-950/80">
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
              className={`inbox-fab absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full text-white transition hover:scale-105 active:scale-95 ${
                hasPagination ? 'bottom-[4.75rem]' : 'bottom-5'
              }`}
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>

          {/* Chat area */}
          <div
            className={`inbox-chat-pane flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${!selected ? 'hidden md:flex' : 'flex'}`}
          >
            {selected ? (
              <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  onContextMenu={(event) => openChatContextMenu(event, selected)}
                >
                <div className="inbox-chat-header flex shrink-0 items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-700 shadow-input transition hover:border-whatsapp-500/30 hover:bg-emerald-50 md:hidden dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-emerald-950/30"
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

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold tracking-tight text-theme-fg">
                      {selected.contact.name || selected.contact.phone}
                    </p>
                    <p className="truncate text-[12px] font-medium text-theme-muted">
                      {selected.contact.phone}
                      {selected.contact.name && (
                        <span className="text-theme-muted/70"> · WhatsApp</span>
                      )}
                      {selected.assignedAgent && (
                        <span className="text-emerald-600 dark:text-emerald-400"> · {selected.assignedAgent.name}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                  <InboxChatHeaderActions
                    selected={selected}
                    botIsLive={botIsLive}
                    botToggling={botToggling}
                    callingBack={callingBack}
                    aiBots={aiBots}
                    botSelectOptions={botSelectOptions}
                    labelsCount={selected.labels?.length ?? 0}
                    onToggleBot={() => handleToggleBot()}
                    onChangeActiveBot={handleChangeActiveBot}
                    onCallBack={() => void handleCallBack()}
                    onOpenLabels={() => setDetailsOverlay({ open: true, section: 'labels' })}
                    onOpenNotes={() => setDetailsOverlay({ open: true, section: 'notes' })}
                    onSnooze={(hours) => void handleSnooze(hours)}
                    onConvertToTicket={() => void handleConvertToTicket()}
                  />

                  <div className="hidden md:block">
                    <ServiceWindowBadge serviceWindow={serviceWindow} />
                  </div>
                  </div>
                </div>

                {selected.botHandoffAt && (
                  <div className="inbox-status-banner border-b border-orange-200/50 bg-gradient-to-r from-orange-50/90 to-amber-50/70 text-orange-900 dark:from-orange-950/40 dark:to-amber-950/30 dark:text-orange-200">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-200/80 text-[10px] dark:bg-orange-800/50">👋</span>
                    With your team
                    {selected.botHandoffReason
                      ? ` · ${formatHandoffReason(selected.botHandoffReason)}`
                      : ''}
                    {selected.assignedAgent ? ` · ${selected.assignedAgent.name}` : ''}
                  </div>
                )}

                {selected.activeFlow && (
                  <div className="inbox-status-banner border-b border-violet-200/50 bg-gradient-to-r from-violet-50/90 to-purple-50/70 text-violet-900 dark:from-violet-950/40 dark:to-purple-950/30 dark:text-violet-200">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-200/80 text-[10px] dark:bg-violet-800/50">⚡</span>
                    <span className="font-bold">{selected.activeFlow.flowName || 'Automation'}</span>
                    {selected.activeFlow.currentStepLabel && (
                      <>
                        {' · '}
                        {selected.activeFlow.currentStepLabel}
                      </>
                    )}
                    {selected.activeFlow.waitingFor && (
                      <span className="text-violet-600 dark:text-violet-400"> · waiting for {selected.activeFlow.waitingFor}</span>
                    )}
                  </div>
                )}

                {!botIsLive && (
                  <div className="inbox-status-banner border-b border-amber-200/50 bg-gradient-to-r from-amber-50/90 to-yellow-50/70 text-amber-900 dark:from-amber-950/40 dark:to-yellow-950/30 dark:text-amber-200">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-200/80 text-[10px] dark:bg-amber-800/50">🤖</span>
                    AI bot paused.{' '}
                    <button
                      type="button"
                      onClick={() => handleToggleBot()}
                      className="font-bold underline decoration-amber-400/60 underline-offset-2 hover:no-underline"
                    >
                      Turn on
                    </button>{' '}
                    to auto-reply.
                  </div>
                )}

                <div className="inbox-chat-bg min-h-0 flex-1 overflow-y-auto px-2 py-3 sm:px-3">
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

                {!canSendText && !templateMode && (
                  <div className="shrink-0 md:hidden">
                    <ServiceWindowBanner serviceWindow={serviceWindow} compact />
                  </div>
                )}

                {!canSendText && !templateMode && (
                  <div className="hidden shrink-0 md:block">
                    <ServiceWindowBanner serviceWindow={serviceWindow} />
                  </div>
                )}

                <div className="sticky bottom-0 z-10 shrink-0 border-t border-neutral-100/80 bg-white/95 backdrop-blur-md dark:border-neutral-800/80 dark:bg-neutral-950/95">
                {interactiveOpen ? (
                  <InteractiveComposer
                    open={interactiveOpen}
                    onClose={() => setInteractiveOpen(false)}
                    sending={sending}
                    serviceWindow={serviceWindow}
                    onSend={async (payload) => {
                      if (!selected) return;
                      setSending(true);
                      try {
                        const { data } = await inboxApi.send(selected.id, payload);
                        const sent = data.data as Message;
                        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
                        toastSuccess('Interactive message sent');
                      } catch (err: unknown) {
                        const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
                        toastError(msg || 'Failed to send');
                      } finally {
                        setSending(false);
                      }
                    }}
                  />
                ) : templateMode ? (
                  <TemplateComposer
                    onSend={handleSendTemplate}
                    sending={sending}
                    onCancel={() => setTemplateMode(false)}
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-center border-b border-neutral-100/60 bg-neutral-50/50 px-3 py-1.5 dark:border-neutral-800/60 dark:bg-neutral-900/30">
                      <button
                        type="button"
                        onClick={() => setInteractiveOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/40"
                      >
                        <span className="text-violet-500">+</span>
                        Send interactive message
                      </button>
                    </div>
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
                      cannedReplies={cannedReplies}
                      onPaymentLink={canSendText ? () => void handlePaymentLink() : undefined}
                    />
                  </>
                )}
                </div>
                </div>
                <InboxDetailsPanel
                  conversationId={selected.id}
                  labels={selected.labels}
                  onLabelsChange={(labels: ConversationLabel[]) =>
                    setSelected((prev) => (prev ? { ...prev, labels } : prev))
                  }
                  overlayOpen={detailsOverlay.open}
                  overlaySection={detailsOverlay.section}
                  onOverlayClose={() => setDetailsOverlay({ open: false })}
                  onConvertToTicket={() => void handleConvertToTicket()}
                  onSnooze={(hours) => void handleSnooze(hours)}
                />
              </div>
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
