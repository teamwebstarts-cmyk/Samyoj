import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, Plus, Rocket, Save, Settings2, Trash2 } from 'lucide-react';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import { CanvasPageSkeleton } from '../components/ui/ListLayoutSkeleton';
import PageShell, { PAGE_GUTTER_X } from '../components/ui/PageShell';
import { flowAssetsApi } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Text area' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'date', label: 'Date' },
] as const;

type FieldType = (typeof FIELD_TYPES)[number]['value'];

interface MetaFlowField {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
}

interface FlowAssetRecord {
  id: string;
  name: string;
  description?: string | null;
  flowJson: Record<string, unknown>;
  metaFlowId?: string | null;
  metaStatus?: string | null;
  status: string;
  version: number;
  validationErrors?: string[];
}

const DEFAULT_FIELDS: MetaFlowField[] = [
  { id: 'name', label: 'Full name', type: 'text', required: true },
  { id: 'email', label: 'Email address', type: 'email', required: true },
];

function fieldsFromFlowJson(flowJson: Record<string, unknown>): MetaFlowField[] {
  const screens = (flowJson.screens as Array<Record<string, unknown>>) || [];
  const main = screens[0];
  const layout = main?.layout as { children?: Array<Record<string, unknown>> } | undefined;
  const form = layout?.children?.find((c) => c.type === 'Form') as
    | { children?: Array<Record<string, unknown>> }
    | undefined;
  if (!form?.children) return DEFAULT_FIELDS;

  return form.children
    .filter((c) => c.type !== 'Footer')
    .map((c) => ({
      id: String(c.name || ''),
      label: String(c.label || ''),
      type: (c.type === 'TextArea'
        ? 'textarea'
        : c.type === 'Dropdown'
        ? 'dropdown'
        : c.type === 'DatePicker'
          ? 'date'
          : c['input-type'] === 'email'
            ? 'email'
            : c['input-type'] === 'phone'
              ? 'phone'
              : c['input-type'] === 'number'
                ? 'number'
                : 'text') as FieldType,
      required: Boolean(c.required),
      options:
        c.type === 'Dropdown'
          ? ((c['data-source'] as Array<{ title?: string }>) || []).map((o) => o.title || '')
          : undefined,
    }))
    .filter((f) => f.id);
}

export default function MetaFlowBuilder() {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [mobileTab, setMobileTab] = useState<'setup' | 'preview'>('setup');
  const [name, setName] = useState('New Meta Flow');
  const [description, setDescription] = useState('');
  const [title, setTitle] = useState('Tell us about yourself');
  const [submitLabel, setSubmitLabel] = useState('Submit');
  const [fields, setFields] = useState<MetaFlowField[]>(DEFAULT_FIELDS);
  const [asset, setAsset] = useState<FlowAssetRecord | null>(null);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const loadGenerationRef = useRef(0);

  const load = useCallback(async () => {
    if (!id || isNew || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    try {
      const { data } = await flowAssetsApi.get(id);
      if (
        requestNumberId !== activeNumberIdRef.current ||
        generation !== loadGenerationRef.current
      ) return;
      const record = data.data as FlowAssetRecord;
      setAsset(record);
      setName(record.name);
      setDescription(record.description || '');
      const flowJson = record.flowJson || {};
      const screens = (flowJson.screens as Array<{ title?: string }>) || [];
      if (screens[0]?.title) setTitle(screens[0].title);
      const firstLayout = screens[0] as
        | { layout?: { children?: Array<{ type?: string; label?: string }> } }
        | undefined;
      const footer = firstLayout?.layout?.children
        ?.flatMap((child) => {
          const formChildren = (child as { children?: Array<{ type?: string; label?: string }> }).children;
          return formChildren || [];
        })
        .find((child) => child.type === 'Footer');
      if (footer?.label) setSubmitLabel(footer.label);
      setFields(fieldsFromFlowJson(flowJson));
    } catch (err) {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === loadGenerationRef.current
      ) {
        toastError(getErrorMessage(err, 'Failed to load Meta Flow'));
      }
    } finally {
      if (
        requestNumberId === activeNumberIdRef.current &&
        generation === loadGenerationRef.current
      ) {
        setLoading(false);
      }
    }
  }, [activeNumber, id, isNew, resolved]);

  useEffect(() => {
    load();
  }, [load]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    loadGenerationRef.current += 1;
    setLoading(!isNew);
    setAsset(null);
    setName(isNew ? 'New Meta Flow' : '');
    setDescription('');
    setTitle('Tell us about yourself');
    setSubmitLabel('Submit');
    setFields(DEFAULT_FIELDS);
    setMobileTab('setup');
    if (!isNew) load();
  });

  const previewJson = useMemo(() => {
    const formName = 'main_form';
    const payload: Record<string, string> = {};
    for (const field of fields) payload[field.id] = `\${form.${field.id}}`;

    const children = fields.map((field) => {
      if (field.type === 'dropdown' && field.options?.length) {
        return {
          type: 'Dropdown',
          name: field.id,
          label: field.label,
          required: Boolean(field.required),
          'data-source': field.options.map((opt) => ({ id: opt, title: opt })),
        };
      }
      if (field.type === 'date') {
        return {
          type: 'DatePicker',
          name: field.id,
          label: field.label,
          required: Boolean(field.required),
        };
      }
      return {
        type: 'TextInput',
        name: field.id,
        label: field.label,
        required: Boolean(field.required),
        'input-type': field.type === 'email' ? 'email' : field.type === 'phone' ? 'phone' : field.type === 'number' ? 'number' : 'text',
      };
    });

    children.push({
      type: 'Footer',
      label: submitLabel,
      'on-click-action': { name: 'complete', payload },
    } as never);

    return {
      version: '3.1',
      screens: [
        {
          id: 'MAIN',
          title,
          terminal: true,
          layout: {
            type: 'SingleColumnLayout',
            children: [{ type: 'Form', name: formName, children }],
          },
        },
      ],
    };
  }, [fields, submitLabel, title]);

  const addField = () => {
    const idx = fields.length + 1;
    setFields([...fields, { id: `field_${idx}`, label: `Field ${idx}`, type: 'text' }]);
  };

  const updateField = (index: number, patch: Partial<MetaFlowField>) => {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = async (): Promise<boolean> => {
    const normalizedFields = fields.map((field) => ({
      ...field,
      id: field.id.trim(),
      label: field.label.trim(),
      options: field.options?.map((option) => option.trim()).filter(Boolean),
    }));
    const ids = normalizedFields.map((field) => field.id);
    const hasDuplicateIds = new Set(ids).size !== ids.length;
    if (!name.trim() || !title.trim() || normalizedFields.length === 0) {
      toastError('Name, screen title, and at least one field are required');
      return false;
    }
    if (normalizedFields.some((field) => !field.id || !field.label)) {
      toastError('Every field needs an ID and label');
      return false;
    }
    if (hasDuplicateIds) {
      toastError('Each field ID must be unique');
      return false;
    }
    if (normalizedFields.some((field) => field.type === 'dropdown' && !field.options?.length)) {
      toastError('Dropdown fields need at least one option');
      return false;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        title: title.trim(),
        submitLabel: submitLabel.trim() || 'Submit',
        fields: normalizedFields,
      };
      if (isNew) {
        const { data } = await flowAssetsApi.create(payload);
        const created = data.data as FlowAssetRecord;
        toastSuccess('Meta Flow saved');
        navigate(`/automations/meta-flows/${created.id}`, { replace: true });
      } else {
        const { data } = await flowAssetsApi.update(id!, payload);
        setAsset(data.data as FlowAssetRecord);
        toastSuccess('Meta Flow updated');
      }
      setFields(normalizedFields);
      return true;
    } catch (err) {
      toastError(getErrorMessage(err, 'Failed to save Meta Flow'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isNew) {
      await handleSave();
      return;
    }
    setPublishing(true);
    try {
      if (!(await handleSave())) return;
      const { data } = await flowAssetsApi.publish(id!);
      const result = data.data as { asset: FlowAssetRecord; published: boolean };
      setAsset(result.asset);
      toastSuccess(result.published ? 'Published to Meta' : 'Submitted to Meta (pending review)');
    } catch (err) {
      toastError(getErrorMessage(err, 'Failed to publish Meta Flow'));
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <PageShell fullBleed>
        <CanvasPageSkeleton label="Loading Meta Flow builder" />
      </PageShell>
    );
  }

  return (
    <PageShell fullBleed>
      <div className="flex min-h-[100dvh] flex-col">
        <header className={`border-b border-theme-border bg-theme-surface ${PAGE_GUTTER_X} py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link to="/automations" className="text-slate-500 hover:text-slate-800">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Meta Flow</p>
                <h1 className="text-lg font-semibold text-slate-900">{name}</h1>
                {asset?.metaFlowId && (
                  <p className="text-xs text-slate-500">
                    Meta ID: {asset.metaFlowId} · {asset.metaStatus || asset.status}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AppButton variant="secondary" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </AppButton>
              <AppButton onClick={handlePublish} disabled={publishing || saving}>
                <Rocket className="h-4 w-4" />
                {publishing ? 'Publishing...' : 'Publish'}
              </AppButton>
            </div>
          </div>
        </header>

        <div className={`grid flex-1 gap-6 lg:grid-cols-2 ${PAGE_GUTTER_X} py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6`}>
          <section className={`space-y-4 ${mobileTab === 'preview' ? 'hidden lg:block' : ''}`}>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Flow settings</h2>
              <div className="space-y-3">
                <AppInput label="Asset name" value={name} onChange={(e) => setName(e.target.value)} />
                <AppTextarea
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
                <AppInput label="Screen title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <AppInput
                  label="Submit button label"
                  value={submitLabel}
                  onChange={(e) => setSubmitLabel(e.target.value)}
                  maxLength={20}
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Form fields</h2>
                <AppButton variant="secondary" size="sm" onClick={addField}>
                  <Plus className="h-4 w-4" />
                  Add field
                </AppButton>
              </div>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={`${field.id}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-2 grid gap-2 sm:grid-cols-2">
                      <AppInput
                        label="Field ID"
                        value={field.id}
                        onChange={(e) => updateField(index, { id: e.target.value })}
                      />
                      <AppInput
                        label="Label"
                        value={field.label}
                        onChange={(e) => updateField(index, { label: e.target.value })}
                      />
                      <AppSelect
                        label="Type"
                        value={field.type}
                        onChange={(e) => updateField(index, { type: e.target.value as FieldType })}
                        options={FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                      />
                      <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(e) => updateField(index, { required: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                    {field.type === 'dropdown' && (
                      <AppInput
                        label="Options (comma-separated)"
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    )}
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                        onClick={() => removeField(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={`space-y-4 ${mobileTab === 'setup' ? 'hidden lg:block' : ''}`}>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Phone preview</h2>
              <div className="mx-auto max-w-xs rounded-3xl border border-slate-300 bg-slate-100 p-4 shadow-inner">
                <div className="rounded-2xl bg-white p-4 shadow">
                  <p className="mb-3 text-sm font-semibold text-slate-900">{title}</p>
                  <div className="space-y-3">
                    {fields.map((field) => (
                      <div key={field.id}>
                        <label className="mb-1 block text-xs text-slate-600">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </label>
                        <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs leading-9 text-slate-400">
                          {field.type === 'dropdown' ? 'Select...' : `Enter ${field.label.toLowerCase()}`}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white"
                  >
                    {submitLabel}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Flow JSON</h2>
              <pre className="max-h-80 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-emerald-100">
                {JSON.stringify(previewJson, null, 2)}
              </pre>
              {asset?.validationErrors && asset.validationErrors.length > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  Meta validation: {asset.validationErrors.join('; ')}
                </p>
              )}
            </div>
          </section>
        </div>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 flex border-t border-theme-border bg-theme-surface/95 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-label="Meta Flow builder tabs"
        >
          {([
            { id: 'setup' as const, label: 'Setup', icon: Settings2 },
            { id: 'preview' as const, label: 'Preview', icon: Eye },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileTab(id)}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-micro font-bold ${
                mobileTab === id
                  ? 'text-whatsapp-600 dark:text-whatsapp-400'
                  : 'text-theme-muted'
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </PageShell>
  );
}
