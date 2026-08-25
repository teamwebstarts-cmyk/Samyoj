import { useCallback, useEffect, useRef, useState } from 'react';
import { FormInput, Plus, RefreshCw } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import EmptyState from '../ui/EmptyState';
import LoadingState from '../ui/LoadingState';
import SlideOver, { SlideOverFooter } from '../ui/SlideOver';
import { waFormsApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { toastError, toastSuccess } from '../../utils/toast';
import type { WaFormFieldInput, WhatsAppForm } from '../../types';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
] as const;

const DEFAULT_FIELDS: WaFormFieldInput[] = [
  { id: 'name', label: 'Full name', type: 'text', required: true },
  { id: 'email', label: 'Email address', type: 'email', required: true },
];

function statusLabel(status: string) {
  if (status === 'PUBLISHED') return 'Ready';
  if (status === 'DRAFT') return 'Draft';
  if (status === 'DEPRECATED') return 'Deprecated';
  return status;
}

interface WaFormPickerProps {
  value?: string;
  onChange: (formId: string, formName?: string) => void;
}

export default function WaFormPicker({ value, onChange }: WaFormPickerProps) {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [forms, setForms] = useState<WhatsAppForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('Lead capture form');
  const [formTitle, setFormTitle] = useState('Tell us about yourself');
  const [submitLabel, setSubmitLabel] = useState('Submit');
  const [fields, setFields] = useState<WaFormFieldInput[]>(DEFAULT_FIELDS);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await waFormsApi.list();
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== requestGenerationRef.current
      ) return;
      const list = (data.data.forms || []) as WhatsAppForm[];
      setForms(list);
    } catch (err) {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === requestGenerationRef.current
      ) {
        toastError(getErrorMessage(err, 'Failed to load forms'));
      }
    } finally {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === requestGenerationRef.current
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeNumber, resolved]);

  useEffect(() => {
    load();
  }, [load]);

  const publishedForms = forms.filter((f) => f.status === 'PUBLISHED');
  const options = [
    { value: '', label: publishedForms.length ? 'Select a form...' : 'No published forms yet' },
    ...publishedForms.map((f) => ({ value: f.id, label: f.name })),
  ];

  const selected = forms.find((f) => f.id === value);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formTitle.trim() || fields.length === 0) return;
    setCreating(true);
    try {
      const { data } = await waFormsApi.create({
        name: formName.trim(),
        title: formTitle.trim(),
        submitLabel: submitLabel.trim() || 'Submit',
        fields,
      });
      const created = data.data.form as WhatsAppForm;
      toastSuccess(
        data.data.published
          ? 'Form created and is ready to use'
          : 'Form created — it may need a moment before Meta approves it'
      );
      setCreateOpen(false);
      await load(true);
      onChange(created.id, created.name);
    } catch (err) {
      toastError(getErrorMessage(err, 'Failed to create form'));
    } finally {
      setCreating(false);
    }
  };

  const addField = () => {
    const id = `field_${fields.length + 1}`;
    setFields([...fields, { id, label: `Field ${fields.length + 1}`, type: 'text' }]);
  };

  const updateField = (index: number, patch: Partial<WaFormFieldInput>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const removeField = (index: number) => {
    if (fields.length <= 1) return;
    setFields(fields.filter((_, i) => i !== index));
  };

  if (loading) {
    return <LoadingState label="Loading forms..." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <AppSelect
            label="Choose form"
            value={value || ''}
            options={options}
            isSearchable
            onChange={(e) => {
              const form = forms.find((f) => f.id === e.target.value);
              onChange(e.target.value, form?.name);
            }}
            hint="Forms open inside WhatsApp — no website needed"
          />
        </div>
        <AppButton
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
          onClick={() => load(true)}
          aria-label="Refresh forms"
        />
      </div>

      {selected && selected.status !== 'PUBLISHED' && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
          This form is <strong>{statusLabel(selected.status)}</strong> — it may not work until Meta marks it as ready.
        </div>
      )}

      {forms.length === 0 && (
        <EmptyState
          icon={FormInput}
          compact
          bare
          title="No forms yet"
          description="Create one here — we'll handle the WhatsApp setup for you."
          steps={['Tap Create new form below', 'Add fields like name and email', 'Use it in a WhatsApp Form step']}
        />
      )}

      <AppButton variant="secondary" size="sm" fullWidth icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
        Create new form
      </AppButton>

      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create in-chat form"
        subtitle="Build a simple form — customers fill it inside WhatsApp"
        size="md"
        footer={
          <SlideOverFooter
            onCancel={() => setCreateOpen(false)}
            submitLabel="Create form"
            loading={creating}
          />
        }
      >
        <form id="slideover-form" onSubmit={handleCreate} className="space-y-4">
          <AppInput
            label="Form name (for your reference)"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Lead capture form"
            required
          />
          <AppInput
            label="Title customers see"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="Tell us about yourself"
            required
          />
          <AppInput
            label="Submit button text"
            value={submitLabel}
            onChange={(e) => setSubmitLabel(e.target.value.slice(0, 20))}
            placeholder="Submit"
            hint="Max 20 characters"
          />

          <div className="space-y-2">
            <p className="text-[12px] font-bold text-neutral-700">Form fields</p>
            {fields.map((field, index) => (
              <div key={field.id} className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <AppInput
                      label={`Field ${index + 1} label`}
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                    />
                    <AppSelect
                      label="Type"
                      value={field.type}
                      options={FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                      isSearchable={false}
                      onChange={(e) => updateField(index, { type: e.target.value as WaFormFieldInput['type'] })}
                    />
                    <label className="flex items-center gap-2 text-[12px] font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        checked={Boolean(field.required)}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="mt-6 text-[11px] font-bold text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            {fields.length < 8 && (
              <AppButton variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addField}>
                Add field
              </AppButton>
            )}
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
