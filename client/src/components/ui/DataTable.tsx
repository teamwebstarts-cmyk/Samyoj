import type { ReactNode } from 'react';
import { DEFAULT_PAGE_SIZE } from '../../constants/pagination';
import Pagination from './Pagination';

interface DataTableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
  minTableWidth?: string;
  tableClassName?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  serialNo?: boolean;
  serialHeader?: string;
  paginationVariant?: 'default' | 'numbered';
  paginationItemLabel?: string;
  /** Skip outer dashboard-card chrome when nested inside another card shell */
  embedded?: boolean;
  /** Lock column widths so the table stays inside the card. */
  columnWidths?: string[];
}

export function getTableSerialNo(page: number, pageSize: number, rowIndex: number) {
  return (page - 1) * pageSize + rowIndex + 1;
}

interface TableSerialCellProps {
  rowIndex: number;
  page?: number;
  pageSize?: number;
}

export function TableSerialCell({
  rowIndex,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: TableSerialCellProps) {
  return (
    <td className="table-serial-cell w-14 text-center tabular-nums text-[12px] font-semibold text-theme-muted">
      {getTableSerialNo(page, pageSize, rowIndex)}
    </td>
  );
}

export default function DataTable({
  headers,
  children,
  className = '',
  minTableWidth = 'min-w-[560px]',
  tableClassName = '',
  page,
  pageSize,
  total,
  onPageChange,
  serialNo = true,
  serialHeader = 'S.No.',
  paginationVariant = 'default',
  paginationItemLabel,
  embedded = false,
  columnWidths,
}: DataTableProps) {
  const showPagination =
    page !== undefined &&
    pageSize !== undefined &&
    total !== undefined &&
    onPageChange !== undefined;

  const displayHeaders = serialNo ? [serialHeader, ...headers] : headers;

  return (
    <div
      className={`data-table overflow-hidden p-0 ${
        embedded ? '' : 'dashboard-card'
      } ${className}`.trim()}
    >
      <div className="data-table-scroll overflow-x-auto">
        <table className={`w-full ${columnWidths ? 'table-fixed' : minTableWidth} text-sm ${tableClassName}`}>
          {columnWidths && (
            <colgroup>
              {displayHeaders.map((header, index) => (
                <col key={header} style={{ width: columnWidths[index] }} />
              ))}
            </colgroup>
          )}
          <thead>
            <tr className="border-b border-theme-border bg-theme-subtle/80">
              {displayHeaders.map((header) => {
                const isActions = header === 'Actions';
                const isSerial = header === serialHeader || header === 'S.No.';
                return (
                  <th
                    key={header}
                    scope="col"
                    className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted ${
                      isActions
                        ? `${columnWidths ? '' : 'min-w-[9rem] '}text-right`
                        : isSerial
                          ? 'w-14 px-3 text-center'
                          : 'text-left'
                    }`}
                  >
                    {header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>

      {showPagination && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
          itemLabel={paginationItemLabel}
          variant={paginationVariant}
        />
      )}
    </div>
  );
}
