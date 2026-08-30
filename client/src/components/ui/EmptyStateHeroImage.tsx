type HeroImageId = 'inbox-empty-hero' | 'calls-empty-hero';

interface EmptyStateHeroImageProps {
  id: HeroImageId;
  width: number;
  height: number;
}

/** Responsive WebP hero with PNG fallback — tuned for ~38rem empty-state panes. */
export default function EmptyStateHeroImage({ id, width, height }: EmptyStateHeroImageProps) {
  const webp768 = `/images/${id}-768.webp`;
  const webp = `/images/${id}.webp`;
  const png = `/images/${id}.png`;

  return (
    <picture>
      <source
        type="image/webp"
        srcSet={`${webp768} 768w, ${webp} ${width}w`}
        sizes="(max-width: 640px) 85vw, 608px"
      />
      <img
        src={png}
        alt=""
        width={width}
        height={height}
        decoding="async"
        // React 18: camelCase fetchPriority warns; lowercase passes through to the DOM.
        {...{ fetchpriority: 'high' }}
        className="max-h-full max-w-full select-none object-contain"
        draggable={false}
      />
    </picture>
  );
}
