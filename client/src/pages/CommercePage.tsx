import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, RefreshCw } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import StatusBadge from '../components/ui/StatusBadge';
import { commerceApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';

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

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
  }).format(cents / 100);
}

export default function CommercePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    commerceApi
      .orders()
      .then((res) => setOrders(res.data.data.orders || []))
      .catch(() => toastError('Failed to load orders'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await commerceApi.updateStatus(id, { status });
      toastSuccess('Order updated');
      load();
    } catch {
      toastError('Update failed');
    }
  };

  return (
    <PageShell>
      <div className="mb-4 flex justify-end">
        <AppButton variant="secondary" size="sm" icon={<RefreshCw size={14} />} onClick={load}>
          Refresh
        </AppButton>
      </div>

      <PageHero
        badge="Orders"
        badgeIcon={Package}
        title="Order management"
        description="Track and update order status for catalog purchases received via WhatsApp."
        accent="emerald"
        stats={[
          { label: 'Total orders', value: orders.length },
          {
            label: 'Pending',
            value: orders.filter((o) => o.status === 'PENDING').length,
            tone: 'text-amber-700',
          },
        ]}
      />

      {loading ? (
        <LoadingState label="Loading orders..." />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Orders appear when customers purchase via your WhatsApp catalog."
          action={
            <Link to="/settings?tab=whatsapp" className="btn-primary inline-flex rounded-xl px-4 py-2 text-[13px] font-bold">
              Connect catalog
            </Link>
          }
        />
      ) : (
        <div className="dashboard-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="border-b border-theme-border bg-theme-subtle/50 text-[11px] font-bold uppercase tracking-wider text-theme-muted">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-theme-subtle/30">
                    <td className="px-4 py-3 font-mono text-[12px]">{order.referenceId}</td>
                    <td className="px-4 py-3">
                      {order.contact?.name || order.contact?.phone || '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatMoney(order.totalCents, order.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'PENDING' && (
                        <AppButton
                          size="sm"
                          variant="secondary"
                          onClick={() => updateStatus(order.id, 'PROCESSING')}
                        >
                          Mark processing
                        </AppButton>
                      )}
                      {order.status === 'PROCESSING' && (
                        <AppButton
                          size="sm"
                          variant="secondary"
                          onClick={() => updateStatus(order.id, 'SHIPPED')}
                        >
                          Mark shipped
                        </AppButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
