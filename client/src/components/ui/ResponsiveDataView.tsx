import type { ReactNode } from 'react';

interface ResponsiveDataViewProps<T> {
  items: T[];
  renderCard: (item: T) => ReactNode;
  renderTable: () => ReactNode;
  emptyState?: ReactNode;
  cardClassName?: string;
  /** Classes on each card wrapper (e.g. aspect-square sizing in a flex/grid parent). */
  cardItemClassName?: string;
  /** Extra classes on the table wrapper (padding, etc.). Visibility uses `tableFrom`. */
  tableClassName?: string;
  /** Show table from this breakpoint; cards hide at the same point. Default lg. */
  tableFrom?: 'lg' | 'xl' | '2xl';
}

function tableBreakpointClasses(tableFrom: 'lg' | 'xl' | '2xl') {
  if (tableFrom === '2xl') {
    return { cardsHidden: '2xl:hidden', tableVisible: 'hidden 2xl:block' };
  }
  if (tableFrom === 'xl') {
    return { cardsHidden: 'xl:hidden', tableVisible: 'hidden xl:block' };
  }
  return { cardsHidden: 'lg:hidden', tableVisible: 'hidden lg:block' };
}

export default function ResponsiveDataView<T>({
  items,
  renderCard,
  renderTable,
  emptyState,
  cardClassName,
  cardItemClassName = 'h-full min-w-0',
  tableClassName = '',
  tableFrom = 'lg',
}: ResponsiveDataViewProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const { cardsHidden, tableVisible } = tableBreakpointClasses(tableFrom);
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
          return (
            <div key={key} className={cardItemClassName}>
              {renderCard(item)}
            </div>
          );
        })}
      </div>
      <div className={`${tableVisible} ${tableClassName}`.trim()}>{renderTable()}</div>
    </>
  );
}
