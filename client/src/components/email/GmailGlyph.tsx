interface GmailGlyphProps {
  className?: string;
}

/** Official Gmail "M" mark (simplified multi-color). */
export default function GmailGlyph({ className = 'h-4 w-4' }: GmailGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22 5.9v12.2c0 .77-.62 1.4-1.39 1.4H18V8.7L12 13 6 8.7V19.5H3.4C2.63 19.5 2 18.87 2 18.1V5.9c0-.97 1.1-1.52 1.87-.94L6 6.6 12 11l6-4.4 2.13-1.64C20.9 4.38 22 4.93 22 5.9Z" />
      <path fill="#34A853" d="M6 8.7v10.8H3.4C2.63 19.5 2 18.87 2 18.1V5.9c0-.97 1.1-1.52 1.87-.94L6 6.6v2.1Z" />
      <path fill="#FBBC04" d="M22 5.9v12.2c0 .77-.62 1.4-1.39 1.4H18V8.7l2.13-1.64C20.9 4.38 22 4.93 22 5.9Z" />
      <path fill="#EA4335" d="M18 8.7v10.8H6V8.7l6 4.3 6-4.3Z" />
      <path fill="#C5221F" d="M6 6.6 12 11l6-4.4-2.13-1.64a1.4 1.4 0 0 0-1.74 0L12 6.4 9.87 4.96a1.4 1.4 0 0 0-1.74 0L6 6.6Z" />
    </svg>
  );
}
