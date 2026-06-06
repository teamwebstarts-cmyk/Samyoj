import { useCallback, useEffect, useMemo, useState } from 'react';
import { callingApi } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import CallDetailView from '../components/calls/CallDetailView';
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
import AppAlert from '../components/ui/AppAlert';
import LoadingState from '../components/ui/LoadingState';
import PageShell from '../components/ui/PageShell';

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
  createdAt: string;
  contact?: { name?: string | null; phone: string };
  aiBot?: { name: string } | null;
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

function parseCall(raw: CallRecord): CallRecord {
  return { ...raw, transcript: normalizeTranscript(raw.transcript) };
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [status, setStatus] = useState<CallingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [ending, setEnding] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const [statusRes, callsRes] = await Promise.all([callingApi.status(), callingApi.list()]);
      setStatus(statusRes.data.data);
      setCalls((callsRes.data.data as CallRecord[]).map(parseCall));
      setError('');
    } catch {
      setError('Could not load calls. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCallDetail = useCallback(async (callId: string) => {
    try {
      const { data } = await callingApi.get(callId);
      const parsed = parseCall(data.data as CallRecord);
      setCalls((prev) => prev.map((c) => (c.id === callId ? parsed : c)));
      return parsed;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyTranscriptUpdate = useCallback((callId: string, transcript: unknown) => {
    const normalized = normalizeTranscript(transcript);
    setCalls((prev) =>
      prev.map((c) => (c.id === callId ? { ...c, transcript: normalized } : c))
    );
  }, []);

  useSocket((event, data) => {
    if (event === 'call:incoming') {
      const payload = data as { fromPhone: string; contactName?: string };
      setToast(`Incoming call from ${payload.contactName || payload.fromPhone}`);
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
    setToast('');
    setError('');
    try {
      await callingApi.enable();
      setToast('Voice calls are now enabled on your WhatsApp number.');
      await load();
    } catch (err: unknown) {
      const body = (err as { response?: { data?: { error?: { message?: string; hints?: string[] } } } })
        ?.response?.data?.error;
      setError(body?.message || 'Could not enable calls. Check your account in Meta Business Manager.');
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
    if (calls.length === 0) {
      setSelectedCallId(null);
      return;
    }
    if (!selectedCallId || !calls.some((c) => c.id === selectedCallId)) {
      setSelectedCallId(calls[0].id);
    }
  }, [calls, selectedCallId]);

  // Refresh transcript while a call is live
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
      void loadCallDetail(call.id);
    },
    [loadCallDetail]
  );

  async function handleTerminate() {
    if (!selectedCall) return;
    setEnding(true);
    try {
      await callingApi.terminate(selectedCall.id);
      setToast('Call ended.');
      await load();
      await loadCallDetail(selectedCall.id);
    } catch {
      setError('Could not end the call.');
    } finally {
      setEnding(false);
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
      {error && <AppAlert variant="error">{error}</AppAlert>}
      {toast && <AppAlert variant="success">{toast}</AppAlert>}

      <CallsPageHeader
        phoneNumber={status?.phoneNumber}
        isReady={isReady}
        liveCount={liveCount}
        callsToday={completedToday}
        totalCalls={callStats.total}
      />

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
          <div className="shrink-0 border-b border-neutral-100 bg-gradient-to-b from-violet-50/60 via-white to-white px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">Call history</p>
                <p className="mt-0.5 text-[13px] font-extrabold text-neutral-900">
                  {calls.length === 0 ? 'No calls yet' : `${calls.length} recorded`}
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
                      selected={selectedCallId === call.id}
                      onSelect={() => handleSelectCall(call)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          className={`min-w-0 flex-1 flex-col bg-white ${
            selectedCall ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedCall ? (
            <CallDetailView
              name={selectedCall.contact?.name}
              phone={selectedCall.contact?.phone || selectedCall.fromPhone}
              status={selectedCall.status}
              createdAt={selectedCall.createdAt}
              durationSeconds={selectedCall.durationSeconds}
              botName={selectedCall.aiBot?.name}
              transcript={selectedTranscript}
              onBack={() => setSelectedCallId(null)}
              onEndCall={isActiveCallStatus(selectedCall.status) ? () => void handleTerminate() : undefined}
              ending={ending}
            />
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
