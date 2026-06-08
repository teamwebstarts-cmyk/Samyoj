import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { callingApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import CallAnalyticsPanel, { type CallAnalyticsData } from '../components/calls/CallAnalyticsPanel';
import CallDetailView from '../components/calls/CallDetailView';
import CallFiltersBar from '../components/calls/CallFiltersBar';
import CallInfoPanel from '../components/calls/CallInfoPanel';
import CallListItem from '../components/calls/CallListItem';
import CallOverviewPanel from '../components/calls/CallOverviewPanel';
import CallPlaceholder from '../components/calls/CallPlaceholder';
import CallSetupProgress from '../components/calls/CallSetupProgress';
import CallsPageHeader from '../components/calls/CallsPageHeader';
import { computeCallStats } from '../components/calls/CallStatsSummary';
import {
  isActiveCallStatus,
  normalizeTranscript,
  transcriptPreview,
} from '../components/calls/callUtils';
import { toastError, toastSuccess } from '../utils/toast';
import LoadingState from '../components/ui/LoadingState';
import PageShell from '../components/ui/PageShell';
import Pagination from '../components/ui/Pagination';
import AppTextarea from '../components/ui/AppTextarea';
import AppButton from '../components/ui/AppButton';

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
}

const PAGE_SIZE = 25;

function parseCall(raw: CallRecord): CallRecord {
  return { ...raw, transcript: normalizeTranscript(raw.transcript) };
}

export default function CallsPage() {
  const { callId: routeCallId } = useParams();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [status, setStatus] = useState<CallingStatus | null>(null);
  const [analytics, setAnalytics] = useState<CallAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [ending, setEnding] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(routeCallId ?? null);
  const [page, setPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [handlerFilter, setHandlerFilter] = useState('');
  const [notes, setNotes] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);

  const loadCalls = useCallback(async () => {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(PAGE_SIZE),
    };
    if (search.trim()) params.search = search.trim();
    if (statusFilter) params.status = statusFilter;
    if (handlerFilter) params.handler = handlerFilter;

    const { data } = await callingApi.list(params);
    const payload = data.data as {
      items: CallRecord[];
      pagination: { total: number };
    };
    setCalls(payload.items.map(parseCall));
    setTotalCalls(payload.pagination.total);
  }, [page, search, statusFilter, handlerFilter]);

  const load = useCallback(async () => {
    try {
      const [statusRes, , analyticsRes] = await Promise.all([
        callingApi.status(),
        loadCalls(),
        callingApi.analytics(30),
      ]);
      setStatus(statusRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch {
      toastError('Could not load calls. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [loadCalls]);

  const loadCallDetail = useCallback(async (callId: string) => {
    try {
      const { data } = await callingApi.get(callId);
      const parsed = parseCall(data.data as CallRecord);
      setCalls((prev) => {
        const exists = prev.some((c) => c.id === callId);
        return exists ? prev.map((c) => (c.id === callId ? parsed : c)) : [parsed, ...prev];
      });
      setNotes((parsed.metadata as { notes?: string })?.notes || '');
      return parsed;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCalls().catch(() => undefined);
  }, [loadCalls]);

  useEffect(() => {
    if (routeCallId) {
      setSelectedCallId(routeCallId);
      void loadCallDetail(routeCallId);
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
      toastError(body?.message || 'Could not enable calls. Check your account in Meta Business Manager.');
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

  const callStats = useMemo(() => computeCallStats(calls), [calls]);

  const completedToday = calls.filter((c) => {
    const d = new Date(c.createdAt);
    return d.toDateString() === new Date().toDateString() && ['COMPLETED', 'TERMINATED'].includes(c.status);
  }).length;

  const selectedCall = useMemo(
    () => (selectedCallId ? calls.find((c) => c.id === selectedCallId) ?? null : null),
    [calls, selectedCallId]
  );

  useEffect(() => {
    if (routeCallId) return;
    if (calls.length === 0) {
      setSelectedCallId(null);
      return;
    }
    if (!selectedCallId || !calls.some((c) => c.id === selectedCallId)) {
      setSelectedCallId(calls[0].id);
    }
  }, [calls, selectedCallId, routeCallId]);

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
      navigate(`/calls/${call.id}`);
      void loadCallDetail(call.id);
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
      toastSuccess('Notes saved.');
      await loadCallDetail(selectedCall.id);
    } catch {
      toastError('Could not save notes.');
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <LoadingState label="Loading calls..." />
      </PageShell>
    );
  }

  const overviewStatus = {
    whatsappConnected: Boolean(status?.whatsappConnected),
    callingEnabled: Boolean(callingEnabled),
    phoneNumber: status?.phoneNumber,
    deepgram: status?.deepgram,
    googleTts: status?.googleTts,
    azureOpenAI: status?.azureOpenAI,
    aiAutoAnswer: status?.aiAutoAnswer,
    voiceReady: isReady,
  };

  const selectedTranscript = normalizeTranscript(selectedCall?.transcript);

  return (
    <PageShell fullBleed className="gap-3 sm:gap-4">
      <CallsPageHeader
        phoneNumber={status?.phoneNumber}
        isReady={isReady}
        liveCount={liveCount}
        callsToday={analytics?.today ?? completedToday}
        totalCalls={analytics?.total ?? callStats.total}
        onToggleAnalytics={() => setShowAnalytics((v) => !v)}
        showAnalytics={showAnalytics}
      />

      {showAnalytics && <CallAnalyticsPanel data={analytics} />}

      <CallSetupProgress
        whatsappConnected={Boolean(status?.whatsappConnected)}
        callingEnabled={Boolean(callingEnabled)}
        botReady={botReady}
        onEnableCalling={() => void handleEnableCalling()}
        enabling={enabling}
        enableHints={status?.enableHints}
      />

      <div className="inbox-shell flex min-h-0 flex-1 overflow-hidden md:rounded-2xl">
        <div
          className={`relative flex w-full flex-col border-neutral-200/80 md:w-[300px] md:border-r lg:w-[340px] ${
            selectedCall ? 'hidden md:flex' : 'flex'
          }`}
        >
          <CallFiltersBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            status={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            handler={handlerFilter}
            onHandlerChange={(v) => {
              setHandlerFilter(v);
              setPage(1);
            }}
          />

          <div className="shrink-0 border-b border-neutral-100 bg-gradient-to-b from-violet-50/60 via-white to-white px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">Call history</p>
                <p className="mt-0.5 text-[13px] font-extrabold text-neutral-900">
                  {calls.length === 0 ? 'No calls yet' : `${calls.length} on this page`}
                </p>
              </div>
              {liveCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-whatsapp-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-[0_2px_10px_rgba(37,211,102,0.35)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  {liveCount} live
                </span>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {calls.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <CallPlaceholder variant="empty" />
                <div className="border-t border-neutral-100 md:hidden">
                  <CallInfoPanel compact phoneNumber={status?.phoneNumber} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 divide-y divide-neutral-100/80 overflow-y-auto">
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
                {totalCalls > PAGE_SIZE && (
                  <div className="shrink-0 border-t border-neutral-100 p-2">
                    <Pagination
                      page={page}
                      pageSize={PAGE_SIZE}
                      total={totalCalls}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div
          className={`min-w-0 flex-1 flex-col bg-white ${
            selectedCall ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedCall ? (
            <>
              <CallDetailView
                name={selectedCall.contact?.name}
                phone={selectedCall.contact?.phone || selectedCall.fromPhone}
                status={selectedCall.status}
                createdAt={selectedCall.createdAt}
                durationSeconds={selectedCall.durationSeconds}
                botName={selectedCall.aiBot?.name}
                agentName={selectedCall.assignedAgent?.name}
                conversationId={selectedCall.conversation?.id}
                transcript={selectedTranscript}
                onBack={() => {
                  setSelectedCallId(null);
                  navigate('/calls');
                }}
                onEndCall={isActiveCallStatus(selectedCall.status) ? () => void handleTerminate() : undefined}
                ending={ending}
              />
              {!isActiveCallStatus(selectedCall.status) && (
                <div className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-3">
                  <AppTextarea
                    label="Internal notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Add notes about this call..."
                  />
                  <div className="mt-2 flex justify-end">
                    <AppButton size="sm" loading={savingNotes} onClick={() => void handleSaveNotes()}>
                      Save notes
                    </AppButton>
                  </div>
                </div>
              )}
            </>
          ) : (
            <CallOverviewPanel
              status={overviewStatus}
              liveCount={liveCount}
              callStats={callStats}
              hasCalls={calls.length > 0}
            />
          )}
        </div>
      </div>
    </PageShell>
  );
}
