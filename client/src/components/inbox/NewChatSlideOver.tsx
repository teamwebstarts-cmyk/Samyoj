import { useEffect, useId, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ContactFieldsForm from '../contacts/ContactFieldsForm';
import {
  emptyContactForm,
  parseContactTagList,
  type ContactFormValues,
  type ContactStartPayload,
} from '../contacts/contactForm';
import { parseCustomAttributeLines } from '../../utils/customAttributes';
import { toastError } from '../../utils/toast';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { validateIndiaLocalPhone, toIndiaLocalDisplay } from '../../utils/phone';

interface NewChatSlideOverProps {
  open: boolean;
  onClose: () => void;
  onStart: (payload: ContactStartPayload) => Promise<void>;
  initialPhone?: string;
  initialName?: string;
}

export default function NewChatSlideOver({
  open,
  onClose,
  onStart,
  initialPhone = '',
  initialName = '',
}: NewChatSlideOverProps) {
  const phoneId = useId();
  const [form, setForm] = useState<ContactFormValues>(() => ({
    ...emptyContactForm,
    phone: toIndiaLocalDisplay(initialPhone),
    name: initialName,
  }));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setForm(emptyContactForm);
    setPhoneError(null);
  };

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyContactForm,
      phone: toIndiaLocalDisplay(initialPhone || ''),
      name: initialName || '',
    });
    setPhoneError(null);
    setSaving(false);
  }, [open, initialPhone, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateIndiaLocalPhone(form.phone);
    if (!result.ok) {
      setPhoneError(result.error);
      toastError(result.error);
      return;
    }

    const tags = parseContactTagList(form.tags);
    const customAttributes = parseCustomAttributeLines(form.customAttributes);
    const payload: ContactStartPayload = {
      phone: result.phone,
      ...(form.name.trim() ? { name: form.name.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      ...(tags.length ? { tags } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      ...(Object.keys(customAttributes).length ? { customAttributes } : {}),
      optedIn: form.optedIn,
    };

    setSaving(true);
    try {
      await onStart(payload);
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
      onClose={onClose}
      title="New chat"
      subtitle="Enter a phone number to start chatting"
      icon={MessageCircle}
      accent="emerald"
      footer={
        <SlideOverFooter onCancel={onClose} submitLabel="Start chat" loading={saving} />
      }
    >
      <form id="slideover-form" onSubmit={handleSubmit} className="new-chat-form space-y-5">
        <ContactFieldsForm
          key={open ? 'new-chat-open' : 'new-chat-closed'}
          form={form}
          onChange={(next) => {
            setForm(next);
            if (phoneError) setPhoneError(null);
          }}
          phoneMode="inbox"
          phoneId={phoneId}
          phoneError={phoneError}
          layout="compact"
        />
      </form>
    </SlideOver>
  );
}
