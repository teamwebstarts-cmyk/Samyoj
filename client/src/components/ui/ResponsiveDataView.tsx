import type { ReactNode } from 'react';

interface ResponsiveDataViewProps<T> {
  items: T[];
  renderCard: (item: T) => ReactNode;
  renderTable: () => ReactNode;
  emptyState?: ReactNode;
  cardClassName?: string;
  /** Extra classes on the table wrapper (padding, etc.). Visibility uses `tableFrom`. */
  tableClassName?: string;
  /** Show table from this breakpoint; cards hide at the same point. Default lg. */
  tableFrom?: 'lg' | 'xl';
}

export default function ResponsiveDataView<T>({
  items,
  renderCard,
  renderTable,
  emptyState,
  cardClassName,
  tableClassName = '',
  tableFrom = 'lg',
}: ResponsiveDataViewProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const cardsHidden = tableFrom === 'xl' ? 'xl:hidden' : 'lg:hidden';
  const tableVisible = tableFrom === 'xl' ? 'hidden xl:block' : 'hidden lg:block';
  const resolvedCardClass =
    cardClassName ?? `space-y-3 ${cardsHidden}`;

  return (
    <>
      <div className={resolvedCardClass}>
        {items.map((item, index) => {
          const key =
            typeof item === 'object' && item !== null && 'id' in item
              ? String((item as { id: string }).id)
              : index;
          return <div key={key}>{renderCard(item)}</div>;
        })}
      </div>
      <div className={`${tableVisible} ${tableClassName}`.trim()}>{renderTable()}</div>
    </>
  );
}
