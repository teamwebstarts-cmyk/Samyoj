import { useState } from 'react';
import { Phone, User } from 'lucide-react';
import AppAlert from '../ui/AppAlert';
import AppInput from '../ui/AppInput';
import { toastError } from '../../utils/toast';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhone } from '../../utils/phone';

interface NewChatSlideOverProps {
  open: boolean;
  onClose: () => void;
  onStart: (phone: string, name?: string) => Promise<void>;
}

export default function NewChatSlideOver({ open, onClose, onStart }: NewChatSlideOverProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const reset = () => {
    setPhone('');
    setName('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validatePhone(phone);
    if (!result.ok) {
      toastError(result.error);
      return;
    }

    setSaving(true);
    try {
      await onStart(result.phone, name.trim() || undefined);
      reset();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Could not start chat';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title="New chat"
      subtitle="Start a conversation with a customer"
      footer={
        <SlideOverFooter
          onCancel={handleClose}
          submitLabel="Start chat"
          loading={saving}
        />
      }
    >
      <form id="slideover-form" onSubmit={handleSubmit} className="space-y-4">
        <AppInput
          label="Phone number"
          hint={PHONE_HINT}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={PHONE_PLACEHOLDER}
          inputMode="tel"
          autoComplete="tel"
          required
          icon={<Phone className="h-4 w-4" />}
        />

        <AppInput
          label="Contact name"
          hint="Optional"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Customer name"
          autoComplete="name"
          icon={<User className="h-4 w-4" />}
        />

        <AppAlert variant="info">
          If the customer hasn&apos;t messaged you recently, free-text replies may be blocked. Use a
          template campaign when the 24-hour window is closed.
        </AppAlert>
      </form>
    </SlideOver>
  );
}
