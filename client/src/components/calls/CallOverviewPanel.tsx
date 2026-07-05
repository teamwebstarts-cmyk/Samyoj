import { useState } from 'react';
import { Bot, HelpCircle, LayoutGrid, PhoneCall } from 'lucide-react';
import CallInfoPanel from './CallInfoPanel';
import CallStatsSummary from './CallStatsSummary';
import CallSystemStatus from './CallSystemStatus';

interface CallStats {
  total: number;
  today: number;
  aiAnswered: number;
  missed: number;
  avgDurationSec: number;
}

interface CallOverviewPanelProps {
  status: {
    whatsappConnected: boolean;
    callingEnabled: boolean;
    phoneNumber?: string | null;
    deepgram?: boolean;
    googleTts?: boolean;
    azureOpenAI?: boolean;
    aiAutoAnswer?: boolean;
    voiceReady?: boolean;
  };
  liveCount: number;
  callStats: CallStats;
  hasCalls: boolean;
}

type Tab = 'overview' | 'guide';

export default function CallOverviewPanel({ status, liveCount, callStats, hasCalls }: CallOverviewPanelProps) {
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutGrid }> = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'guide', label: 'Guide', icon: HelpCircle },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-950">
      <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-4 w-4 text-violet-600" />
          <div>
            <p className="text-[13px] font-extrabold text-neutral-900">
              {hasCalls ? 'Select a call' : 'Getting started'}
            </p>
            <p className="text-[11px] font-medium text-neutral-500">
              {hasCalls
                ? 'Pick a call from the list to view transcript'
                : 'Complete setup and wait for your first call'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-1 rounded-xl bg-neutral-100/80 p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold transition ${
                  active
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {tab === 'overview' ? (
          <div className="mx-auto w-full min-w-0 max-w-2xl space-y-4">
            <CallSystemStatus
              whatsappConnected={status.whatsappConnected}
              callingEnabled={status.callingEnabled}
              phoneNumber={status.phoneNumber}
              deepgram={status.deepgram}
              googleTts={status.googleTts}
              azureOpenAI={status.azureOpenAI}
              aiAutoAnswer={status.aiAutoAnswer}
              voiceReady={status.voiceReady}
            />
            <CallStatsSummary live={liveCount} {...callStats} />
            {!status.voiceReady && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
                <p className="text-[12px] font-bold text-amber-900">Not live yet</p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-amber-950/90">
                  Finish the setup steps above your call list. Once all checks pass, incoming calls are answered
                  automatically.
                </p>
              </div>
            )}
            {status.voiceReady && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-4 py-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-[12px] font-bold text-emerald-900">AI auto-answer is active</p>
                  <p className="mt-0.5 text-[12px] font-medium text-emerald-800/90">
                    {status.phoneNumber
                      ? `Test by calling ${status.phoneNumber} from WhatsApp chat.`
                      : 'Test with a contact who has your WhatsApp chat open.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full min-w-0">
            <CallInfoPanel embedded phoneNumber={status.phoneNumber} />
          </div>
        )}
      </div>
    </div>
  );
}
