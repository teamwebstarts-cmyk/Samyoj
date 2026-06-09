import { useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';

export interface InteractivePayload {
  type: 'INTERACTIVE';
  interactive: {
    mode: 'reply';
    body: string;
    buttons: Array<{ id: string; title: string }>;
  };
}

interface InteractiveComposerProps {
  open: boolean;
  onClose: () => void;
  onSend: (payload: InteractivePayload) => Promise<void>;
  sending?: boolean;
}

export default function InteractiveComposer({
  open,
  onClose,
  onSend,
  sending,
}: InteractiveComposerProps) {
  const [body, setBody] = useState('');
  const [buttons, setButtons] = useState([
    { id: 'yes', title: 'Yes' },
    { id: 'no', title: 'No' },
  ]);

  if (!open) return null;

  const handleSend = async () => {
    const validButtons = buttons.filter((b) => b.title.trim()).slice(0, 3);
    if (!body.trim() || validButtons.length === 0) return;
    await onSend({
      type: 'INTERACTIVE',
      interactive: {
        mode: 'reply',
        body: body.trim(),
        buttons: validButtons.map((b, i) => ({
          id: b.id || `btn_${i}`,
          title: b.title.trim().slice(0, 20),
        })),
      },
    });
    setBody('');
    onClose();
  };

  return (
    <div className="border-t border-violet-200/60 bg-violet-50/40 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-bold text-violet-800">
          <LayoutGrid className="h-4 w-4" />
          Quick reply buttons
        </div>
        <button type="button" onClick={onClose} className="text-violet-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <AppTextarea
        label="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Choose an option below:"
      />
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {buttons.map((btn, i) => (
          <AppInput
            key={i}
            label={`Button ${i + 1}`}
            value={btn.title}
            onChange={(e) =>
              setButtons((prev) =>
                prev.map((b, idx) => (idx === i ? { ...b, title: e.target.value } : b))
              )
            }
            placeholder="Button label"
          />
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <AppButton variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </AppButton>
        <AppButton size="sm" loading={sending} onClick={() => void handleSend()}>
          Send buttons
        </AppButton>
      </div>
    </div>
  );
}
