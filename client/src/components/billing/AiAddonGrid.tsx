import { useState } from 'react';
import { Bot, Clock, ImageIcon, Phone, Sparkles } from 'lucide-react';
import AppButton from '../ui/AppButton';
import type { AiCreditsResponse, AiTopupSkuClient } from '../../types';

interface AiAddonGridProps {
  aiCredits: AiCreditsResponse | null;
  canManage: boolean;
  razorpayConfigured: boolean;
  purchasingSku: string | null;
  onPurchase: (sku: AiTopupSkuClient, quantity?: number) => void;
}

function formatInr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function AddonCard({
  sku,
  canManage,
  razorpayConfigured,
  loading,
  onPurchase,
  quantity,
  onQuantityChange,
}: {
  sku: AiTopupSkuClient;
  canManage: boolean;
  razorpayConfigured: boolean;
  loading: boolean;
  onPurchase: () => void;
  quantity: number;
  onQuantityChange: (value: number) => void;
}) {
  const isCalling = sku.pool === 'calling';
  const Icon = isCalling ? Phone : Bot;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-theme-border bg-theme-surface p-4">
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              isCalling
                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                : 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-theme-fg">{sku.label}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
              {isCalling ? 'AI Calling' : 'AI Chat Agent'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-2xl font-black tabular-nums text-theme-fg">
          {sku.units.toLocaleString()}
          <span className="ml-1 text-xs font-semibold text-theme-muted">
            {isCalling ? 'min' : 'credits'}
          </span>
        </p>
        <p className="mt-1 text-[11px] font-medium text-theme-muted">{sku.description}</p>
        <p className="mt-2 text-sm font-bold text-theme-fg">
          {formatInr(sku.inclGstPaise * quantity)}{' '}
          <span className="text-[10px] font-medium text-theme-muted">incl. GST</span>
        </p>
        <label className="mt-2 flex items-center gap-2 text-[11px] font-medium text-theme-muted">
          Qty
          <select
            value={quantity}
            onChange={(e) => onQuantityChange(Number(e.target.value))}
            className="rounded-md border border-theme-border bg-theme-surface px-2 py-1 text-[11px] font-semibold text-theme-fg"
            disabled={!canManage || !razorpayConfigured || loading}
          >
            {[1, 2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <AppButton
          size="sm"
          variant="secondary"
          fullWidth
          disabled={!canManage || !razorpayConfigured}
          loading={loading}
          onClick={onPurchase}
        >
          Buy {quantity > 1 ? `${quantity} packs` : 'add-on'}
        </AppButton>
      </div>
    </div>
  );
}

export default function AiAddonGrid({
  aiCredits,
  canManage,
  razorpayConfigured,
  purchasingSku,
  onPurchase,
}: AiAddonGridProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const chatSkus = aiCredits?.topupSkus.filter((s) => s.pool === 'chat') ?? [];
  const callingSkus = aiCredits?.topupSkus.filter((s) => s.pool === 'calling') ?? [];

  const getQty = (skuId: string) => quantities[skuId] ?? 1;
  const setQty = (skuId: string, value: number) =>
    setQuantities((prev) => ({ ...prev, [skuId]: value }));

  return (
    <div id="ai-addons" className="space-y-5 scroll-mt-24">
      <div>
        <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
          Need more AI? Add extra credits
        </h3>
        <p className="mt-1 max-w-2xl text-[12px] font-medium text-theme-muted">
          Included credits come with your plan and reset each billing cycle. Add-on packs are extra —
          buy as many as you need. They stay on your account until used.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-600" />
          <h4 className="text-sm font-bold text-theme-fg">AI Chat Agent top-ups</h4>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {chatSkus.map((sku) => (
            <AddonCard
              key={sku.id}
              sku={sku}
              canManage={canManage}
              razorpayConfigured={razorpayConfigured}
              loading={purchasingSku === sku.id}
              quantity={getQty(sku.id)}
              onQuantityChange={(value) => setQty(sku.id, value)}
              onPurchase={() => onPurchase(sku, getQty(sku.id))}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-600" />
          <h4 className="text-sm font-bold text-theme-fg">AI Calling top-ups</h4>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {callingSkus.map((sku) => (
            <AddonCard
              key={sku.id}
              sku={sku}
              canManage={canManage}
              razorpayConfigured={razorpayConfigured}
              loading={purchasingSku === sku.id}
              quantity={getQty(sku.id)}
              onQuantityChange={(value) => setQty(sku.id, value)}
              onPurchase={() => onPurchase(sku, getQty(sku.id))}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-theme-border bg-theme-subtle/30 p-4 opacity-80">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold text-theme-fg">Content Studio credits</p>
              <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                Coming soon
              </span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-theme-muted">
              Image, video, and voice generation add-ons — separate from chat and calling. We are
              finalizing providers and pricing.
            </p>
          </div>
          <Sparkles className="h-4 w-4 shrink-0 text-theme-muted" />
        </div>
      </div>
    </div>
  );
}
