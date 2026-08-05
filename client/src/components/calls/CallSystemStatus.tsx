import { Bot, Mic, Phone, Radio, Sparkles, Volume2 } from 'lucide-react';

interface CallSystemStatusProps {
  whatsappConnected: boolean;
  callingEnabled: boolean;
  phoneNumber?: string | null;
  sarvamStt?: boolean;
  sarvamTts?: boolean;
  brainProvider?: 'sarvam' | 'azure' | null;
  aiAutoAnswer?: boolean;
  voiceReady?: boolean;
}

const checks = [
  {
    key: 'whatsapp',
    label: 'WhatsApp number',
    detail: 'Business line linked',
    icon: Phone,
    ok: (s: CallSystemStatusProps) => s.whatsappConnected,
  },
  {
    key: 'calling',
    label: 'Voice calling',
    detail: 'Can receive calls',
    icon: Radio,
    ok: (s: CallSystemStatusProps) => s.callingEnabled,
  },
  {
    key: 'listen',
    label: 'Speech recognition',
    detail: 'Understands caller voice',
    icon: Mic,
    ok: (s: CallSystemStatusProps) => Boolean(s.sarvamStt),
  },
  {
    key: 'speak',
    label: 'Voice response',
    detail: 'Natural AI speech',
    icon: Volume2,
    ok: (s: CallSystemStatusProps) => Boolean(s.sarvamTts),
  },
  {
    key: 'brain',
    label: 'AI assistant',
    detail: 'Answers like your bot',
    icon: Bot,
    ok: (s: CallSystemStatusProps) => Boolean(s.brainProvider),
  },
  {
    key: 'auto',
    label: 'Auto-answer',
    detail: 'Picks up without an agent',
    icon: Sparkles,
    ok: (s: CallSystemStatusProps) => Boolean(s.aiAutoAnswer),
  },
] as const;

export default function CallSystemStatus(props: CallSystemStatusProps) {
  const passed = checks.filter((c) => c.ok(props)).length;
  const allGood = props.voiceReady && passed === checks.length;

  return (
    <div className="dashboard-card overflow-hidden p-0">
      <div className="border-b border-neutral-100 bg-gradient-to-r from-neutral-50/80 via-white to-violet-50/40 px-4 py-3.5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">System status</p>
            <p className="mt-0.5 text-[14px] font-extrabold text-neutral-900">
              {allGood ? 'Ready to receive calls' : `${passed} of ${checks.length} ready`}
            </p>
            {props.phoneNumber && (
              <p className="mt-1 text-[12px] font-medium text-neutral-600">
                Connected: <span className="font-semibold text-neutral-800">{props.phoneNumber}</span>
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              allGood
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80'
                : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
            }`}
          >
            {allGood ? 'Live' : 'Setup'}
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-neutral-100/80 sm:grid-cols-2">
        {checks.map((item) => {
          const ok = item.ok(props);
          const Icon = item.icon;
          return (
            <div key={item.key} className="flex items-center gap-3 bg-white px-4 py-3 sm:px-5">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  ok
                    ? 'bg-gradient-to-br from-emerald-500 to-whatsapp-600 text-white shadow-[0_3px_10px_rgba(37,211,102,0.25)]'
                    : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className={`text-[12px] font-extrabold ${ok ? 'text-neutral-900' : 'text-neutral-500'}`}>
                  {item.label}
                </p>
                <p className="text-[11px] font-medium text-neutral-500">{item.detail}</p>
              </div>
              <span
                className={`ml-auto shrink-0 text-[10px] font-bold uppercase ${
                  ok ? 'text-emerald-600' : 'text-neutral-400'
                }`}
              >
                {ok ? 'OK' : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
