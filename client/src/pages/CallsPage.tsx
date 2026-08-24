import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CallingAiToggleBanner from '../components/calls/CallingAiToggleBanner';
import { callingApi, contactApi, aiBotApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { InternalNote } from '../types';
import { useSocket } from '../hooks/useSocket';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useCallingBots } from '../hooks/useCallingBots';
import CallDetailView from '../components/calls/CallDetailView';
import CallDetailsPanel from '../components/calls/CallDetailsPanel';
import type { CallDetailsSection } from '../components/calls/CallDetailsPanel';
import { useMobileThreadChrome } from '../hooks/useMobileThreadChrome';
import CallFiltersBar from '../components/calls/CallFiltersBar';
import CallListItem from '../components/calls/CallListItem';
import CallsBulkBar from '../components/calls/CallsBulkBar';
import CallContextMenu from '../components/calls/CallContextMenu';
import { CallsListEmpty, CallsSelectEmpty } from '../components/calls/CallPlaceholder';
import {
  formatPhoneDisplay,
  isActiveCallStatus,
  normalizeTranscript,
  transcriptPreview,
} from '../components/calls/callUtils';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { toastError, toastSuccess } from '../utils/toast';
import { explainAiSkipReason } from '../utils/aiSkipReasons';
import {
  createAgentOffer,
  pollSdpAnswer,
  setActiveCallId,
  cleanupAgentCall,
  applyAgentOfferAnswer,
} from '../utils/agentCallRTC';
import { beginOutboundDialing, beginOutboundLiveCall, clearOutboundLiveCall, updateOutboundLiveCallStatus } from '../utils/outboundLiveCallStore';
import { CallsListSkeleton } from '../components/calls/CallsPageSkeleton';
import PageShell from '../components/ui/PageShell';
import PageSizeSelect from '../components/inbox/PageSizeSelect';
import { type PageSize } from '../components/inbox/useConversationList';
import { FOCUS_RING_CLASS } from '../hooks/inboxA11y';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { InboxGlassTipProvider } from '../components/inbox/ComposerGlassTip';

interface CallRecord {
  id: string;
  metaCallId: string;
  direction: string;
  status: string;
  handler: string;
  fromPhone: string;
  toPhone: string;
  durationSeconds?: number | null;
  transcript?: unknown;
  metadata?: { notes?: string; summary?: string } | null;
  createdAt: string;
  contact?: { id?: string; name?: string | null; phone: string; callingAiEnabled?: boolean };
  aiBot?: { name: string } | null;
  assignedAgent?: { id: string; name: string } | null;
  conversation?: { id: string } | null;
  internalNotes?: InternalNote[];
}

const CALLS_CACHE_KEY = 'calls';
type CallsNumberCache = {
  calls: CallRecord[];
  totalCalls: number;
  page: number;
  search: string;
  chip: string;
  selectedCallId: string | null;
};

/** Map UI chip → API list params. */
function chipToParams(chip: string): { status?: string; handler?: string; direction?: string } {
  switch (chip) {
    case 'live':
      return { status: 'CONNECTED,CONNECTING,RINGING' };
    case 'missed':
      return { status: 'MISSED,REJECTED' };
    case 'ai':
      return { handler: 'AI' };
    case 'human':
      return { handler: 'AGENT' };
    case 'in':
      return { direction: 'USER_INITIATED' };
    case 'out':
      return { direction: 'BUSINESS_INITIATED' };
    default:
      return {};
  }
}

function parseCall(raw: CallRecord): CallRecord {
  return {
    ...raw,
    transcript: normalizeTranscript(raw.transcript),
    internalNotes: raw.internalNotes ?? [],
  };
}

export default function CallsPage() {
  const { user, canManageTeam } = useAuth();
  const { activeNumber, resolved } = useWhatsAppNumber();
  const {
    callBots,
    answeringCallBotId,
    loading: callBotsLoading,
    assigning: callBotAssigning,
    selectCallBot,
  } = useCallingBots();
  const { callId: routeCallId } = useParams();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [callingBack, setCallingBack] = useState(false);
  const [callingBackId, setCallingBackId] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(routeCallId ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [totalCalls, setTotalCalls] = useState(0);
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('');
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [callingAiSaving, setCallingAiSaving] = useState(false);
  const [orgCallingAiEnabled, setOrgCallingAiEnabled] = useState<boolean | null>(null);
  const [orgCallingAiSaving, setOrgCallingAiSaving] = useState(false);
  const orgCallingAiSavingRef = useRef(false);
  const orgCallingAiSaveGenRef = useRef(0);
  const [callMenu, setCallMenu] = useState<{ x: number; y: number; callId: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [deleteCallTarget, setDeleteCallTarget] = useState<CallRecord | null>(null);
  const [deletingCall, setDeletingCall] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [detailsOverlay, setDetailsOverlay] = useState<{ open: boolean; section?: CallDetailsSection }>({
    open: false,
  });
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [detailsFocusSection, setDetailsFocusSection] = useState<CallDetailsSection | undefined>();
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const callsSnapshotRef = useRef<CallsNumberCache>({
    calls: [],
    totalCalls: 0,
    page: 1,
    search: '',
    chip: '',
    selectedCallId: null,
  });

  callsSnapshotRef.current = {
    calls,
    totalCalls,
    page,
    search,
    chip,
    selectedCallId,
  };

  const pageRef = useRef(page);
  const searchRef = useRef(search);
  const chipRef = useRef(chip);
  const pageSizeRef = useRef(pageSize);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  pageRef.current = page;
  searchRef.current = search;
  chipRef.current = chip;
  pageSizeRef.current = pageSize;

  const loadCalls = useCallback(async (opts?: { skeleton?: boolean }) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const params: Record<string, string> = {
      page: String(pageRef.current),
      limit: String(pageSizeRef.current),
    };
    const q = searchRef.current.trim();
    if (q) params.search = q;
    const mapped = chipToParams(chipRef.current);
    if (mapped.status) params.status = mapped.status;
    if (mapped.handler) params.handler = mapped.handler;
    if (mapped.direction) params.direction = mapped.direction;

    const showSkeleton = opts?.skeleton === true;
    if (showSkeleton) setListLoading(true);
    try {
      const { data } = await callingApi.list(params);
      const payload = data.data as {
        items: CallRecord[];
        pagination: { total: number };
      };
      if (requestNumberId !== activeNumberIdRef.current) return;
      setCalls(payload.items.map(parseCall));
      setTotalCalls(payload.pagination.total);
    } finally {
      if (showSkeleton) setListLoading(false);
    }
  }, [activeNumber, resolved]);

  const load = useCallback(async () => {
    if (!resolved || !activeNumber) return;
    try {
      await Promise.all([
        callingApi.status(),
        loadCalls(),
        aiBotApi
          .list('CALL')
          .then(({ data }) => {
            if (orgCallingAiSavingRef.current) return;
            setOrgCallingAiEnabled(Boolean(data.data?.callingAiEnabled ?? true));
          })
          .catch(() => setOrgCallingAiEnabled(null)),
      ]);
    } catch {
      toastError('Could not load calls. Please refresh the page.');
    } finally {
    }
  }, [activeNumber, loadCalls, resolved]);

  const filtersBootstrapped = useRef(false);
  useEffect(() => {
    if (!filtersBootstrapped.current) {
      filtersBootstrapped.current = true;
      return;
    }
    void loadCalls({ skeleton: true });
  }, [page, pageSize, search, chip, loadCalls]);

  const loadCallDetail = useCallback(
    async (callId: string) => {
      if (!resolved || !activeNumber) return null;
      const requestNumberId = activeNumber.id;
      try {
        const { data } = await callingApi.get(callId);
        if (requestNumberId !== activeNumberIdRef.current) return null;
        const parsed = parseCall(data.data as CallRecord);
        setCalls((prev) => {
          const exists = prev.some((c) => c.id === callId);
          return exists ? prev.map((c) => (c.id === callId ? parsed : c)) : [parsed, ...prev];
        });
        setInternalNotes(parsed.internalNotes ?? []);
        return parsed;
      } catch {
        return null;
      }
    },
    [activeNumber, resolved]
  );

  loadRef.current = load;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;

    if (previousNumberId) {
      writeNumberCache(CALLS_CACHE_KEY, previousNumberId, callsSnapshotRef.current);
    }

    const cached = readNumberCache<CallsNumberCache>(CALLS_CACHE_KEY, numberId);
    if (cached) {
      setCalls(cached.calls);
      setTotalCalls(cached.totalCalls);
      setPage(cached.page);
      setSearch(cached.search);
      setChip(cached.chip ?? '');
      setSelectedCallId(null);
      setInternalNotes([]);
      setCallMenu(null);
      setDeleteCallTarget(null);
      setSelectionMode(false);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      navigate('/calls');
      setListLoading(true);
      void loadRef.current();
      return;
    }

    setSelectedCallId(null);
    setCalls([]);
    setTotalCalls(0);
    setInternalNotes([]);
    setPage(1);
    setSearch('');
    setChip('');
    setCallMenu(null);
    setDeleteCallTarget(null);
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    navigate('/calls');
    void loadRef.current();
  });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (routeCallId) {
      setSelectedCallId(routeCallId);
      setInternalNotes([]);
      void loadCallDetail(routeCallId);
    }
  }, [routeCallId, loadCallDetail]);

  const applyTranscriptUpdate = useCallback((callId: string, transcript: unknown) => {
    const normalized = normalizeTranscript(transcript);
    setCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, transcript: normalized } : c))
    );
  }, []);

   /** Tear down browser WebRTC + audio elements when a call ends (remote or local). */
  const cleanupActiveCall = useCallback(() => {
    cleanupAgentCall();
  }, []);

  useSocket((event, data) => {
    if (event === 'call:incoming') {
      void load();
    }
    if (event === 'call:updated') {
      void load();
      // If the updated call IS the one selected, reload detail immediately
      // so the UI reflects status changes (e.g. caller hung up) without
      // waiting for the 3s polling cycle.
      const update = data as { callId?: string; status?: string };
      if (update.callId && update.status) {
        updateOutboundLiveCallStatus(update.callId, update.status);
      }
      if (update.callId === selectedCallId) {
        void loadCallDetail(selectedCallId);
        if (update.status && !isActiveCallStatus(update.status)) {
          cleanupActiveCall();
        }
      }
    }
    if (event === 'call:transcript') {
      const payload = data as { callId: string; transcript: unknown };
      if (payload.callId) applyTranscriptUpdate(payload.callId, payload.transcript);
    }
    if (event === 'call:ai_error') {
      const payload = data as { callId?: string; skipReason?: string; operatorMessage?: string };
      toastError(payload.operatorMessage || explainAiSkipReason(payload.skipReason), { duration: 8000 });
    }
    if (event === 'call:deleted') {
      const payload = data as { callId: string };
      if (!payload.callId) return;
      let removed = false;
      setCalls((prev) => {
        if (!prev.some((c) => c.id === payload.callId)) return prev;
        removed = true;
        return prev.filter((c) => c.id !== payload.callId);
      });
      if (removed) setTotalCalls((prev) => Math.max(0, prev - 1));
      setSelectedCallId((prev) => (prev === payload.callId ? null : prev));
      setSelectedIds((prev) => {
        if (!prev.has(payload.callId)) return prev;
        const next = new Set(prev);
        next.delete(payload.callId);
        if (next.size === 0) setSelectionMode(false);
        return next;
      });
    }
    if (event === 'call:outbound_connected') {
      const payload = data as { callId: string; sdpAnswer?: string };
      if (payload.callId && payload.sdpAnswer) {
        setActiveCallId(payload.callId);
        void applyAgentOfferAnswer(payload.callId, payload.sdpAnswer);
      }
      void load();
    }
  });

  const selectedCall = useMemo(
    () => (selectedCallId ? calls.find((c) => c.id === selectedCallId) ?? null : null),
    [calls, selectedCallId]
  );
  useMobileThreadChrome(Boolean(selectedCall));

  const toggleDetails = useCallback((section?: CallDetailsSection) => {
    if (!selectedCallId) return;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    if (mobile) {
      setDetailsOverlay((prev) => {
        const nextOpen = !prev.open;
        setDetailsPanelOpen(nextOpen);
        if (nextOpen && section) setDetailsFocusSection(section);
        if (!nextOpen) setDetailsFocusSection(undefined);
        return {
          open: nextOpen,
          section: section ?? prev.section,
        };
      });
      return;
    }
    setDetailsOverlay({ open: false });
    setDetailsPanelOpen((prev) => {
      const next = !prev;
      if (next && section) setDetailsFocusSection(section);
      if (!next) setDetailsFocusSection(undefined);
      return next;
    });
  }, [selectedCallId]);

  useEffect(() => {
    setDetailsOverlay({ open: false });
    setDetailsPanelOpen(false);
    setDetailsFocusSection(undefined);
  }, [selectedCallId]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => {
      if (mq.matches) {
        setDetailsPanelOpen((wasOpen) => {
          if (wasOpen) {
            setDetailsOverlay((prev) =>
              prev.open ? prev : { open: true, section: prev.section }
            );
          }
          return wasOpen;
        });
        return;
      }
      setDetailsOverlay((prev) => {
        if (!prev.open) return prev;
        setDetailsPanelOpen(true);
        if (prev.section) setDetailsFocusSection(prev.section);
        return { open: false, section: prev.section };
      });
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (routeCallId) return;
    if (calls.length === 0) {
      setSelectedCallId(null);
    }
  }, [calls.length, routeCallId]);

  useEffect(() => {
    if (!selectedCallId || !selectedCall || !isActiveCallStatus(selectedCall.status)) return;

    void loadCallDetail(selectedCallId);
    const timer = setInterval(() => {
      void loadCallDetail(selectedCallId);
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedCallId, selectedCall?.status, loadCallDetail, selectedCall]);

  const handleSelectCall = useCallback(
    (call: CallRecord) => {
      setSelectedCallId(call.id);
      setInternalNotes([]);
      navigate(`/calls/${call.id}`);
      void loadCallDetail(call.id);
    },
    [loadCallDetail, navigate]
  );

  const toggleSelect = useCallback((callId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      setSelectionMode(next.size > 0);
      return next;
    });
  }, []);

  const selectCall = useCallback((callId: string) => {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      if (prev.has(callId)) return prev;
      const next = new Set(prev);
      next.add(callId);
      return next;
    });
  }, []);

  const deselectCall = useCallback((callId: string) => {
    setSelectedIds((prev) => {
      if (!prev.has(callId)) return prev;
      const next = new Set(prev);
      next.delete(callId);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const call of calls) next.add(call.id);
      return next;
    });
  }, [calls]);

  const toggleSelectAllVisible = useCallback(() => {
    const allVisibleSelected = calls.length > 0 && calls.every((call) => selectedIds.has(call.id));
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const call of calls) next.delete(call.id);
        if (next.size === 0) setSelectionMode(false);
        return next;
      });
      return;
    }
    selectAllVisible();
  }, [calls, selectAllVisible, selectedIds]);

  const openCallContextMenu = useCallback((event: React.MouseEvent, call: CallRecord) => {
    event.preventDefault();
    event.stopPropagation();
    setCallMenu({ x: event.clientX, y: event.clientY, callId: call.id });
  }, []);

  const handleDeleteCall = useCallback(async () => {
    if (!deleteCallTarget) return;
    setDeletingCall(true);
    try {
      await callingApi.remove(deleteCallTarget.id);
      setCalls((prev) => prev.filter((c) => c.id !== deleteCallTarget.id));
      setTotalCalls((prev) => Math.max(0, prev - 1));
      setSelectedCallId((prev) => (prev === deleteCallTarget.id ? null : prev));
      deselectCall(deleteCallTarget.id);
      if (routeCallId === deleteCallTarget.id) navigate('/calls');
      setDeleteCallTarget(null);
      toastSuccess('Call deleted.');
    } catch {
      toastError('Could not delete the call.');
    } finally {
      setDeletingCall(false);
    }
  }, [deleteCallTarget, deselectCall, navigate, routeCallId]);

  const handleBulkDelete = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkBusy) return;
    if (ids.length > 50) {
      toastError('Select up to 50 calls at a time.');
      return;
    }
    setBulkBusy(true);
    try {
      const { data } = await callingApi.bulkRemove(ids);
      const deleted = new Set(data.data.callIds);
      setCalls((prev) => prev.filter((c) => !deleted.has(c.id)));
      setSelectedCallId((prev) => (prev && deleted.has(prev) ? null : prev));
      if (routeCallId && deleted.has(routeCallId)) navigate('/calls');
      clearSelection();
      setBulkDeleteOpen(false);
      toastSuccess(
        deleted.size === 1 ? 'Call deleted.' : `${deleted.size} calls deleted.`
      );
      void loadCalls();
    } catch {
      toastError('Could not delete the selected calls.');
    } finally {
      setBulkBusy(false);
    }
  }, [bulkBusy, clearSelection, loadCalls, navigate, routeCallId, selectedIds]);

  const contextMenuCall = useMemo(
    () => (callMenu ? calls.find((c) => c.id === callMenu.callId) ?? null : null),
    [callMenu, calls]
  );

  async function handleTerminate() {
    if (!selectedCall) return;
    setEnding(true);
    try {
      await callingApi.terminate(selectedCall.id);
      cleanupActiveCall();
      toastSuccess('Call ended.');
      await load();
      await loadCallDetail(selectedCall.id);
    } catch {
      toastError('Could not end the call.');
    } finally {
      setEnding(false);
    }
  }

  async function handleCallBack() {
    if (!selectedCall) return;
    const contactId = selectedCall.contact?.id;
    const phone = selectedCall.contact?.phone || selectedCall.fromPhone;
    const conversationId = selectedCall.conversation?.id;
    const contactName = selectedCall.contact?.name;
    setCallingBack(true);
    beginOutboundDialing({ contactName, phone, conversationId });
    try {
      const sdpOffer = await createAgentOffer();
      if (!sdpOffer) throw new Error('Microphone access is required to make calls.');

      const { data } = await callingApi.callback({
        contactId,
        phone,
        conversationId,
        sdpOffer,
      });
      const callId = (data.data as { call?: { id: string } })?.call?.id;
      if (callId) {
        setActiveCallId(callId);
        beginOutboundLiveCall({
          callId,
          contactName,
          phone,
          conversationId,
          status: 'CONNECTING',
        });
        navigate(`/calls/${callId}`);
        void pollSdpAnswer(callId);
      } else {
        clearOutboundLiveCall();
        toastError('Call started but no call page was returned.');
      }
    } catch (err: unknown) {
      clearOutboundLiveCall();
      cleanupAgentCall();
      const body = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })
        ?.response?.data?.error;
      if (body?.code === 'CALL_PERMISSION_REQUIRED' || body?.code === 'CALL_PERMISSION_REQUESTED') {
        toastSuccess(body?.message || 'Call permission requested — try again after they approve.');
      } else {
        toastError(body?.message || 'Could not start the call.');
      }
    } finally {
      setCallingBack(false);
    }
  }

  async function handleCallListItemCallBack(call: CallRecord) {
    const contactId = call.contact?.id;
    const phone = call.contact?.phone || call.fromPhone;
    const conversationId = call.conversation?.id;
    const contactName = call.contact?.name;
    setCallingBackId(call.id);
    beginOutboundDialing({ contactName, phone, conversationId });
    try {
      const sdpOffer = await createAgentOffer();
      if (!sdpOffer) throw new Error('Microphone access is required to make calls.');

      const { data } = await callingApi.callback({
        contactId,
        phone,
        conversationId,
        sdpOffer,
      });
      const callId = (data.data as { call?: { id: string } })?.call?.id;
      if (callId) {
        setActiveCallId(callId);
        beginOutboundLiveCall({
          callId,
          contactName,
          phone,
          conversationId,
          status: 'CONNECTING',
        });
        navigate(`/calls/${callId}`);
        void pollSdpAnswer(callId);
      } else {
        clearOutboundLiveCall();
        toastError('Call started but no call page was returned.');
      }
    } catch (err: unknown) {
      clearOutboundLiveCall();
      cleanupAgentCall();
      const body = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })
        ?.response?.data?.error;
      if (body?.code === 'CALL_PERMISSION_REQUIRED' || body?.code === 'CALL_PERMISSION_REQUESTED') {
        toastSuccess(body?.message || 'Call permission requested — try again after they approve.');
      } else {
        toastError(body?.message || 'Could not start the call.');
      }
    } finally {
      setCallingBackId(null);
    }
  }

  async function handleOrgCallingAiChange(enabled: boolean) {
    if (orgCallingAiSavingRef.current) return;
    const saveGen = ++orgCallingAiSaveGenRef.current;
    const previous = orgCallingAiEnabled;
    setOrgCallingAiEnabled(enabled);
    setOrgCallingAiSaving(true);
    orgCallingAiSavingRef.current = true;
    try {
      const { data } = await aiBotApi.setCallingAi(enabled);
      const saved = data.data?.callingAiEnabled;
      if (saveGen === orgCallingAiSaveGenRef.current && typeof saved === 'boolean') {
        setOrgCallingAiEnabled(saved);
      }
      void loadCalls();
      toastSuccess(enabled ? 'AI calling on' : 'AI calling off', { id: 'org-calling-ai' });
    } catch {
      if (saveGen === orgCallingAiSaveGenRef.current) {
        setOrgCallingAiEnabled(previous);
      }
      toastError('Could not update AI calling.', { id: 'org-calling-ai' });
    } finally {
      if (saveGen === orgCallingAiSaveGenRef.current) {
        setOrgCallingAiSaving(false);
        orgCallingAiSavingRef.current = false;
      }
    }
  }

  async function handleCallingAiChange(enabled: boolean) {
    const contactId = selectedCall?.contact?.id;
    if (!contactId || !selectedCall || callingAiSaving) return;
    if (orgCallingAiEnabled) {
      toastError('Global AI calling is on — turn it off from the banner above to change pickup for this person.');
      return;
    }
    const previous = selectedCall.contact?.callingAiEnabled !== false;
    setCallingAiSaving(true);
    setCalls((prev) =>
      prev.map((call) =>
        call.contact?.id === contactId
          ? { ...call, contact: { ...call.contact, callingAiEnabled: enabled } }
          : call
      )
    );
    try {
      await contactApi.update(contactId, { callingAiEnabled: enabled });
      toastSuccess(enabled ? 'AI answers this person' : 'Human pickup for this person', {
        id: 'contact-calling-ai',
      });
    } catch {
      setCalls((prev) =>
        prev.map((call) =>
          call.contact?.id === contactId
            ? { ...call, contact: { ...call.contact, callingAiEnabled: previous } }
            : call
        )
      );
      toastError('Could not update calling AI for this person.');
    } finally {
      setCallingAiSaving(false);
    }
  }

  const selectedTranscript = normalizeTranscript(selectedCall?.transcript);
  const listFiltered = Boolean(search.trim() || chip);
  const allVisibleSelected = calls.length > 0 && calls.every((call) => selectedIds.has(call.id));
  const selectionBar =
    selectionMode && selectedIds.size > 0 ? (
      <CallsBulkBar
        count={selectedIds.size}
        allVisibleSelected={allVisibleSelected}
        busy={bulkBusy}
        onSelectAll={toggleSelectAllVisible}
        onDelete={() => {
          if (selectedIds.size > 50) {
            toastError('Select up to 50 calls at a time.');
            return;
          }
          setBulkDeleteOpen(true);
        }}
        onClear={clearSelection}
      />
    ) : null;

  return (
    <InboxGlassTipProvider>
    <PageShell inbox>
      <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden sm:gap-[var(--density-stack-gap)]">
        {orgCallingAiEnabled !== null ? (
          <div className="shrink-0 max-md:px-3 max-md:pt-3">
            <CallingAiToggleBanner
              enabled={orgCallingAiEnabled}
              saving={orgCallingAiSaving}
              canToggle={canManageTeam}
              onChange={(next) => void handleOrgCallingAiChange(next)}
              answeringCallBotId={answeringCallBotId}
              callBots={callBots}
              botsLoading={callBotsLoading}
              botAssigning={callBotAssigning}
              onSelectBot={(botId) => void selectCallBot(botId)}
              hasBots={callBots.length > 0}
            />
          </div>
        ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="inbox-shell relative flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden md:rounded-2xl">
        {/* List pane */}
        <div
          className={`relative flex h-full min-h-0 w-full flex-col border-r border-neutral-200 dark:border-neutral-800 md:w-[300px] lg:w-[340px] ${
            selectedCall ? 'hidden md:flex' : 'flex'
          }`}
        >
          <CallFiltersBar
            search={search}
            searchInputRef={searchInputRef}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            chip={chip}
            onChipChange={(v) => {
              setChip(v);
              setPage(1);
            }}
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {selectionBar}
            {listLoading ? (
              <CallsListSkeleton />
            ) : calls.length === 0 ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <CallsListEmpty filtered={listFiltered} />
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {calls.map((call) => {
                      const outbound = call.direction === 'BUSINESS_INITIATED';
                      const phone = call.contact?.phone || (outbound ? call.toPhone : call.fromPhone);
                      return (
                        <CallListItem
                          key={call.id}
                          name={call.contact?.name}
                          phone={phone}
                          status={call.status}
                          direction={call.direction}
                          handler={call.handler}
                          durationSeconds={call.durationSeconds}
                          preview={transcriptPreview(call.transcript)}
                          createdAt={call.createdAt}
                          botName={call.aiBot?.name}
                          agentName={call.assignedAgent?.name}
                          selected={selectedCallId === call.id}
                          onSelect={() =>
                            selectionMode ? toggleSelect(call.id) : handleSelectCall(call)
                          }
                          onContextMenu={(e) => openCallContextMenu(e, call)}
                          onCallBack={
                            !selectionMode && !isActiveCallStatus(call.status)
                              ? () => void handleCallListItemCallBack(call)
                              : undefined
                          }
                          callingBack={callingBackId === call.id}
                          selectable={selectionMode}
                          checked={selectedIds.has(call.id)}
                          onToggleSelect={() => toggleSelect(call.id)}
                        />
                      );
                    })}
                  </div>
                </div>
                {totalCalls > 0 && (
                  <CallsPaginationFooter
                    page={page}
                    pageSize={pageSize}
                    total={totalCalls}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Stage pane — hidden on mobile when list is showing. */}
        <div
          className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            selectedCall ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedCall ? (
            <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-neutral-950">
              <CallDetailView
                name={selectedCall.contact?.name}
                phone={selectedCall.contact?.phone || selectedCall.fromPhone}
                status={selectedCall.status}
                createdAt={selectedCall.createdAt}
                durationSeconds={selectedCall.durationSeconds}
                handler={selectedCall.handler}
                botName={selectedCall.aiBot?.name}
                agentName={selectedCall.assignedAgent?.name}
                conversationId={selectedCall.conversation?.id}
                contactId={selectedCall.contact?.id}
                callingAiEnabled={
                  orgCallingAiEnabled || selectedCall.contact?.callingAiEnabled === true
                }
                globalCallingLocked={Boolean(orgCallingAiEnabled)}
                onCallingAiChange={(enabled) => void handleCallingAiChange(enabled)}
                callingAiSaving={callingAiSaving}
                answeringCallBotId={answeringCallBotId}
                callBots={callBots}
                botsLoading={callBotsLoading}
                botAssigning={callBotAssigning}
                onSelectCallBot={(botId) => void selectCallBot(botId)}
                transcript={selectedTranscript}
                summary={selectedCall.metadata?.summary || null}
                onBack={() => {
                  setSelectedCallId(null);
                  navigate('/calls');
                }}
                onOpenDetails={() => toggleDetails('notes')}
                onEndCall={isActiveCallStatus(selectedCall.status) ? () => void handleTerminate() : undefined}
                onCallBack={!isActiveCallStatus(selectedCall.status) ? () => void handleCallBack() : undefined}
                callingBack={callingBack}
                ending={ending}
                direction={selectedCall.direction}
              />
              <CallDetailsPanel
                callId={selectedCall.id}
                notes={internalNotes}
                currentUserId={user?.id}
                onNotesChange={setInternalNotes}
                onConversationLinked={(conversationId) => {
                  setCalls((prev) =>
                    prev.map((call) =>
                      call.id === selectedCall.id
                        ? { ...call, conversation: { id: conversationId } }
                        : call
                    )
                  );
                }}
                panelOpen={detailsPanelOpen}
                onPanelOpenChange={setDetailsPanelOpen}
                focusSection={detailsFocusSection}
                overlayOpen={detailsOverlay.open}
                overlaySection={detailsOverlay.section}
                onOverlayClose={() => setDetailsOverlay({ open: false })}
              />
            </div>
          ) : (
            <CallsSelectEmpty />
          )}
        </div>

        </div>
      </div>
      </div>

      <CallContextMenu
        open={Boolean(callMenu && contextMenuCall)}
        x={callMenu?.x ?? 0}
        y={callMenu?.y ?? 0}
        call={contextMenuCall}
        selectionMode={selectionMode}
        isCallSelected={Boolean(contextMenuCall && selectedIds.has(contextMenuCall.id))}
        allVisibleSelected={allVisibleSelected}
        onClose={() => setCallMenu(null)}
        onSelectThis={() => {
          if (contextMenuCall) selectCall(contextMenuCall.id);
        }}
        onDeselectThis={() => {
          if (contextMenuCall) deselectCall(contextMenuCall.id);
        }}
        onSelectAll={toggleSelectAllVisible}
        onClearSelection={clearSelection}
        onDelete={() => {
          if (contextMenuCall) setDeleteCallTarget(contextMenuCall);
          setCallMenu(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteCallTarget)}
        onClose={() => {
          if (!deletingCall) setDeleteCallTarget(null);
        }}
        onConfirm={() => void handleDeleteCall()}
        title="Delete this call?"
        description={
          deleteCallTarget
            ? `The call with “${deleteCallTarget.contact?.name || formatPhoneDisplay(deleteCallTarget.contact?.phone || deleteCallTarget.fromPhone)}” will be permanently removed from your call history.`
            : 'This call will be permanently removed from your call history.'
        }
        details={['The transcript, duration, and notes for this call are deleted.']}
        confirmLabel="Delete call"
        variant="danger"
        loading={deletingCall}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => {
          if (!bulkBusy) setBulkDeleteOpen(false);
        }}
        onConfirm={() => void handleBulkDelete()}
        title={`Delete ${selectedIds.size} call${selectedIds.size === 1 ? '' : 's'}?`}
        description="The selected calls will be permanently removed from your call history."
        details={['Transcripts, duration, and notes for these calls are deleted.']}
        confirmLabel={selectedIds.size === 1 ? 'Delete call' : 'Delete calls'}
        variant="danger"
        loading={bulkBusy}
      />
    </PageShell>
    </InboxGlassTipProvider>
  );
}

function buildCallsPageButtons(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(pageCount);
  for (let i = page - 1; i <= page + 1; i++) {
    if (i >= 1 && i <= pageCount) pages.add(i);
  }
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= pageCount - 2) {
    pages.add(pageCount - 1);
    pages.add(pageCount - 2);
    pages.add(pageCount - 3);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'ellipsis'> = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push('ellipsis');
    out.push(n);
    prev = n;
  }
  return out;
}

interface CallsPaginationFooterProps {
  page: number;
  pageSize: PageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

function CallsPaginationFooter({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: CallsPaginationFooterProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, pageCount);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);
  const pageButtons = buildCallsPageButtons(safePage, pageCount);

  return (
    <div className="hidden shrink-0 border-t border-neutral-100 px-2.5 py-2 md:block dark:border-neutral-800/80">
      <div className="flex min-w-0 flex-nowrap items-center justify-between gap-2 max-[260px]:flex-wrap">
        <p
          className="min-w-0 flex-1 truncate text-[11px] font-medium tabular-nums text-theme-muted"
          title={`Showing ${rangeStart.toLocaleString()} – ${rangeEnd.toLocaleString()} of ${total.toLocaleString()} calls`}
        >
          Showing {rangeStart.toLocaleString()} – {rangeEnd.toLocaleString()} of{' '}
          {total.toLocaleString()} calls
        </p>
        <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Previous page"
            className={`flex h-7 w-7 items-center justify-center rounded-md border border-theme-border text-theme-secondary transition enabled:hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING_CLASS}`}
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          {pageButtons.map((item, idx) =>
            item === 'ellipsis' ? (
              <span
                key={`e-${idx}`}
                className="flex h-7 min-w-5 items-center justify-center px-0.5 text-[11px] font-semibold text-theme-muted"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === safePage ? 'page' : undefined}
                className={`flex h-7 min-w-6 items-center justify-center rounded-md px-1 text-[11px] font-bold tabular-nums transition ${FOCUS_RING_CLASS} ${
                  item === safePage
                    ? 'bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 text-white shadow-[0_2px_6px_rgba(37,211,102,0.35)]'
                    : 'border border-transparent text-theme-secondary hover:bg-theme-subtle'
                }`}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
            className={`flex h-7 w-7 items-center justify-center rounded-md border border-theme-border text-theme-secondary transition enabled:hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING_CLASS}`}
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
