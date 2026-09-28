/** Desk-style calendar glyph for dashboard period control. */
export default function RealisticCalendarIcon({ className = 'h-[20px] w-[20px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none">
      <rect x="3" y="5" width="18" height="16" rx="3.5" fill="#ffffff" stroke="#64748b" strokeWidth="1.35" />
      <rect x="3" y="5" width="18" height="5.5" rx="3.5" fill="#f43f5e" stroke="none" />
      <rect x="7" y="3.25" width="2" height="4.5" rx="1" fill="#475569" />
      <rect x="15" y="3.25" width="2" height="4.5" rx="1" fill="#475569" />
      <path d="M3 10.5h18" stroke="#e2e8f0" strokeWidth="1" />
      <circle cx="8" cy="13.5" r="1.2" fill="#cbd5e1" />
      <circle cx="12" cy="13.5" r="1.2" fill="#cbd5e1" />
      <circle cx="16" cy="13.5" r="1.2" fill="#cbd5e1" />
      <circle cx="8" cy="17" r="1.2" fill="#cbd5e1" />
      <circle cx="12" cy="17" r="1.2" fill="#ea580c" />
      <circle cx="16" cy="17" r="1.2" fill="#cbd5e1" />
      <circle cx="8" cy="20.5" r="1.2" fill="#cbd5e1" />
      <circle cx="12" cy="20.5" r="1.2" fill="#cbd5e1" />
    </svg>
  );
}
