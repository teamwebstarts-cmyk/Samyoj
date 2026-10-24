import type { ReactNode } from 'react';

export function ResponsiveDataView<T>({
  items,
  renderCard,
  renderTable,
  emptyState,
  tableFrom = 'md',
  cardsClassName = 'space-y-3',
}: {
  items: T[];
  renderCard: (item: T) => ReactNode;
  renderTable: () => ReactNode;
  emptyState?: ReactNode;
  tableFrom?: 'md' | 'lg';
  /** Wrapper spacing for the mobile card stack — pass '' for a flush divider list. */
  cardsClassName?: string;
}) {
  if (items.length === 0 && emptyState) return <>{emptyState}</>;

  const cardsHidden = tableFrom === 'lg' ? 'lg:hidden' : 'md:hidden';
  const tableVisible = tableFrom === 'lg' ? 'hidden lg:block' : 'hidden md:block';

  return (
    <>
      <div className={`${cardsClassName} ${cardsHidden}`}>
        {items.map((item, index) => {
          const key =
            typeof item === 'object' && item !== null && 'id' in item
              ? String((item as { id: string }).id)
              : String(index);
          return <div key={key}>{renderCard(item)}</div>;
        })}
      </div>
      <div className={tableVisible}>{renderTable()}</div>
    </>
  );
}
