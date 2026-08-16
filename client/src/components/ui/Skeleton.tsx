import type { HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  delayMs?: number;
}

/** Shared pulse block — reuse this instead of inventing per-page shimmer styles. */
export default function Skeleton({ className = '', delayMs = 0, style, ...rest }: SkeletonProps) {
  return (
    <div
      className={`inbox-skeleton-shimmer ${className}`}
      style={{ animationDelay: `${delayMs}ms`, ...style }}
      {...rest}
    />
  );
}
