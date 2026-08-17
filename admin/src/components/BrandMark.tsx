export function BrandMark({
  inverted = false,
  size = 'md',
}: {
  inverted?: boolean;
  size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-9 w-9 text-[15px]';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl font-bold tracking-tight ${box} ${
        inverted ? 'bg-sage-bright text-graphite' : 'bg-sage text-white'
      }`}
      aria-hidden
    >
      S
    </span>
  );
}
