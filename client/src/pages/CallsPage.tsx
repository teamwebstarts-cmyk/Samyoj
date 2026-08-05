import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BarChart3, BookOpen, HelpCircle, Settings, X } from 'lucide-react';
import { callingApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import CallDetailView from '../components/calls/CallDetailView';
import CallFiltersBar from '../components/calls/CallFiltersBar';
import CallListItem from '../components/calls/CallListItem';
import { CallsListEmpty, CallsSelectEmpty } from '../components/calls/CallPlaceholder';
import CallsPageHeader from '../components/calls/CallsPageHeader';
import CallsSetupSheet from '../components/calls/CallsSetupSheet';
import {
  isActiveCallStatus,
  normalizeTranscript,
  transcriptPreview,
} from '../components/calls/callUtils';
import { toastError, toastSuccess } from '../utils/toast';
import LoadingState from '../components/ui/LoadingState';
import PageShell from '../components/ui/PageShell';
import Pagination from '../components/ui/Pagination';
import AppButton from '../components/ui/AppButton';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';

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
  metadata?: { notes?: string } | null;
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
  deepgram?: boolean;
  googleTts?: boolean;
  azureOpenAI?: boolean;
  callingEnabled?: boolean;
  enableHints?: string[];
  voiceReady?: boolean;
  callingSettings?: { calling?: { status?: string } } | null;
  orgCallingSettings?: Record<string, unknown>;
}

const PAGE_SIZE = 25;
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

type RailPanel = 'settings' | 'insights' | 'help' | null;

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
  const { callId: routeCallId } = useParams();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [status, setStatus] = useState<CallingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [ending, setEnding] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(routeCallId ?? null);
  const [page, setPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState('');
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const notesDirtyRef = useRef(false);
  const [railPanel, setRailPanel] = useState<RailPanel>(null);
  const [setupSheetOpen, setSetupSheetOpen] = useState(false);
  const [insights, setInsights] = useState<{ today: number; missed: number; aiAnswered: number } | null>(
    null
  );

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

  const loadCalls = useCallback(async () => {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(PAGE_SIZE),
    };
    if (search.trim()) params.search = search.trim();
    const mapped = chipToParams(chip);
    if (mapped.status) params.status = mapped.status;
    if (mapped.handler) params.handler = mapped.handler;
    if (mapped.direction) params.direction = mapped.direction;

    const { data } = await callingApi.list(params);
    const payload = data.data as {
      items: CallRecord[];
      pagination: { total: number };
    };
    setCalls(payload.items.map(parseCall));
    setTotalCalls(payload.pagination.total);
  }, [page, search, chip]);

  const load = useCallback(async () => {
    try {
      const [statusRes, analyticsRes] = await Promise.all([
        callingApi.status(),
        callingApi.analytics(7).catch(() => null),
        loadCalls(),
      ]);
      setStatus(statusRes.data.data);
      const analytics = analyticsRes?.data?.data as
        | { today?: number; missed?: number; aiAnswered?: number }
        | undefined;
      if (analytics) {
        setInsights({
          today: analytics.today ?? 0,
          missed: analytics.missed ?? 0,
          aiAnswered: analytics.aiAnswered ?? 0,
        });
      }
    } catch {
      toastError('Could not load calls. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [loadCalls]);

  const loadCallDetail = useCallback(async (callId: string, opts?: { syncNotes?: boolean }) => {
    try {
      const { data } = await callingApi.get(callId);
      const parsed = parseCall(data.data as CallRecord);
      setCalls((prev) => {
        const exists = prev.some((c) => c.id === callId);
        return exists ? prev.map((c) => (c.id === callId ? parsed : c)) : [parsed, ...prev];
      });
      if (opts?.syncNotes !== false) {
        setNotes((parsed.metadata as { notes?: string })?.notes || '');
        setNotesDirty(false);
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

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
      setSelectedCallId(cached.selectedCallId);
      setNotes(cached.notes);
      setRailPanel(cached.railPanel as RailPanel);
      setLoading(false);
      return;
    }

    setSelectedCallId(null);
    setNotes('');
    void loadRef.current();
  });

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (routeCallId) {
      setSelectedCallId(routeCallId);
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

  useSocket((event, data) => {
    if (event === 'call:incoming') {
      const payload = data as { fromPhone: string; contactName?: string };
      toastSuccess(`Incoming call from ${payload.contactName || payload.fromPhone}`);
      void load();
    }
    if (event === 'call:updated') void load();
    if (event === 'call:transcript') {
      const payload = data as { callId: string; transcript: unknown };
      if (payload.callId) applyTranscriptUpdate(payload.callId, payload.transcript);
    }
  });

  const handleEnableCalling = useCallback(async () => {
    setEnabling(true);
    try {
      await callingApi.enable();
      toastSuccess('Voice calls are now enabled on your WhatsApp number.');
      await load();
    } catch (err: unknown) {
      const body = (err as { response?: { data?: { error?: { message?: string; hints?: string[] } } } })
        ?.response?.data?.error;
      toastError(body?.message || 'Could not enable calls. Check your WhatsApp Business settings.');
      if (body?.hints?.length) {
        setStatus((prev) => (prev ? { ...prev, enableHints: body.hints } : prev));
      }
    } finally {
      setEnabling(false);
    }
  }, [load]);

  const callingEnabled = status?.callingEnabled ?? status?.callingSettings?.calling?.status === 'ENABLED';
  const botReady = Boolean(status?.configured);
  const isReady = Boolean(status?.voiceReady ?? (status?.whatsappConnected && botReady && callingEnabled));
  const liveCount = status?.activeCalls ?? 0;
  const callsToday = insights?.today ?? 0;

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

    void loadCallDetail(selectedCallId, { syncNotes: !notesDirtyRef.current });
    const timer = setInterval(() => {
      void loadCallDetail(selectedCallId, { syncNotes: !notesDirtyRef.current });
    }, 3000);
    return () => clearInterval(timer);
  }, [selectedCallId, selectedCall?.status, loadCallDetail, selectedCall]);

  const handleSelectCall = useCallback(
    (call: CallRecord) => {
      setSelectedCallId(call.id);
      setNotesDirty(false);
      navigate(`/calls/${call.id}`);
      void loadCallDetail(call.id, { syncNotes: true });
    },
    [loadCallDetail, navigate]
  );

  async function handleTerminate() {
    if (!selectedCall) return;
    setEnding(true);
    try {
      await callingApi.terminate(selectedCall.id);
      toastSuccess('Call ended.');
      await load();
      await loadCallDetail(selectedCall.id);
    } catch {
      toastError('Could not end the call.');
    } finally {
      setEnding(false);
    }
  }

  async function handleSaveNotes() {
    if (!selectedCall) return;
    setSavingNotes(true);
    try {
      await callingApi.updateNotes(selectedCall.id, notes);
      setNotesDirty(false);
      toastSuccess('Notes saved.');
      await loadCallDetail(selectedCall.id, { syncNotes: true });
    } catch {
      toastError('Could not save notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  const toggleRail = (panel: RailPanel) => {
    setRailPanel((prev) => (prev === panel ? null : panel));
  };

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading calls..." />
      </PageShell>
    );
  }

  const selectedTranscript = normalizeTranscript(selectedCall?.transcript);

  return (
    <PageShell className="space-y-3 sm:space-y-4">
      <CallsPageHeader
        phoneNumber={status?.phoneNumber}
        isReady={isReady}
        liveCount={liveCount}
        callsToday={callsToday}
        onOpenSetup={() => setSetupSheetOpen(true)}
      />

      {setupSheetOpen && (
        <CallsSetupSheet
          whatsappConnected={Boolean(status?.whatsappConnected)}
          callingEnabled={Boolean(callingEnabled)}
          botReady={botReady}
          onEnableCalling={() => void handleEnableCalling()}
          enabling={enabling}
          enableHints={status?.enableHints}
          onClose={() => setSetupSheetOpen(false)}
        />
      )}

      <div className="inbox-shell relative flex h-[min(720px,calc(100dvh-160px))] min-h-[min(520px,calc(100dvh-140px))] flex-row overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 sm:h-[min(680px,calc(100dvh-200px))] sm:min-h-[420px]">
        {/* List pane */}
        <div
          className={`relative flex h-full min-h-0 w-full flex-col border-r border-neutral-200 dark:border-neutral-800 md:w-[300px] lg:w-[340px] ${
            selectedCall ? 'hidden md:flex' : 'flex'
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
            {calls.length === 0 ? (
              <CallsListEmpty />
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {calls.map((call) => {
                      const phone = call.contact?.phone || call.fromPhone;
                      return (
                        <CallListItem
                          key={call.id}
                          name={call.contact?.name}
                          phone={phone}
                          status={call.status}
                          handler={call.handler}
                          durationSeconds={call.durationSeconds}
                          preview={transcriptPreview(call.transcript)}
                          createdAt={call.createdAt}
                          botName={call.aiBot?.name}
                          agentName={call.assignedAgent?.name}
                          selected={selectedCallId === call.id}
                          onSelect={() => handleSelectCall(call)}
                        />
                      );
                    })}
                  </div>
                </div>
                {totalCalls > 0 && (
                  <div className="shrink-0 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                    <Pagination
                      page={page}
                      pageSize={PAGE_SIZE}
                      total={totalCalls}
                      onPageChange={setPage}
                      itemLabel="calls"
                      className="!border-t-0"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stage pane — hidden on mobile when list is showing */}
        <div
          className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
            selectedCall ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedCall ? (
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
                ending={ending}
              />
            </div>
          ) : (
            <CallsSelectEmpty />
          )}
        </div>

        {/* Rail side panel — visible from md so tablet Settings icon isn't a dead control */}
        {railPanel && (
          <div className="absolute inset-y-0 right-[72px] z-20 flex w-[min(100%,300px)] flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950 md:static md:z-0 md:w-[260px] md:shadow-none lg:w-[280px]">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <p className="text-[13px] font-extrabold text-theme-fg">
                {railPanel === 'settings' ? 'Customize' : railPanel === 'insights' ? 'Insights' : 'Help'}
              </p>
              <button
                type="button"
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => setRailPanel(null)}
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {railPanel === 'settings' && (
                <div className="space-y-3">
                  <p className="text-[12px] font-medium leading-relaxed text-theme-muted">
                    Who answers, greetings, and call behavior live in Settings → Calling.
                  </p>
                  <Link to="/settings?tab=calling">
                    <AppButton className="w-full" size="sm">
                      <Settings className="h-3.5 w-3.5" />
                      Open call settings
                    </AppButton>
                  </Link>
                  <Link to="/ai-bot">
                    <AppButton variant="secondary" className="w-full" size="sm">
                      <BookOpen className="h-3.5 w-3.5" />
                      Edit AI personality
                    </AppButton>
                  </Link>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-left text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200"
                    onClick={() => {
                      setSetupSheetOpen(true);
                      setRailPanel(null);
                    }}
                  >
                    Setup checklist
                  </button>
                </div>
              )}
              {railPanel === 'insights' && (
                <div className="space-y-3">
                  <InsightStat label="Live now" value={String(liveCount)} />
                  <InsightStat label="Today" value={String(insights?.today ?? callsToday)} />
                  <InsightStat label="Missed (7d)" value={String(insights?.missed ?? '—')} />
                  <InsightStat label="AI handled (7d)" value={String(insights?.aiAnswered ?? '—')} />
                  <p className="pt-1 text-[11px] font-medium text-theme-muted">
                    Use Live / Missed / AI / Human chips to filter the list.
                  </p>
                </div>
              )}
              {railPanel === 'help' && (
                <div className="space-y-3 text-[12px] font-medium leading-relaxed text-theme-secondary">
                  <p>
                    <span className="font-bold text-theme-fg">Outbound</span> — call from Inbox without a tunnel.
                  </p>
                  <p>
                    <span className="font-bold text-theme-fg">Inbound</span> — callers need calling enabled on your WhatsApp number.
                  </p>
                  <p>
                    Train answers on <Link className="font-bold text-emerald-700 underline" to="/ai-bot">AI Bots → Train</Link> so voice and chat share one brain.
                  </p>
                  <button
                    type="button"
                    className="text-[12px] font-bold text-emerald-700 underline"
                    onClick={() => {
                      setSetupSheetOpen(true);
                      setRailPanel(null);
                    }}
                  >
                    Open setup guide
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Customize rail — desktop only */}
        <div className="hidden w-[72px] shrink-0 flex-col border-l border-neutral-200 bg-neutral-50/70 dark:border-neutral-800 dark:bg-neutral-900/50 md:flex">
          <RailIconButton
            icon={Settings}
            label="Settings"
            active={railPanel === 'settings'}
            onClick={() => toggleRail('settings')}
          />
          <RailIconButton
            icon={BarChart3}
            label="Insights"
            active={railPanel === 'insights'}
            onClick={() => toggleRail('insights')}
          />
          <RailIconButton
            icon={HelpCircle}
            label="Help"
            active={railPanel === 'help'}
            onClick={() => toggleRail('help')}
          />
        </div>
      </div>
    </PageShell>
  );
}

function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-900/50">
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums text-theme-fg">{value}</p>
    </div>
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
