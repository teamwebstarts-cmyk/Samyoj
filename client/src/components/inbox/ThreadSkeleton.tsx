const ROWS: Array<{ side: 'left' | 'right'; width: string; tall?: boolean }> = [
  { side: 'left', width: 'w-2/5' },
  { side: 'left', width: 'w-1/3' },
  { side: 'right', width: 'w-1/2' },
  { side: 'left', width: 'w-3/5', tall: true },
  { side: 'right', width: 'w-2/5' },
  { side: 'right', width: 'w-1/3' },
  { side: 'left', width: 'w-1/2' },
];

export default function ThreadSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden px-3 py-4 sm:px-4">
      <div className="mx-auto inbox-skeleton-shimmer h-5 w-20 rounded-full" />
      {ROWS.map((row, i) => (
        <div
          key={i}
          className={`inbox-skeleton-shimmer ${row.tall ? 'h-16' : 'h-9'} ${row.width} rounded-[14px] ${
            row.side === 'right' ? 'self-end rounded-br-[4px]' : 'self-start rounded-bl-[4px]'
          }`}
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}
