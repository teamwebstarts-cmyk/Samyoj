import { useEffect, useState } from 'react';
import { CreditCard, ExternalLink } from 'lucide-react';
import { whatsappApi } from '../../services/api';

const META_PAYMENT_HELP_URL = 'https://www.facebook.com/business/help/488291839463771';

interface MetaPaymentCalloutProps {
  showWhenConnected?: boolean;
  className?: string;
}

export default function MetaPaymentCallout({
  showWhenConnected = true,
  className = '',
}: MetaPaymentCalloutProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [missingPayment, setMissingPayment] = useState(false);

  useEffect(() => {
    if (!showWhenConnected) return;
    let cancelled = false;
    void whatsappApi
      .paymentHint()
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data as
          | { message?: string; hasPaymentMethod?: boolean | null; connected?: boolean }
          | undefined;
        if (!data?.connected) return;
        setMessage(data.message || null);
        setMissingPayment(data.hasPaymentMethod === false);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage(
            'Add a payment method in Meta Business Suite (WhatsApp Manager) to send templates and Cloud API messages.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showWhenConnected]);

  if (!message) return null;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
        missingPayment
          ? 'border-amber-200/90 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100'
          : 'border-sky-200/80 bg-sky-50/50 text-sky-950 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100'
      } ${className}`}
    >
      <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold leading-relaxed">{message}</p>
        <a
          href={META_PAYMENT_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-whatsapp-700 hover:underline dark:text-whatsapp-400"
        >
          Open Meta payment help
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
