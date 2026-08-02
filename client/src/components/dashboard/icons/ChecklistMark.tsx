interface ChecklistMarkProps {
  completed: boolean;
  className?: string;
}

/** Solid green check well (completed) or empty gray ring (todo) — matches dashboard mock. */
export default function ChecklistMark({ completed, className = 'h-4 w-4' }: ChecklistMarkProps) {
  if (completed) {
    return (
      <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} aria-hidden>
        <circle cx="8" cy="8" r="8" fill="#16a34a" />
        <path
          d="M4.6 8.15 6.7 10.2l4.7-4.85"
          fill="none"
          stroke="#fff"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.25"
        fill="none"
        stroke="#d4d4d8"
        strokeWidth="1.5"
      />
    </svg>
  );
}
