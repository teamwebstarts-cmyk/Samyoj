import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Settings2, ShoppingBag } from 'lucide-react';
import CommerceEmptyWorkspace from '../components/commerce/CommerceEmptyWorkspace';
import CommerceOrderDetailPanel from '../components/commerce/CommerceOrderDetailPanel';
import CommerceOrderList from '../components/commerce/CommerceOrderList';
import { emptyOrderCounts, ORDER_STATUS_CHIPS, type CommerceOrder, type OrderCounts } from '../components/commerce/commerceUi';
import AppButton from '../components/ui/AppButton';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import { SplitListSkeleton } from '../components/ui/ListLayoutSkeleton';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import Pagination from '../components/ui/Pagination';
import { FOCUS_RING_CLASS } from '../hooks/inboxA11y';
import { commerceApi } from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useSocket } from '../hooks/useSocket';
import { toastError, toastSuccess, toastWarning } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../utils/whatsappConnectionCopy';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';

const COMMERCE_CACHE_KEY = 'commerce';

type CommerceNumberCache = {
  orders: CommerceOrder[];
  statusFilter: string;
  search: string;
  page: number;
  total: number;
  counts: OrderCounts;
};

export default function CommercePage() {
  const { activeNumber, resolved, hasConnectedNumber, disconnectedNumbers, loading: numbersLoading } = useWhatsAppNumber();
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<OrderCounts>(emptyOrderCounts);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailOrder, setDetailOrder] = useState<CommerceOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<CommerceOrder | null>(null);
  const loadRef = useRef<() => void>(() => {});
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const commerceSnapshotRef = useRef<CommerceNumberCache>({
    orders: [],
    statusFilter: '',
    search: '',
    page: 1,
    total: 0,
    counts: emptyOrderCounts,
  });

  const debouncedSearch = useDebouncedValue(search);
  const pageSize = DEFAULT_PAGE_SIZE;

  commerceSnapshotRef.current = {
    orders,
    statusFilter,
    search,
    page,
    total,
    counts,
  };

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoading(true);
    const params: Record<string, string> = {
      page: String(page),
      limit: String(pageSize),
    };
    if (statusFilter) params.status = statusFilter;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

    commerceApi
      .orders(params)
      .then((res) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = res.data.data || {};
        setOrders(payload.orders || []);
        setTotal(payload.total || 0);
        setCounts(payload.counts || emptyOrderCounts);
      })
      .catch(() => toastError('Failed to load orders'))
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, resolved, statusFilter, debouncedSearch, page, pageSize]);

  loadRef.current = load;

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;
    if (previousNumberId) writeNumberCache(COMMERCE_CACHE_KEY, previousNumberId, commerceSnapshotRef.current);
    const cached = readNumberCache<CommerceNumberCache>(COMMERCE_CACHE_KEY, numberId);
    if (cached) {
      setOrders(cached.orders);
      setStatusFilter(cached.statusFilter);
      setSearch(cached.search);
      setPage(cached.page || 1);
      setTotal(cached.total || 0);
      setCounts(cached.counts || emptyOrderCounts);
      setDetailOrder(null);
      setDetailData(null);
      setDetailLoading(false);
      setUpdatingId(null);
      setLoading(true);
      loadRef.current();
      return;
    }
    setOrders([]);
    setStatusFilter('');
    setSearch('');
    setPage(1);
    setTotal(0);
    setCounts(emptyOrderCounts);
    setDetailOrder(null);
    setDetailData(null);
    loadRef.current();
  });

  useEffect(() => {
    load();
  }, [load]);

  useSocket((event, data) => {
    if (event !== 'order:new' && event !== 'order:updated') return;
    const payload = data as { whatsappNumberId?: string | null };
    const currentNumberId = activeNumberIdRef.current;
    if (payload.whatsappNumberId && currentNumberId && payload.whatsappNumberId !== currentNumberId) {
      return;
    }
    loadRef.current();
  });

  const openOrderDetail = async (order: CommerceOrder) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setDetailOrder(order);
    setDetailData(order);
    setDetailLoading(true);
    try {
      const res = await commerceApi.order(order.id);
      if (requestNumberId !== activeNumberIdRef.current) return;
      setDetailData(res.data.data as CommerceOrder);
    } catch {
      if (requestNumberId === activeNumberIdRef.current) {
        toastError('Failed to load order details');
        setDetailOrder(null);
        setDetailData(null);
      }
    } finally {
      if (requestNumberId === activeNumberIdRef.current) setDetailLoading(false);
    }
  };

  const updateStatus = async (
    id: string,
    status: string,
    options?: { statusNote?: string; notifyContact?: boolean }
  ) => {
    const notifyContact = options?.notifyContact ?? true;
    setUpdatingId(id);
    try {
      const res = await commerceApi.updateStatus(id, {
        status,
        statusNote: options?.statusNote,
        notifyContact,
      });
      const notified = Boolean(res.data.data?.notified);
      if (notifyContact && notified) toastSuccess('Customer notified on WhatsApp');
      else if (notifyContact && !notified) {
        toastWarning('Order updated, but WhatsApp could not be notified');
      } else {
        toastSuccess('Order updated');
      }
      load();
      if (detailOrder?.id === id) {
        setDetailData((prev) => (prev ? { ...prev, status, statusNote: options?.statusNote ?? prev.statusNote } : prev));
        setDetailOrder((prev) => (prev ? { ...prev, status } : prev));
      }
    } catch {
      toastError('Update failed');
    } finally {
      setUpdatingId(null);
    }
  };

  const hasActiveFilters = Boolean(search || statusFilter);
  const inProgress = counts.processing + counts.shipped;
  const showStats = counts.total > 0;
  const showNeedsActionBanner = counts.pending > 0 && statusFilter !== 'PENDING';

  const changeStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  if (numbersLoading || !resolved) {
    return (
      <PageShell>
        <div className="space-y-4 p-4 sm:p-6">
          <SplitListSkeleton label="Loading orders" />
        </div>
      </PageShell>
    );
  }

  if (!hasConnectedNumber) {
    const copy = whatsappNotConnectedCopy(disconnectedNumbers, {
      task: 'track catalog purchases from WhatsApp',
    });
    return (
      <PageShell>
        <div className="p-4 sm:p-6">
          <EmptyState
            icon={Settings2}
            title={copy.title}
            description={copy.description}
            steps={
              copy.disconnected
                ? ['Open Settings', 'Reconnect this WhatsApp number', 'Come back here to track orders']
                : ['Open Settings', 'Connect your WhatsApp number', 'Come back here to track orders']
            }
            action={
              <Link to="/settings?tab=whatsapp">
                <AppButton icon={<Settings2 size={16} />}>{copy.cta}</AppButton>
              </Link>
            }
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          variant="clean"
          badge="Orders"
          badgeIcon={ShoppingBag}
          title="Orders"
          description="Track catalog purchases from WhatsApp and keep customers updated."
          stats={
            showStats
              ? [
                  {
                    label: 'To prepare',
                    value: counts.pending,
                    tone: 'text-amber-600',
                  },
                  {
                    label: 'In progress',
                    value: inProgress,
                    tone: 'text-sky-700 dark:text-sky-300',
                  },
                  {
                    label: 'Complete',
                    value: counts.completed,
                    tone: 'text-emerald-600',
                  },
                ]
              : undefined
          }
        />

        {showNeedsActionBanner && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:bg-amber-950/20">
            <div>
              <p className="text-[13px] font-bold text-amber-900 dark:text-amber-200">
                {counts.pending} order{counts.pending === 1 ? '' : 's'} waiting to be prepared
              </p>
              <p className="mt-0.5 text-[12px] text-amber-800/80 dark:text-amber-300/80">
                Start preparing, then tell the customer on WhatsApp.
              </p>
            </div>
            <AppButton variant="secondary" size="sm" onClick={() => changeStatusFilter('PENDING')}>
              View orders
            </AppButton>
          </div>
        )}

        <div className="inbox-shell overflow-hidden">
          <ListToolbar
            embedded
            compactMobile
            stackFilters
            search={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search name or phone..."
            filters={
              <div
                className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Order status"
              >
                {ORDER_STATUS_CHIPS.map((chip) => {
                  const active = statusFilter === chip.value;
                  return (
                    <button
                      key={chip.value || 'all'}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => changeStatusFilter(chip.value)}
                      className={`inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-[12px] font-semibold transition ${FOCUS_RING_CLASS} ${
                        active
                          ? 'bg-whatsapp-600 text-white shadow-[0_1px_3px_rgba(37,211,102,0.3)]'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            }
            actions={
              <AppButton variant="secondary" size="sm" icon={<RefreshCw size={15} />} onClick={load}>
                Refresh
              </AppButton>
            }
          />

          {loading && orders.length === 0 ? (
            <SplitListSkeleton label="Loading orders" />
          ) : orders.length === 0 ? (
            <CommerceEmptyWorkspace mode={hasActiveFilters ? 'filter' : 'empty'} />
          ) : (
            <>
              <CommerceOrderList
                orders={orders}
                onOpen={(order) => void openOrderDetail(order)}
                onUpdateStatus={(id, status) => void updateStatus(id, status)}
                updatingId={updatingId}
              />
              <div className="border-t border-theme-border px-4 py-3 sm:px-5">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  itemLabel="orders"
                />
              </div>
            </>
          )}
        </div>
      </div>

      <CommerceOrderDetailPanel
        order={detailData || detailOrder}
        open={Boolean(detailOrder)}
        loading={detailLoading && !detailData}
        onClose={() => {
          setDetailOrder(null);
          setDetailData(null);
        }}
        onUpdateStatus={updateStatus}
        updating={detailOrder ? updatingId === detailOrder.id : false}
      />
    </PageShell>
  );
}
