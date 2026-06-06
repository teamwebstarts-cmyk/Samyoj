import { Plus, Trash2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import type { TemplateButtonForm, TemplateButtonType } from '../../utils/templateForm';
import { emptyTemplateButton } from '../../utils/templateForm';

const buttonTypeOptions: { value: TemplateButtonType; label: string }[] = [
  { value: 'QUICK_REPLY', label: 'Quick reply' },
  { value: 'URL', label: 'Visit website (URL)' },
  { value: 'PHONE_NUMBER', label: 'Call phone number' },
];

interface TemplateButtonEditorProps {
  buttons: TemplateButtonForm[];
  onChange: (buttons: TemplateButtonForm[]) => void;
  maxButtons?: number;
}

export default function TemplateButtonEditor({
  buttons,
  onChange,
  maxButtons = 3,
}: TemplateButtonEditorProps) {
  const addButton = () => {
    if (buttons.length >= maxButtons) return;
    onChange([...buttons, emptyTemplateButton('QUICK_REPLY')]);
  };

  const updateButton = (index: number, patch: Partial<TemplateButtonForm>) => {
    onChange(buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const removeButton = (index: number) => {
    onChange(buttons.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-neutral-800">Buttons</p>
          <p className="text-[11px] font-medium text-neutral-500">
            Optional · up to {maxButtons} (Quick reply, URL, or Call)
          </p>
        </div>
        <AppButton
          type="button"
          variant="ghost"
          size="sm"
          icon={<Plus size={14} />}
          onClick={addButton}
          disabled={buttons.length >= maxButtons}
        >
          Add button
        </AppButton>
      </div>

      {buttons.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 px-3 py-4 text-center text-[12px] font-medium text-neutral-500">
          No buttons yet. Add quick replies or call-to-action links.
        </p>
      ) : (
        <div className="space-y-3">
          {buttons.map((btn, index) => (
            <div
              key={index}
              className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-3 ring-1 ring-neutral-100"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                  Button {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeButton(index)}
                  className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <AppSelect
                  label="Type"
                  value={btn.type}
                  isSearchable={false}
                  options={buttonTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(e) =>
                    updateButton(index, {
                      type: e.target.value as TemplateButtonType,
                      url: '',
                      phone_number: '',
                    })
                  }
                />
                <AppInput
                  label="Button label"
                  placeholder="e.g. Track order"
                  value={btn.text}
                  onChange={(e) => updateButton(index, { text: e.target.value })}
                  required
                  maxLength={25}
                />
              </div>
              {btn.type === 'URL' && (
                <AppInput
                  className="mt-3"
                  label="Website URL"
                  hint="Use {{1}} for one dynamic parameter at the end"
                  placeholder="https://example.com/order/{{1}}"
                  value={btn.url}
                  onChange={(e) => updateButton(index, { url: e.target.value })}
                  required
                />
              )}
              {btn.type === 'PHONE_NUMBER' && (
                <AppInput
                  className="mt-3"
                  label="Phone number"
                  hint="E.164 format, e.g. +919876543210"
                  placeholder="+919876543210"
                  value={btn.phone_number}
                  onChange={(e) => updateButton(index, { phone_number: e.target.value })}
                  required
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
