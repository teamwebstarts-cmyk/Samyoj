import type { ReactNode } from 'react';

interface ResponsiveDataViewProps<T> {
  items: T[];
  renderCard: (item: T) => ReactNode;
  renderTable: () => ReactNode;
  emptyState?: ReactNode;
  cardClassName?: string;
  tableClassName?: string;
}

export default function ResponsiveDataView<T>({
  items,
  renderCard,
  renderTable,
  emptyState,
  cardClassName = 'space-y-3 lg:hidden',
  tableClassName = '',
}: ResponsiveDataViewProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <div className={cardClassName}>
        {items.map((item, index) => {
          const key =
            typeof item === 'object' && item !== null && 'id' in item
              ? String((item as { id: string }).id)
              : index;
          return <div key={key}>{renderCard(item)}</div>;
        })}
      </div>
      <div className={`hidden lg:block ${tableClassName}`.trim()}>{renderTable()}</div>
    </>
  );
}
