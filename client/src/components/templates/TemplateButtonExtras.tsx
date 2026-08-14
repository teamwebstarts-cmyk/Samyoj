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
    <>
      {needsCoupon && (
        <AppInput
          label="Copy code / coupon *"
          hint={`${couponCode.length}/15 · customers can copy this from the message`}
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
          label={`${button.text || 'Website button'} link suffix *`}
          hint="Replaces {{1}} at the end of the button URL"
          placeholder="order-123"
          value={buttonUrlSuffixes[index] || ''}
          onChange={(event) => onSuffixChange(index, event.target.value)}
          labelClassName={labelClass}
          className={inputClass}
          required
        />
      ))}
    </>
  );
}
