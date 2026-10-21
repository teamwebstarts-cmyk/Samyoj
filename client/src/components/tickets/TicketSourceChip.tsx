import FacebookGlyph from '../dashboard/icons/FacebookGlyph';
import InstagramGlyph from '../dashboard/icons/InstagramGlyph';
import WhatsAppGlyph from '../dashboard/icons/WhatsAppGlyph';
import { ticketSourceChannel, ticketSourceLabels, type TicketItem } from './ticketUi';

export default function TicketSourceChip({ ticket }: { ticket: TicketItem }) {
  const source = ticketSourceChannel(ticket);
  const label = ticketSourceLabels[source];
  const tone =
    source === 'messenger'
      ? 'bg-[#e8f1ff] text-[#1877F2] ring-[#1877F2]/25 dark:bg-[#1877F2]/15 dark:text-[#69a7ff]'
      : source === 'instagram'
        ? 'bg-rose-50 text-[#c13584] ring-rose-200/80 dark:bg-rose-950/30 dark:text-[#f472b6]'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/35 dark:text-emerald-300';

  const Icon =
    source === 'messenger' ? FacebookGlyph : source === 'instagram' ? InstagramGlyph : WhatsAppGlyph;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${tone}`}
      title={`Created from ${label}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}
