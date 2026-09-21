import {
  ArrowLeftRight,
  ArrowRight,
  Cloud,
  Inbox,
  Smartphone,
  Users,
} from 'lucide-react';

export type ConnectModePreview = 'standard' | 'coexistence' | null;

interface WhatsAppConnectModeCompareProps {
  active: ConnectModePreview;
}

type NodeKind = 'inbox' | 'api' | 'users' | 'phone';
type NodeTone = 'emerald' | 'sky' | 'meta';

const NODE_META: Record<NodeKind, { icon: typeof Inbox; label: string; tone: NodeTone }> = {
  inbox: { icon: Inbox, label: 'Samyoj', tone: 'emerald' },
  api: { icon: Cloud, label: 'Cloud API', tone: 'meta' },
  users: { icon: Users, label: 'Customers', tone: 'emerald' },
  phone: { icon: Smartphone, label: 'WA app', tone: 'sky' },
};

function toneClasses(tone: NodeTone, emphasized: boolean) {
  const vivid =
    tone === 'emerald'
      ? 'bg-whatsapp-500 text-white shadow-sm shadow-whatsapp-500/20'
      : tone === 'sky'
        ? 'bg-sky-600 text-white shadow-sm shadow-sky-600/20'
        : 'bg-[#1877F2] text-white shadow-sm shadow-[#1877F2]/25';
  const calm =
    tone === 'emerald'
      ? 'bg-whatsapp-500/90 text-white'
      : tone === 'sky'
        ? 'bg-sky-600/90 text-white'
        : 'bg-[#1877F2]/90 text-white';
  return emphasized ? vivid : calm;
}

function FlowDiagram({
  nodes,
  arrows,
  emphasized,
}: {
  nodes: [NodeKind, NodeKind, NodeKind];
  arrows: ['forward' | 'twoWay', 'forward' | 'twoWay'];
  emphasized: boolean;
}) {
  const [a, b, c] = nodes;
  const [ab, bc] = arrows;

  const renderNode = (kind: NodeKind) => {
    const meta = NODE_META[kind];
    const Icon = meta.icon;
    return (
      <div className="flex min-w-0 flex-col items-center gap-1">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${toneClasses(
            meta.tone,
            emphasized
          )}`}
          aria-hidden
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <span
          className="flex h-8 w-full items-center justify-center text-center text-[10px] font-semibold leading-[1.15] text-neutral-600"
          title={meta.label}
        >
          <span className="line-clamp-2">{meta.label}</span>
        </span>
      </div>
    );
  };

  const renderArrow = (kind: 'forward' | 'twoWay') => (
    <div className="flex h-10 shrink-0 items-center justify-center text-neutral-300" aria-hidden>
      {kind === 'twoWay' ? (
        <ArrowLeftRight className="h-4 w-4 shrink-0" />
      ) : (
        <ArrowRight className="h-4 w-4 shrink-0" />
      )}
    </div>
  );

  return (
    <div
      className="grid h-[4.75rem] grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_1.25rem_minmax(0,1fr)] items-start"
    >
      {renderNode(a)}
      {renderArrow(ab)}
      {renderNode(b)}
      {renderArrow(bc)}
      {renderNode(c)}
    </div>
  );
}

function panelShell(isActive: boolean, accent: 'emerald' | 'sky') {
  const shell =
    'rounded-lg border bg-white ring-2 ring-inset transition-[border-color,background-color,box-shadow] duration-200';
  if (!isActive) {
    return `${shell} border-neutral-200 ring-transparent`;
  }
  return accent === 'emerald'
    ? `${shell} border-whatsapp-300 bg-gradient-to-b from-whatsapp-50 to-white shadow-sm ring-whatsapp-100/90`
    : `${shell} border-sky-300 bg-gradient-to-b from-sky-50 to-white shadow-sm ring-sky-100/90`;
}

function ComparePanel({
  title,
  titleMuted,
  description,
  emphasized,
  accent,
  nodes,
  arrows,
}: {
  title: string;
  titleMuted: string;
  description: string;
  emphasized: boolean;
  accent: 'emerald' | 'sky';
  nodes: [NodeKind, NodeKind, NodeKind];
  arrows: ['forward' | 'twoWay', 'forward' | 'twoWay'];
}) {
  return (
    <div className={`flex h-full min-h-[11.5rem] flex-col px-2.5 py-2.5 ${panelShell(emphasized, accent)}`}>
      <p className="min-h-[2rem] shrink-0 text-[11px] font-bold leading-snug text-neutral-800">
        {title}{' '}
        <span className="font-semibold text-neutral-400">{titleMuted}</span>
      </p>
      <div className="mt-1 shrink-0">
        <FlowDiagram emphasized={emphasized} nodes={nodes} arrows={arrows} />
      </div>
      <p className="mt-2 min-h-[2.625rem] shrink-0 text-[10px] leading-[1.35] text-neutral-500">
        <span className="line-clamp-3">{description}</span>
      </p>
    </div>
  );
}

export default function WhatsAppConnectModeCompare({ active }: WhatsAppConnectModeCompareProps) {
  const standardOn = active === 'standard';
  const coexistOn = active === 'coexistence';

  return (
    <div
      className="rounded-xl border border-neutral-100 bg-neutral-50/90 p-3"
      aria-label="How each connect option works"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">At a glance</p>
      <div className="mt-2 grid grid-cols-2 items-stretch gap-2">
        <ComparePanel
          title="Standard"
          titleMuted="· Cloud API"
          description="Samyoj via Cloud API only — not on the Business mobile app."
          emphasized={standardOn}
          accent="emerald"
          nodes={['inbox', 'api', 'users']}
          arrows={['forward', 'forward']}
        />
        <ComparePanel
          title="Coexistence"
          titleMuted="· phone + API"
          description="Same number on phone and Samyoj; Meta syncs the app with Cloud API."
          emphasized={coexistOn}
          accent="sky"
          nodes={['phone', 'api', 'inbox']}
          arrows={['twoWay', 'forward']}
        />
      </div>
    </div>
  );
}
