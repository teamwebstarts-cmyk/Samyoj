import { useEffect, useRef, useState } from 'react';
import { IndianRupee } from 'lucide-react';
import InboxModal from './InboxModal';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import { useAutoFocus } from '../../hooks/inboxA11y';

export interface PaymentLinkFormValues {
  amountInr: number;
  description: string;
}

interface PaymentLinkModalProps {
  open: boolean;
  customerName?: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: PaymentLinkFormValues) => void;
}

export default function PaymentLinkModal({
  open,
  customerName,
  submitting,
  onClose,
  onSubmit,
}: PaymentLinkModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Payment request');
  const [error, setError] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);
  useAutoFocus(amountInputRef, open);

  useEffect(() => {
    if (open) {
      setAmount('');
      setDescription('Payment request');
      setError('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter a valid amount greater than 0');
      return;
    }
    setError('');
    onSubmit({
      amountInr: parsed,
      description: description.trim() || 'Payment request',
    });
  };

  return (
    <InboxModal
      open={open}
      onClose={onClose}
      title="Send payment link"
      subtitle={customerName ? `To ${customerName}` : 'Collect a payment in this chat'}
      icon={IndianRupee}
      iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AppInput
          label="Amount (INR)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="500"
          inputMode="decimal"
          type="number"
          min="1"
          step="0.01"
          error={error || undefined}
          icon={<IndianRupee className="h-4 w-4" />}
          required
          ref={amountInputRef}
        />

        <AppInput
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Payment request"
        />

        <p className="text-[11.5px] leading-relaxed text-theme-muted">
          A Razorpay link is generated and sent as a message in this conversation.
        </p>

        <div className="flex justify-end gap-2 border-t border-theme-border/60 pt-3.5">
          <AppButton variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </AppButton>
          <AppButton type="submit" loading={submitting} disabled={!amount.trim()}>
            Create &amp; send
          </AppButton>
        </div>
      </form>
    </InboxModal>
  );
}
