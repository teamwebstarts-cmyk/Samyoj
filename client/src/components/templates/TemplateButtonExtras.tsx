import { Link2 } from 'lucide-react';
import AppInput from '../ui/AppInput';
import { templateDynamicUrlButtons, templateNeedsCoupon } from '../../utils/templateForm';
import type { MessageTemplate } from '../../types';

interface TemplateButtonExtrasProps {
  template?: MessageTemplate | null;
  couponCode: string;
  buttonUrlSuffixes: string[];
  onCouponChange: (value: string) => void;
  onSuffixChange: (index: number, value: string) => void;
  compact?: boolean;
}

export default function TemplateButtonExtras({
  template,
  couponCode,
  buttonUrlSuffixes,
  onCouponChange,
  onSuffixChange,
  compact = false,
}: TemplateButtonExtrasProps) {
  if (!template) return null;
  const needsCoupon = templateNeedsCoupon(template);
  const urls = templateDynamicUrlButtons(template);
  if (!needsCoupon && urls.length === 0) return null;

  const labelClass = compact
    ? 'text-[11px] font-semibold text-theme-secondary'
    : 'text-[11px] font-bold text-slate-600 dark:text-slate-300';
  const inputClass = compact ? '!h-9 text-[13px]' : '!h-9 rounded-lg text-[12px]';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
          <Link2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-200">
            {needsCoupon && urls.length === 0 ? 'Coupon' : urls.length > 1 ? 'Button links' : 'Button link'}
          </p>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {needsCoupon && urls.length > 0
              ? 'Coupon plus the unique ending, like order-123'
              : needsCoupon
                ? 'Code the customer can copy'
                : 'Only the unique ending, like order-123'}
          </p>
        </div>
      </div>
      {needsCoupon && (
        <AppInput
          label="Coupon code"
          hint={`${couponCode.length}/15`}
          placeholder="SAVE20"
          value={couponCode}
          maxLength={15}
          onChange={(event) => onCouponChange(event.target.value.slice(0, 15))}
          labelClassName={labelClass}
          className={inputClass}
          required
        />
      )}
      {urls.map((button, index) => (
        <AppInput
          key={`url-suffix-${button.text || 'link'}-${index}`}
          label={button.text || 'Link'}
          placeholder="e.g. order-123"
          value={buttonUrlSuffixes[index] || ''}
          onChange={(event) => onSuffixChange(index, event.target.value)}
          labelClassName={labelClass}
          className={inputClass}
          required
        />
      ))}
    </div>
  );
}
