import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings, Trash2 } from 'lucide-react';
import { callingApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import CallDetailView from '../components/calls/CallDetailView';
import CallFiltersBar from '../components/calls/CallFiltersBar';
import CallListItem from '../components/calls/CallListItem';
import { CallsListEmpty, CallsSelectEmpty } from '../components/calls/CallPlaceholder';
import CallingSettingsStage from '../components/calls/CallingSettingsStage';
import {
  formatPhoneDisplay,
  isActiveCallStatus,
  normalizeTranscript,
  transcriptPreview,
} from '../components/calls/callUtils';
import ContextMenu from '../components/ui/ContextMenu';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { toastError, toastSuccess } from '../utils/toast';
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
  contact?: { id?: string; name?: string | null; phone: string };
  aiBot?: { name: string } | null;
  assignedAgent?: { id: string; name: string } | null;
  conversation?: { id: string } | null;
}

interface CallingStatus {
  configured: boolean;
  aiAutoAnswer: boolean;
  activeCalls: number;
  whatsappConnected: boolean;
  phoneNumber?: string | null;
  sarvamStt?: boolean;
  sarvamTts?: boolean;
  brainProvider?: 'sarvam' | 'azure' | null;
  callingEnabled?: boolean;
  enableHints?: string[];
  voiceReady?: boolean;
  callingSettings?: { calling?: { status?: string } } | null;
  orgCallingSettings?: Record<string, unknown>;
}

const CALLS_CACHE_KEY = 'calls';
type CallsNumberCache = {
  calls: CallRecord[];
  totalCalls: number;
  page: number;
  search: string;
  chip: string;
  selectedCallId: string | null;
  notes: string;
  railPanel: string | null;
};

type RailPanel = 'settings' | null;

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
  return { ...raw, transcript: normalizeTranscript(raw.transcript) };
}

export default function CallsPage() {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const { callId: routeCallId } = useParams();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [status, setStatus] = useState<CallingStatus | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [callingBack, setCallingBack] = useState(false);
  const [callingBackId, setCallingBackId] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(routeCallId ?? null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [totalCalls, setTotalCalls] = useState(0);
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('');
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const notesDirtyRef = useRef(false);
  const [railPanel, setRailPanel] = useState<RailPanel>(null);
  const [callMenu, setCallMenu] = useState<{ x: number; y: number; callId: string } | null>(null);
  const [deleteCallTarget, setDeleteCallTarget] = useState<CallRecord | null>(null);
  const [deletingCall, setDeletingCall] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('panel') === 'settings') {
      setRailPanel('settings');
    }
  }, [searchParams]);
  const [analytics, setAnalytics] = useState<{
    today: number;
    missed: number;
    total: number;
    aiAnswered: number;
    agentAnswered: number;
    avgDurationSec: number;
  } | null>(null);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const callsSnapshotRef = useRef<CallsNumberCache>({
    calls: [],
    totalCalls: 0,
    page: 1,
    search: '',
    chip: '',
    selectedCallId: null,
    notes: '',
    railPanel: null,
  });

  callsSnapshotRef.current = {
    calls,
    totalCalls,
    page,
    search,
    chip,
    selectedCallId,
    notes,
    railPanel,
  };
  notesDirtyRef.current = notesDirty;

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
    const requestNumberId = activeNumber.id;
    try {
      const [statusRes, analyticsRes] = await Promise.all([
        callingApi.status(),
        callingApi.analytics(7).catch(() => null),
        loadCalls(),
      ]);
      if (requestNumberId !== activeNumberIdRef.current) return;
      setStatus(statusRes.data.data);
      const analyticsData = analyticsRes?.data?.data as
        | {
            today?: number;
            missed?: number;
            total?: number;
            aiAnswered?: number;
            agentAnswered?: number;
            avgDurationSec?: number;
          }
        | undefined;
      if (analyticsData) {
        setAnalytics({
          today: analyticsData.today ?? 0,
          missed: analyticsData.missed ?? 0,
          total: analyticsData.total ?? 0,
          aiAnswered: analyticsData.aiAnswered ?? 0,
          agentAnswered: analyticsData.agentAnswered ?? 0,
          avgDurationSec: analyticsData.avgDurationSec ?? 0,
        });
      }
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
    async (callId: string, opts?: { syncNotes?: boolean }) => {
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
        // Only overwrite the notes box when explicitly asked (save/select/deep-link).
        // The 3s live poll must never clobber unsaved edits.
        if (opts?.syncNotes === true) {
          setNotes((parsed.metadata as { notes?: string })?.notes || '');
          setNotesDirty(false);
        }
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
      setNotes('');
      setNotesDirty(false);
      setCallMenu(null);
      setDeleteCallTarget(null);
      setRailPanel(null);
      navigate('/calls');
      setListLoading(true);
      void loadRef.current();
      return;
    }

    setSelectedCallId(null);
    setCalls([]);
    setTotalCalls(0);
    setNotes('');
    setNotesDirty(false);
    setPage(1);
    setSearch('');
    setChip('');
    setRailPanel(null);
    setCallMenu(null);
    setDeleteCallTarget(null);
    navigate('/calls');
    void loadRef.current();
  });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (routeCallId) {
      setSelectedCallId(routeCallId);
      setNotes('');
      setNotesDirty(false);
      void loadCallDetail(routeCallId, { syncNotes: true });
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

  const { state: socketState } = useSocket((event, data) => {
    if (event === 'call:incoming') {
      const payload = data as { fromPhone: string; contactName?: string };
      toastSuccess(`Incoming call from ${payload.contactName || payload.fromPhone}`);
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
    if (event === 'call:deleted') {
      const payload = data as { callId: string };
      if (!payload.callId) return;
      setCalls((prev) => prev.filter((c) => c.id !== payload.callId));
      setTotalCalls((prev) => Math.max(0, prev - 1));
      setSelectedCallId((prev) => (prev === payload.callId ? null : prev));
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
      setRailPanel(null);
      setSelectedCallId(call.id);
      setNotes('');
      setNotesDirty(false);
      navigate(`/calls/${call.id}`);
      void loadCallDetail(call.id, { syncNotes: true });
    },
    [loadCallDetail, navigate]
  );

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
      if (routeCallId === deleteCallTarget.id) navigate('/calls');
      setDeleteCallTarget(null);
      toastSuccess('Call deleted.');
    } catch {
      toastError('Could not delete the call.');
    } finally {
      setDeletingCall(false);
    }
  }, [deleteCallTarget, navigate, routeCallId]);

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

  async function handleSaveNotes() {
    if (!selectedCall) return;
    setSavingNotes(true);
    try {
      await callingApi.updateNotes(selectedCall.id, notes);
      setNotesDirty(false);
      toastSuccess('Notes saved.');
      setNotes('');
      // Refresh the call record (status/transcript) without re-filling the notes box.
      await loadCallDetail(selectedCall.id);
    } catch {
      toastError('Could not save notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  const toggleRail = (panel: RailPanel) => {
    setRailPanel((prev) => (prev === panel ? null : panel));
  };

  const selectedTranscript = normalizeTranscript(selectedCall?.transcript);

  const liveCount = status?.activeCalls ?? 0;
  const callsToday = analytics?.today ?? 0;
  const missedCount = analytics?.missed ?? 0;

  return (
    <PageShell inbox>
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="inbox-shell relative flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden md:rounded-2xl">
        {/* List pane */}
        <div
          className={`relative flex h-full min-h-0 w-full flex-col border-r border-neutral-200 dark:border-neutral-800 md:w-[300px] lg:w-[340px] ${
            railPanel === 'settings' ? 'hidden' : selectedCall ? 'hidden md:flex' : 'flex'
          }`}
        >
          <CallFiltersBar
            search={search}
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
            {listLoading ? (
              <CallsListSkeleton />
            ) : calls.length === 0 ? (
              <CallsListEmpty />
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
                          onSelect={() => handleSelectCall(call)}
                          onContextMenu={(e) => openCallContextMenu(e, call)}
                          onCallBack={!isActiveCallStatus(call.status) ? () => void handleCallListItemCallBack(call) : undefined}
                          callingBack={callingBackId === call.id}
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

        {/* Stage pane — hidden on mobile when list is showing.
            When the Settings rail is open, this becomes the calling
            customization (replacing the chat), so it must stay visible. */}
        <div
          className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            selectedCall || railPanel === 'settings' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {railPanel === 'settings' ? (
            <CallingSettingsStage onClose={() => setRailPanel(null)} />
          ) : selectedCall ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-950">
              <CallDetailView
                name={selectedCall.contact?.name}
                phone={selectedCall.contact?.phone || selectedCall.fromPhone}
                status={selectedCall.status}
                createdAt={selectedCall.createdAt}
                durationSeconds={selectedCall.durationSeconds}
                direction={selectedCall.direction}
                handler={selectedCall.handler}
                botName={selectedCall.aiBot?.name}
                agentName={selectedCall.assignedAgent?.name}
                conversationId={selectedCall.conversation?.id}
                transcript={selectedTranscript}
                summary={selectedCall.metadata?.summary || null}
                notes={notes}
                onNotesChange={(value) => {
                  setNotes(value);
                  setNotesDirty(true);
                }}
                onSaveNotes={() => void handleSaveNotes()}
                savingNotes={savingNotes}
                notesDirty={notesDirty}
                onBack={() => {
                  setSelectedCallId(null);
                  navigate('/calls');
                }}
                onEndCall={isActiveCallStatus(selectedCall.status) ? () => void handleTerminate() : undefined}
                onCallBack={!isActiveCallStatus(selectedCall.status) ? () => void handleCallBack() : undefined}
                callingBack={callingBack}
                ending={ending}
              />
            </div>
          ) : (
            <CallsSelectEmpty
              liveConnected={socketState.status === 'connected'}
              liveCount={liveCount}
              callsToday={callsToday}
              missedCount={missedCount}
              totalCount={analytics?.total ?? 0}
              aiAnswered={analytics?.aiAnswered ?? 0}
              agentAnswered={analytics?.agentAnswered ?? 0}
              avgDurationSec={analytics?.avgDurationSec ?? 0}
              rangeDays={7}
            />
          )}
        </div>

        {/* Customize rail — desktop only */}
        <div className={`w-[72px] shrink-0 flex-col border-l border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/50 ${railPanel === 'settings' ? 'hidden' : 'hidden md:flex'}`}>
          <RailIconButton
            icon={Settings}
            label="Settings"
            active={railPanel === 'settings'}
            onClick={() => toggleRail('settings')}
          />
        </div>
        </div>
      </div>

      <ContextMenu
        open={Boolean(callMenu && contextMenuCall)}
        x={callMenu?.x ?? 0}
        y={callMenu?.y ?? 0}
        onClose={() => setCallMenu(null)}
        items={[
          {
            id: 'delete-call',
            label: 'Delete call',
            description: 'Remove this call from history',
            icon: Trash2,
            danger: true,
            onClick: () => {
              if (contextMenuCall) setDeleteCallTarget(contextMenuCall);
              setCallMenu(null);
            },
          },
        ]}
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
    </PageShell>
  );
}

interface RailIconButtonProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  label: string;
  active: boolean;
  onClick: () => void;
}

function RailIconButton({ icon: Icon, label, active, onClick }: RailIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex w-full flex-col items-center gap-1 border-b border-neutral-200 px-1 py-3.5 transition-colors dark:border-neutral-800 ${
        active
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.85} />
      <span className={`text-[10px] font-bold leading-none ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-500'}`}>
        {label}
      </span>
    </button>
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
    <div className="shrink-0 border-t border-neutral-100 px-2.5 py-2 dark:border-neutral-800/80">
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
