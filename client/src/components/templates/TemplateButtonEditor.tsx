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
  { value: 'COPY_CODE', label: 'Copy offer code' },
];

interface TemplateButtonEditorProps {
  buttons: TemplateButtonForm[];
  onChange: (buttons: TemplateButtonForm[]) => void;
  maxButtons?: number;
  category?: string;
}

export default function TemplateButtonEditor({
  buttons,
  onChange,
  maxButtons = 10,
  category,
}: TemplateButtonEditorProps) {
  const effectiveMax = category === 'AUTHENTICATION' ? 1 : maxButtons;

  const addButton = () => {
    if (buttons.length >= effectiveMax) return;
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
          <p className="text-[13px] font-semibold text-theme-fg">Buttons</p>
          <p className="text-[11px] font-medium text-theme-muted">
            Optional · up to {effectiveMax} (Quick reply, URL, Call, or Copy code)
          </p>
        </div>
        <AppButton
          type="button"
          variant="ghost"
          size="sm"
          icon={<Plus size={14} />}
          onClick={addButton}
          disabled={buttons.length >= effectiveMax}
        >
          Add button
        </AppButton>
      </div>

      {buttons.length === 0 ? (
        <p className="rounded-xl border border-dashed border-theme-border bg-theme-subtle/80 px-3 py-4 text-center text-[12px] font-medium text-theme-muted">
          No buttons yet. Add quick replies or call-to-action links.
        </p>
      ) : (
        <div className="space-y-3">
          {buttons.map((btn, index) => (
            <div
              key={index}
              className="rounded-2xl border border-theme-border/80 bg-theme-subtle/50 p-3 ring-1 ring-theme-border/40"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
                  Button {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeButton(index)}
                  className="rounded-lg p-1.5 text-theme-muted transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
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
                      example: '',
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
              {btn.type === 'COPY_CODE' && (
                <AppInput
                  className="mt-3"
                  label="Sample offer code"
                  hint="Example code shown during Meta review"
                  placeholder="SALE25"
                  value={btn.example}
                  onChange={(e) => updateButton(index, { example: e.target.value })}
                  required
                  maxLength={15}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
