import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, RefreshCw, Settings2, ShoppingBag } from 'lucide-react';
import ContactAvatar from '../components/inbox/ContactAvatar';
import CommerceOrderCard, { nextAction } from '../components/commerce/CommerceOrderCard';
import CommerceOrderDetailPanel from '../components/commerce/CommerceOrderDetailPanel';
import AppButton from '../components/ui/AppButton';
import AppSelect from '../components/ui/AppSelect';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import StatusBadge from '../components/ui/StatusBadge';
import { TableTextButton } from '../components/ui/TableActions';
import { commerceApi } from '../services/api';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { toastError, toastSuccess } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';

interface Order {
  id: string;
  referenceId: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  contact?: { name?: string | null; phone: string } | null;
}

const COMMERCE_CACHE_KEY = 'commerce';

type CommerceNumberCache = {
  orders: Order[];
  statusFilter: string;
  search: string;
  detailOrder: Order | null;
  detailData: Order | null;
};

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELED', label: 'Canceled' },
];

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CommercePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<Order | null>(null);
  const loadRef = useRef<() => void>(() => {});
  const commerceSnapshotRef = useRef<CommerceNumberCache>({
    orders: [],
    statusFilter: '',
    search: '',
    detailOrder: null,
    detailData: null,
  });

  commerceSnapshotRef.current = {
    orders,
    statusFilter,
    search,
    detailOrder,
    detailData,
  };

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;

    commerceApi
      .orders(params)
      .then((res) => setOrders(res.data.data.orders || []))
      .catch(() => toastError('Failed to load orders'))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  loadRef.current = load;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;
    if (previousNumberId) writeNumberCache(COMMERCE_CACHE_KEY, previousNumberId, commerceSnapshotRef.current);
    const cached = readNumberCache<CommerceNumberCache>(COMMERCE_CACHE_KEY, numberId);
    if (cached) {
      setOrders(cached.orders);
      setStatusFilter(cached.statusFilter);
      setSearch(cached.search);
      setDetailOrder(cached.detailOrder);
      setDetailData(cached.detailData);
      setLoading(false);
      return;
    }
    setDetailOrder(null);
    setDetailData(null);
    loadRef.current();
  });

  useEffect(() => {
    load();
  }, [load]);

  const openOrderDetail = async (order: Order) => {
    setDetailOrder(order);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await commerceApi.order(order.id);
      setDetailData(res.data.data as Order);
    } catch {
      toastError('Failed to load order details');
      setDetailOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await commerceApi.updateStatus(id, { status });
      toastSuccess('Order updated');
      load();
      if (detailOrder?.id === id) {
        setDetailData((prev) => (prev ? { ...prev, status } : prev));
        setDetailOrder((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch {
      toastError('Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => {
      const customer = order.contact?.name || order.contact?.phone || '';
      return (
        order.referenceId.toLowerCase().includes(q) ||
        customer.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const stats = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === 'PENDING').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
    }),
    [orders]
  );

  const hasActiveFilters = Boolean(search || statusFilter);

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          badge="Commerce"
          badgeIcon={ShoppingBag}
          title="Orders"
          description="Track and fulfill catalog purchases received through WhatsApp."
          accent="emerald"
          stats={[
            { label: 'Total', value: stats.total },
            {
              label: 'Pending',
              value: stats.pending,
              tone: 'text-amber-700 dark:text-amber-300',
            },
            {
              label: 'Completed',
              value: stats.completed,
              tone: 'text-emerald-700 dark:text-emerald-300',
            },
          ]}
        />

        <div className="inbox-shell overflow-hidden">
          <ListToolbar
            embedded
            stackFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search reference or customer..."
            filters={
              <AppSelect
                className="w-full sm:w-[148px]"
                value={statusFilter}
                placeholder="All statuses"
                isSearchable={false}
                options={statusFilterOptions}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            }
            actions={
              <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
                Refresh
              </AppButton>
            }
          />

          {loading ? (
            <div className="p-6">
              <LoadingState label="Loading orders..." />
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={Package}
                variant={hasActiveFilters ? 'filter' : 'default'}
                title={hasActiveFilters ? 'No orders match your filters' : 'No orders yet'}
                description={
                  hasActiveFilters
                    ? 'Try a different search word or order status.'
                    : 'Orders show up here when customers buy from your WhatsApp product catalog.'
                }
                steps={
                  hasActiveFilters
                    ? undefined
                    : ['Connect WhatsApp in Settings', 'Add products to your catalog', 'Share the catalog link with customers']
                }
                action={
                  !hasActiveFilters ? (
                    <Link to="/settings?tab=whatsapp">
                      <AppButton variant="secondary" icon={<Settings2 size={16} />}>
                        Set up catalog
                      </AppButton>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ResponsiveDataView
              items={filteredOrders}
              cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
              tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
              renderCard={(order) => (
                <CommerceOrderCard
                  key={order.id}
                  order={order}
                  onUpdateStatus={updateStatus}
                  formatMoney={formatMoney}
                  formatDate={formatDate}
                  onClick={() => void openOrderDetail(order)}
                  updating={updatingId === order.id}
                />
              )}
              renderTable={() => (
                <DataTable headers={['Reference', 'Customer', 'Total', 'Status', 'Payment', 'Actions']} serialNo={false}>
                  {filteredOrders.map((order) => {
                    const action = nextAction(order.status);
                    const customer = order.contact?.name || order.contact?.phone || '—';

                    return (
                      <tr
                        key={order.id}
                        className="group cursor-pointer transition-colors hover:bg-theme-subtle/40"
                        onClick={() => void openOrderDetail(order)}
                      >
                        <td className="min-w-[140px]">
                          <p className="font-mono text-[12px] font-semibold text-theme-fg">{order.referenceId}</p>
                          <p className="mt-0.5 text-[11px] text-theme-muted">{formatDate(order.createdAt)}</p>
                        </td>
                        <td className="min-w-[160px]">
                          <div className="flex items-center gap-2.5">
                            <ContactAvatar
                              name={order.contact?.name || undefined}
                              phone={order.contact?.phone || order.referenceId}
                              size="sm"
                            />
                            <span className="truncate font-medium text-theme-fg">{customer}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap font-semibold tabular-nums text-theme-fg">
                          {formatMoney(order.totalCents, order.currency)}
                        </td>
                        <td className="whitespace-nowrap">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="whitespace-nowrap">
                          <StatusBadge status={order.paymentStatus} />
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end">
                            {action ? (
                              <TableTextButton
                                variant="neutral"
                                onClick={() => void updateStatus(order.id, action.next)}
                              >
                                {action.label}
                              </TableTextButton>
                            ) : (
                              <span className="text-[12px] text-theme-muted">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              )}
            />
          )}
        </div>
      </div>

      <CommerceOrderDetailPanel
        order={detailData || detailOrder}
        open={Boolean(detailOrder)}
        loading={detailLoading}
        onClose={() => {
          setDetailOrder(null);
          setDetailData(null);
        }}
        onUpdateStatus={updateStatus}
        updating={detailOrder ? updatingId === detailOrder.id : false}
        formatMoney={formatMoney}
        formatDate={formatDate}
      />
    </PageShell>
  );
}
