import type { ReactNode } from 'react';
import { DEFAULT_PAGE_SIZE } from '../../constants/pagination';
import Pagination from './Pagination';

interface DataTableProps {
  headers: string[];
  children: ReactNode;
  className?: string;
  minTableWidth?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  serialNo?: boolean;
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
  minTableWidth = 'min-w-[640px]',
  page,
  pageSize,
  total,
  onPageChange,
  serialNo = true,
}: DataTableProps) {
  const showPagination =
    page !== undefined &&
    pageSize !== undefined &&
    total !== undefined &&
    onPageChange !== undefined;

  const displayHeaders = serialNo ? ['S.No.', ...headers] : headers;

  return (
    <div className={`data-table dashboard-card overflow-hidden p-0 ${className}`}>
      <div className="overflow-x-auto">
        <table className={`w-full ${minTableWidth} text-sm`}>
          <thead>
            <tr className="border-b border-theme-border bg-theme-subtle/80">
              {displayHeaders.map((header) => {
                const isActions = header === 'Actions';
                const isSerial = header === 'S.No.';
                return (
                  <th
                    key={header}
                    scope="col"
                    className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-theme-muted ${
                      isActions
                        ? 'min-w-[132px] text-right'
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
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
      )}
    </div>
  );
}
