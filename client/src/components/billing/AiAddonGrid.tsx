import { Bot, Clock, Phone } from 'lucide-react';
import AppButton from '../ui/AppButton';
import InfoTip from '../ui/InfoTip';
import type { AiCreditsResponse, AiTopupSkuClient } from '../../types';

interface AiAddonGridProps {
  aiCredits: AiCreditsResponse | null;
  canManage: boolean;
  razorpayConfigured: boolean;
  purchasingSku: string | null;
  onPurchase: (sku: AiTopupSkuClient) => void;
  canPurchaseChat?: boolean;
  canPurchaseCalling?: boolean;
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
  canPurchase = true,
}: {
  sku: AiTopupSkuClient;
  canManage: boolean;
  razorpayConfigured: boolean;
  loading: boolean;
  onPurchase: () => void;
  canPurchase?: boolean;
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
          {formatInr(sku.inclGstPaise)}{' '}
          <span className="text-[10px] font-medium text-theme-muted">incl. GST</span>
        </p>
      </div>
      <div className="mt-4">
        <AppButton
          size="sm"
          variant="secondary"
          fullWidth
          disabled={!canManage || !razorpayConfigured || !canPurchase}
          title={!canPurchase ? 'This AI capability is not included on your plan.' : undefined}
          loading={loading}
          onClick={onPurchase}
        >
          Buy add-on
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
  canPurchaseChat = true,
  canPurchaseCalling = true,
}: AiAddonGridProps) {
  const chatSkus = aiCredits?.topupSkus.filter((s) => s.pool === 'chat') ?? [];
  const callingSkus = aiCredits?.topupSkus.filter((s) => s.pool === 'calling') ?? [];

  return (
    <div id="ai-addons" className="space-y-5 scroll-mt-24">
      <div>
        <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
          Need more credits or minutes?
        </h3>
        <div className="mt-1 flex max-w-2xl items-start gap-1.5 text-[12px] font-medium text-theme-muted">
          <p>
            Included chat credits and calling minutes reset each billing cycle. Manual top-up packs
            are purchased once and stay on your account until used.
          </p>
          <InfoTip
            label="About manual AI top-ups"
            content="Top-ups are one-time manual purchases. They do not renew automatically, and customers cannot subscribe to or cancel a recurring AI add-on."
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Bot className="h-4 w-4 text-violet-600" />
          <h4 className="text-sm font-bold text-theme-fg">Chat credit top-ups</h4>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {chatSkus.map((sku) => (
            <AddonCard
              key={sku.id}
              sku={sku}
              canManage={canManage}
              razorpayConfigured={razorpayConfigured}
              canPurchase={canPurchaseChat}
              loading={purchasingSku === sku.id}
              onPurchase={() => onPurchase(sku)}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Clock className="h-4 w-4 text-sky-600" />
          <h4 className="text-sm font-bold text-theme-fg">Calling minute top-ups</h4>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {callingSkus.map((sku) => (
            <AddonCard
              key={sku.id}
              sku={sku}
              canManage={canManage}
              razorpayConfigured={razorpayConfigured}
              canPurchase={canPurchaseCalling}
              loading={purchasingSku === sku.id}
              onPurchase={() => onPurchase(sku)}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
