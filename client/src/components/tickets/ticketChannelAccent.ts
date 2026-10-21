export type TicketChannelAccent = 'whatsapp' | 'messenger' | 'instagram';

export const TICKET_CHANNEL_ACCENT: Record<
  TicketChannelAccent,
  { iconClassName: string; prioritySelected: string; ticketBtn: string; ticketBadge: string }
> = {
  whatsapp: {
    iconClassName:
      'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-500/25',
    prioritySelected:
      'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.28)]',
    ticketBtn: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40',
    ticketBadge: 'bg-emerald-600',
  },
  messenger: {
    iconClassName:
      'bg-[#e8f1ff] text-[#1877F2] ring-1 ring-[#1877F2]/25 dark:bg-[#1877F2]/15 dark:text-[#69a7ff] dark:ring-[#1877F2]/30',
    prioritySelected:
      'bg-gradient-to-br from-[#1877F2] to-[#1565d8] text-white shadow-[0_2px_8px_rgba(24,119,242,0.32)]',
    ticketBtn: 'text-[#1877F2] hover:bg-[#1877F2]/10 dark:text-[#69a7ff] dark:hover:bg-[#1877F2]/15',
    ticketBadge: 'bg-[#1877F2]',
  },
  instagram: {
    iconClassName:
      'bg-gradient-to-br from-fuchsia-50 to-rose-50 text-[#c13584] ring-1 ring-[#c13584]/25 dark:from-fuchsia-950/40 dark:to-rose-950/30 dark:text-[#f472b6] dark:ring-[#c13584]/30',
    prioritySelected:
      'bg-gradient-to-br from-[#c13584] to-[#e1306c] text-white shadow-[0_2px_8px_rgba(193,53,132,0.32)]',
    ticketBtn: 'text-[#c13584] hover:bg-rose-50 dark:text-[#f472b6] dark:hover:bg-rose-950/30',
    ticketBadge: 'bg-[#c13584]',
  },
};
