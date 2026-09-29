interface GmailGlyphProps {
  className?: string;
}

/** Official Gmail envelope mark (four-color M). */
export default function GmailGlyph({ className = 'h-4 w-4' }: GmailGlyphProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#4caf50" d="M45 16.2 35 23.7V40h7c1.7 0 3-1.3 3-3V16.2z" />
      <path fill="#1e88e5" d="M3 16.2 13 23.7V40H6c-1.7 0-3-1.3-3-3V16.2z" />
      <path fill="#e53935" d="m35 11.2-11 8.3-11-8.3-1 5.6 11 8.2 11-8.2z" />
      <path fill="#c62828" d="M3 12.3V16.2l10 7.5V11.2L9.9 8.9C9.1 8.3 8.2 8 7.3 8 4.9 8 3 9.9 3 12.3z" />
      <path fill="#fbc02d" d="M45 12.3V16.2l-10 7.5V11.2l3.1-2.3c.8-.6 1.7-.9 2.6-.9 2.4 0 4.3 1.9 4.3 4.3z" />
    </svg>
  );
}
