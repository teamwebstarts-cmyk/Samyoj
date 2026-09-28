interface InstagramGlyphProps {
  className?: string;
}

/** Instagram camera mark — stroke silhouette reads clearly on gradient tab wells and hero badge. */
export default function InstagramGlyph({ className = 'h-5 w-5' }: InstagramGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="17.15" cy="6.85" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}
