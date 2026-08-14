import { Link } from 'react-router-dom';
import { ArrowRight, Inbox, Package, Search, Settings2, ShoppingBag } from 'lucide-react';
import AppButton from '../ui/AppButton';
import InboxEmptyIcon from '../inbox/InboxEmptyIcon';
import CommerceOrderList from './CommerceOrderList';
import { EXAMPLE_ORDERS } from './exampleOrders';
import type { CommerceOrder } from './commerceUi';

const FLOW = [
  { title: 'WhatsApp catalog', detail: 'Customer browses your products in WhatsApp.' },
  { title: 'They send a cart', detail: 'The order arrives as a WhatsApp message.' },
  { title: 'It shows up here', detail: 'You prepare it and update them from this list.' },
];

interface CommerceEmptyWorkspaceProps {
  mode: 'empty' | 'filter';
  onOpenExample: (order: CommerceOrder) => void;
}

export default function CommerceEmptyWorkspace({ mode, onOpenExample }: CommerceEmptyWorkspaceProps) {
  if (mode === 'filter') {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <InboxEmptyIcon icon={Search} tone="muted" size="md" />
        <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">No orders match</h3>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-theme-secondary">
          Try a different name, phone, or status.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="flex items-center gap-3">
            <InboxEmptyIcon icon={ShoppingBag} size="sm" />
            <div>
              <h3 className="text-[16px] font-bold tracking-tight text-theme-fg">Waiting for catalog orders</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-theme-secondary">
                You don’t create orders in Samyoj. They appear automatically when a customer sends a
                product cart from WhatsApp.
              </p>
            </div>
          </div>

          <ol className="mt-5 space-y-3">
            {FLOW.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {index + 1}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-theme-fg">{step.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-theme-muted">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/inbox">
              <AppButton size="sm" icon={<Inbox size={15} />}>
                Open Inbox
              </AppButton>
            </Link>
            <Link to="/settings">
              <AppButton size="sm" variant="secondary" icon={<Settings2 size={15} />}>
                WhatsApp settings
              </AppButton>
            </Link>
          </div>
        </div>

        <div className="hidden min-w-[220px] rounded-2xl border border-theme-border bg-[#f7faf9] p-4 dark:bg-slate-900/40 lg:block">
          <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">How it connects</p>
          <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-theme-fg">
            <Package className="h-3.5 w-3.5 text-emerald-600" />
            Catalog
            <ArrowRight className="h-3.5 w-3.5 text-theme-muted" />
            Chat
            <ArrowRight className="h-3.5 w-3.5 text-theme-muted" />
            Orders
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-theme-secondary">
            Same WhatsApp number, same customer chat. This page is only for fulfilling what already
            arrived.
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-dashed border-emerald-200/80 bg-white dark:border-emerald-500/20 dark:bg-neutral-950">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-border/70 px-4 py-2.5 sm:px-5">
          <div>
            <p className="text-[12px] font-bold text-theme-fg">Example list</p>
            <p className="text-[11px] text-theme-muted">Preview only — tap a row to see the order panel.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            Not real orders
          </span>
        </div>
        <CommerceOrderList orders={EXAMPLE_ORDERS} preview onOpen={onOpenExample} />
      </div>
    </div>
  );
}
