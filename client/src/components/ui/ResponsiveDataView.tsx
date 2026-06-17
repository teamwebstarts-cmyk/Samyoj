import type { ReactNode } from 'react';

interface ResponsiveDataViewProps<T> {
  items: T[];
  renderCard: (item: T) => ReactNode;
  renderTable: () => ReactNode;
  emptyState?: ReactNode;
  cardClassName?: string;
}

export default function ResponsiveDataView<T>({
  items,
  renderCard,
  renderTable,
  emptyState,
  cardClassName = 'space-y-3 lg:hidden',
}: ResponsiveDataViewProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <div className={cardClassName}>
        {items.map((item, index) => (
          <div key={index}>{renderCard(item)}</div>
        ))}
      </div>
      <div className="hidden lg:block">{renderTable()}</div>
    </>
  );
}
