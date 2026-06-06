import {
  Bot,
  Clock,
  Headphones,
  HelpCircle,
  MessageSquare,
  PhoneIncoming,
  Shield,
  Users,
} from 'lucide-react';

const benefits = [
  {
    icon: Headphones,
    title: '24/7 availability',
    text: 'Customers can call anytime — your AI bot answers even after hours.',
    color: 'from-violet-500 to-purple-600',
    bg: 'from-violet-50 to-white',
  },
  {
    icon: MessageSquare,
    title: 'Saved transcripts',
    text: 'Every call is logged here with what the customer and bot said.',
    color: 'from-whatsapp-500 to-emerald-600',
    bg: 'from-emerald-50 to-white',
  },
  {
    icon: Shield,
    title: 'Team handoff',
    text: 'Complex requests can continue in Inbox as a normal chat.',
    color: 'from-sky-500 to-blue-600',
    bg: 'from-sky-50 to-white',
  },
];

const flow = [
  { step: '1', title: 'Customer calls', text: 'They tap the phone icon in your WhatsApp chat.' },
  { step: '2', title: 'AI answers', text: 'Your bot greets them and handles the conversation by voice.' },
  { step: '3', title: 'You review', text: 'See call history, duration, and full transcript on this page.' },
];

const faq = [
  {
    q: 'Who can call my business?',
    a: 'Any customer who has an open chat with your WhatsApp number can start a voice call from the app.',
  },
  {
    q: 'Does the bot use my AI settings?',
    a: 'Yes — the same AI bot configured in AI Bots handles voice calls with your knowledge and tone.',
  },
  {
    q: 'What if calling cannot be enabled?',
    a: 'Meta requires a verified business account, payment method, and eligible messaging tier. Check the setup hints above.',
  },
];

interface CallInfoPanelProps {
  compact?: boolean;
  phoneNumber?: string | null;
}

export default function CallInfoPanel({ compact, phoneNumber }: CallInfoPanelProps) {
  if (compact) {
    return (
      <div className="space-y-5 p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">How it works</p>
          <div className="mt-3 space-y-3">
            {flow.map((item) => (
              <div key={item.step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-[11px] font-bold text-violet-700">
                  {item.step}
                </span>
                <div>
                  <p className="text-[13px] font-bold text-neutral-900">{item.title}</p>
                  <p className="text-[12px] font-medium text-neutral-500">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {phoneNumber && (
          <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Your number</p>
            <p className="mt-0.5 text-[13px] font-extrabold text-emerald-950">{phoneNumber}</p>
            <p className="mt-1 text-[11px] font-medium text-emerald-800/90">
              Ask a test contact to open WhatsApp chat and tap the call button.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="grid gap-3 sm:grid-cols-3">
        {benefits.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className={`rounded-2xl border border-neutral-200/60 bg-gradient-to-br ${item.bg} p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]`}
              >
                <Icon className="h-4.5 w-4.5" strokeWidth={2} />
              </div>
              <p className="mt-3 text-[13px] font-extrabold text-neutral-900">{item.title}</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600">{item.text}</p>
            </div>
          );
        })}
      </div>

      <div className="dashboard-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">Call flow</p>
            <h3 className="mt-1 text-[15px] font-extrabold text-neutral-900">What happens when someone calls</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-800">
            <PhoneIncoming className="h-3.5 w-3.5" />
            WhatsApp voice
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {flow.map((item) => (
            <div key={item.step} className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-bold text-white">
                {item.step}
              </span>
              <p className="mt-2 text-[13px] font-extrabold text-neutral-900">{item.title}</p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="dashboard-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-600" />
            <p className="text-[13px] font-extrabold text-neutral-900">For your customers</p>
          </div>
          <ul className="mt-3 space-y-2 text-[12px] font-medium leading-relaxed text-neutral-600">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Call directly from WhatsApp — no extra apps or phone numbers to dial.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Get instant answers in natural voice, powered by your business AI bot.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Continue the conversation in chat if they need more help later.
            </li>
          </ul>
          {phoneNumber && (
            <div className="mt-4 rounded-xl border border-violet-200/60 bg-violet-50/50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Test call</p>
              <p className="mt-0.5 text-[12px] font-medium text-violet-950">
                Open WhatsApp chat with <span className="font-extrabold">{phoneNumber}</span> and tap the call icon.
              </p>
            </div>
          )}
        </div>

        <div className="dashboard-card p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-whatsapp-600" />
            <p className="text-[13px] font-extrabold text-neutral-900">Common questions</p>
          </div>
          <div className="mt-3 space-y-3">
            {faq.map((item) => (
              <div key={item.q}>
                <p className="text-[12px] font-bold text-neutral-900">{item.q}</p>
                <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-neutral-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-neutral-200/60 bg-neutral-50/80 px-4 py-3.5 text-[12px] font-medium text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-violet-600" />
          Uses your default AI bot
        </span>
        <span className="hidden h-4 w-px bg-neutral-200 sm:block" />
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-whatsapp-600" />
          Calls logged with date & duration
        </span>
      </div>
    </div>
  );
}
