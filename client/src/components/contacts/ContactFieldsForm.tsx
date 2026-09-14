import { useState, useMemo } from 'react';
import {
  ChevronDown,
  Code2,
  Plus,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import AppInput from '../ui/AppInput';
import AppTextarea from '../ui/AppTextarea';
import { messagingConsent } from '../../utils/plainLanguage';
import {
  INDIA_COUNTRY_CODE,
  INDIA_LOCAL_PHONE_PLACEHOLDER,
  PHONE_HINT,
  PHONE_PLACEHOLDER,
  sanitizeIndiaLocalPhoneInput,
} from '../../utils/phone';
import { normalizeCustomKey } from '../../utils/customAttributes';
import type { ContactFormValues } from './contactForm';
import { ContactConsentInfoTip } from './ContactConsentInfoTip';

interface ContactFieldsFormProps {
  form: ContactFormValues;
  onChange: (next: ContactFormValues) => void;
  /** Inbox uses a + prefix field; Contacts uses a plain input; edit hides phone. */
  phoneMode: 'plain' | 'inbox' | 'hidden';
  phoneError?: string | null;
  phoneHint?: string;
  phoneId?: string;
  phoneDisabled?: boolean;
  availableTags?: string[];
  /** Inbox new chat: phone + name first; optional fields behind a disclosure. */
  layout?: 'full' | 'compact';
}

const COMMON_TAG_SUGGESTIONS = ['VIP', 'Lead', 'Customer', 'Support', 'High Value', 'Hot Lead'];

const COMMON_VARIABLE_PRESETS = [
  { key: 'order_id', label: 'Order ID' },
  { key: 'company', label: 'Company' },
  { key: 'city', label: 'City' },
  { key: 'plan', label: 'Plan' },
  { key: 'amount', label: 'Amount' },
] as const;

const compactFieldInputClass =
  'h-9 w-full min-w-0 rounded-lg border border-theme-border bg-theme-surface px-3 text-[12px] text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus dark:focus:border-slate-500';

const fullFieldInputClass =
  'h-11 w-full min-w-0 rounded-xl border border-theme-border bg-theme-surface px-3.5 text-body text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus dark:focus:border-slate-500';

function parseStoredCustomRows(text: string): Array<{ key: string; value: string }> {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return { key: trimmed, value: '' };
      return {
        key: trimmed.slice(0, eq).trim(),
        value: trimmed.slice(eq + 1).trim(),
      };
    })
    .filter((row): row is { key: string; value: string } => Boolean(row));
}

function withTrailingEmptyRow(rows: Array<{ key: string; value: string }>) {
  if (rows.length === 0) return [{ key: '', value: '' }];
  const last = rows[rows.length - 1];
  if (last.key.trim() || last.value.trim()) {
    return [...rows, { key: '', value: '' }];
  }
  return rows;
}


/** Shared rich form for Contacts Add/Edit and Inbox New chat. */
export default function ContactFieldsForm({
  form,
  onChange,
  phoneMode,
  phoneError,
  phoneHint,
  phoneId = 'contact-phone',
  phoneDisabled = false,
  availableTags = [],
  layout = 'full',
}: ContactFieldsFormProps) {
  const [tagInput, setTagInput] = useState('');
  const [showOptional, setShowOptional] = useState(false);
  const isCompact = layout === 'compact';

  const set = (patch: Partial<ContactFormValues>) => onChange({ ...form, ...patch });

  // Tags parsing & management
  const tagList = useMemo(
    () =>
      form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [form.tags]
  );

  const addTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    const exists = tagList.some((t) => t.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setTagInput('');
      return;
    }
    const next = [...tagList, trimmed];
    set({ tags: next.join(', ') });
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    const next = tagList.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
    set({ tags: next.join(', ') });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
  };

  const allTagSuggestions = useMemo(() => {
    const combined = Array.from(new Set([...availableTags, ...COMMON_TAG_SUGGESTIONS]));
    return combined.filter(
      (sug) => !tagList.some((t) => t.toLowerCase() === sug.toLowerCase())
    );
  }, [availableTags, tagList]);

  // Custom attributes key-value rows parsing & management
  const storedCustomRows = useMemo(
    () => parseStoredCustomRows(form.customAttributes),
    [form.customAttributes],
  );

  const customFieldRows = useMemo(
    () => withTrailingEmptyRow(storedCustomRows),
    [storedCustomRows],
  );

  const updateCustomRows = (rows: Array<{ key: string; value: string }>) => {
    const text = rows
      .filter((r) => r.key.trim() || r.value.trim())
      .map((r) => `${r.key.trim()}=${r.value.trim()}`)
      .join('\n');
    set({ customAttributes: text });
  };

  const handleCustomFieldChange = (index: number, field: 'key' | 'value', value: string) => {
    const next = [...storedCustomRows];
    while (next.length <= index) next.push({ key: '', value: '' });
    if (field === 'key') {
      next[index].key = value;
    } else {
      next[index].value = value;
    }
    updateCustomRows(next);
  };

  const handleCustomKeyBlur = (index: number, raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const normalized =
      normalizeCustomKey(trimmed) ||
      trimmed.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!normalized || normalized === storedCustomRows[index]?.key) return;
    handleCustomFieldChange(index, 'key', normalized);
  };

  const addCustomField = (initialKey = '', initialValue = '') => {
    const next = [...storedCustomRows, { key: initialKey, value: initialValue }];
    updateCustomRows(next);
  };

  const removeCustomField = (index: number) => {
    const next = storedCustomRows.filter((_, i) => i !== index);
    updateCustomRows(next);
  };

  const availableVariablePresets = useMemo(() => {
    return COMMON_VARIABLE_PRESETS.filter(
      (preset) => !storedCustomRows.some((r) => r.key.toLowerCase() === preset.key.toLowerCase()),
    );
  }, [storedCustomRows]);

  // Detect duplicate keys for inline warning
  const duplicateKeys = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const row of storedCustomRows) {
      const k = row.key.trim().toLowerCase();
      if (!k) continue;
      if (seen.has(k)) dupes.add(k);
      else seen.add(k);
    }
    return dupes;
  }, [storedCustomRows]);

  const phoneField =
    phoneMode === 'plain' ? (
      <AppInput
        id={phoneId}
        label="Phone number"
        placeholder={PHONE_PLACEHOLDER}
        value={form.phone}
        onChange={(e) => set({ phone: e.target.value })}
        required
        disabled={phoneDisabled}
        hint={phoneHint ?? (phoneDisabled ? 'Phone cannot be changed' : PHONE_HINT)}
        inputMode="tel"
      />
    ) : phoneMode === 'inbox' ? (
      <div className="space-y-1.5">
        <label htmlFor={phoneId} className="text-label text-theme-secondary">
          Phone number
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] flex w-[3.25rem] items-center justify-center border-r border-theme-border/80 text-[14px] font-semibold leading-none text-whatsapp-600 dark:text-whatsapp-400"
            aria-hidden
          >
            +{INDIA_COUNTRY_CODE}
          </span>
          <input
            id={phoneId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            maxLength={10}
            value={form.phone}
            onChange={(e) => set({ phone: sanitizeIndiaLocalPhoneInput(e.target.value) })}
            placeholder={INDIA_LOCAL_PHONE_PLACEHOLDER}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneError ? `${phoneId}-error` : undefined}
            className={`h-11 w-full rounded-xl border bg-theme-surface pl-[4.25rem] pr-3.5 text-body tabular-nums text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus disabled:opacity-60 dark:focus:border-slate-500 ${
              phoneError
                ? 'border-red-300 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)] dark:border-red-500/40'
                : 'border-theme-border'
            }`}
          />
        </div>
        {phoneError ? (
          <p id={`${phoneId}-error`} className="text-caption font-medium text-red-600 dark:text-red-400">
            {phoneError}
          </p>
        ) : phoneHint ? (
          <p className="text-caption text-theme-muted">{phoneHint}</p>
        ) : null}
      </div>
    ) : null;

  const nameField = (
    <AppInput
      id="contact-name"
      label={isCompact ? 'Customer name (optional)' : 'Name'}
      placeholder="Customer name"
      value={form.name}
      onChange={(e) => set({ name: e.target.value })}
      autoComplete="name"
      icon={<User className="h-4 w-4" />}
    />
  );

  const emailField = (
    <AppInput
      id="contact-email"
      label="Email"
      placeholder="customer@example.com"
      type="email"
      value={form.email}
      onChange={(e) => set({ email: e.target.value })}
    />
  );

  const tagsSection = (
    <div
      className={
        isCompact
          ? 'space-y-2'
          : 'rounded-xl border border-theme-border/70 bg-theme-subtle/30 p-3.5 space-y-2.5'
      }
    >
      <div className="flex items-center justify-between">
        <label htmlFor="contact-tag-input" className="flex items-center gap-1.5 text-label text-theme-secondary">
          {!isCompact && <Tag className="h-3.5 w-3.5 text-violet-500" />}
          <span>{isCompact ? 'Tags (optional)' : 'Tags & Groups'}</span>
        </label>
        {!isCompact && (
          <span className="text-[11px] font-medium text-theme-muted">
            {tagList.length} {tagList.length === 1 ? 'tag' : 'tags'}
          </span>
        )}
      </div>

      {tagList.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagList.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50/90 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-300"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full p-0.5 text-violet-500 hover:bg-violet-200/60 hover:text-violet-800 dark:hover:bg-violet-900/60 dark:hover:text-violet-200"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id="contact-tag-input"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={() => {
            if (isCompact && tagInput.trim()) addTag(tagInput);
          }}
          placeholder={isCompact ? 'Type a tag, then Enter' : 'Type tag and press Enter...'}
          className="h-9 flex-1 rounded-lg border border-theme-border bg-theme-surface px-3 text-[12px] text-theme-fg shadow-input transition placeholder:text-theme-muted focus:border-slate-400 focus:outline-none focus:shadow-input-focus dark:focus:border-slate-500"
        />
        {!isCompact && (
          <button
            type="button"
            onClick={() => addTag(tagInput)}
            disabled={!tagInput.trim()}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-theme-border bg-white px-3 text-[12px] font-semibold text-theme-fg shadow-sm transition hover:bg-theme-subtle disabled:opacity-40 dark:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      {allTagSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {allTagSuggestions.slice(0, isCompact ? 4 : 6).map((sug) => (
            <button
              key={sug}
              type="button"
              onClick={() => addTag(sug)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-300 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600 transition hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-700 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:border-violet-700 dark:hover:text-violet-300"
            >
              <Plus className="h-2.5 w-2.5" />
              {sug}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const notesField = (
    <AppTextarea
      id="contact-notes"
      label={isCompact ? 'Notes (optional)' : 'Internal notes'}
      placeholder={
        isCompact ? 'Anything your team should know about this customer…' : 'Add context, preferences, or customer history...'
      }
      value={form.notes}
      onChange={(e) => set({ notes: e.target.value })}
      rows={isCompact ? 2 : 2}
    />
  );

  const customFieldsSection = (
    <div
      className={
        isCompact
          ? 'space-y-2'
          : 'rounded-xl border border-theme-border/70 bg-theme-subtle/30 p-3.5 space-y-3'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-label text-theme-secondary">
          {!isCompact && <Code2 className="h-3.5 w-3.5 text-sky-500" />}
          <span>{isCompact ? 'Extra details (optional)' : 'Custom Template Variables'}</span>
        </label>
        {!isCompact && (
          <span className="text-[11px] font-medium text-theme-muted">
            Used as <code className="font-mono text-sky-600 dark:text-sky-400">{'{{variable}}'}</code>
          </span>
        )}
      </div>

      {isCompact && (
        <p className="text-[11px] leading-snug text-theme-muted">
          Add field name and value — usable in campaign templates later.
        </p>
      )}

      <div className="space-y-1.5">
        <div
          className={`grid gap-2 px-0.5 ${
            isCompact
              ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_1.75rem]'
              : 'grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_2.25rem]'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Field</span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Value</span>
          <span className="sr-only">Remove</span>
        </div>

        <div className="space-y-1.5">
          {customFieldRows.map((row, idx) => {
            const hasContent = Boolean(row.key.trim() || row.value.trim());
            const isDuplicate = row.key.trim() && duplicateKeys.has(row.key.trim().toLowerCase());
            const hasKeyNoValue = row.key.trim() && !row.value.trim();
            const inputClass = isCompact ? compactFieldInputClass : fullFieldInputClass;
            const removeBtnClass = isCompact
              ? 'flex h-9 w-7 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40'
              : 'flex h-11 w-9 shrink-0 items-center justify-center rounded-lg border border-theme-border bg-white text-neutral-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:bg-neutral-800 dark:hover:bg-red-950/40';

            return (
              <div key={`custom-field-${idx}`} className="space-y-0.5">
                <div
                  className={`grid items-center gap-2 ${
                    isCompact
                      ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_1.75rem]'
                      : 'grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_2.25rem]'
                  }`}
                >
                  <input
                    type="text"
                    aria-label="Field name"
                    placeholder={isCompact ? 'order_id' : 'e.g. order_id'}
                    value={row.key}
                    onChange={(e) => handleCustomFieldChange(idx, 'key', e.target.value)}
                    onBlur={(e) => handleCustomKeyBlur(idx, e.target.value)}
                    className={`${inputClass} ${isDuplicate ? 'border-amber-400 focus:border-amber-500 dark:border-amber-600/60' : ''}`}
                  />
                  <input
                    type="text"
                    aria-label="Value"
                    placeholder="Value"
                    value={row.value}
                    onChange={(e) => handleCustomFieldChange(idx, 'value', e.target.value)}
                    className={inputClass}
                  />
                  {hasContent ? (
                    <button
                      type="button"
                      onClick={() => removeCustomField(idx)}
                      className={removeBtnClass}
                      aria-label="Remove field"
                    >
                      <Trash2 className={isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                    </button>
                  ) : (
                    <span aria-hidden className="w-7 shrink-0" />
                  )}
                </div>
                {isDuplicate && (
                  <p className="px-0.5 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
                    ⚠ Duplicate key — only the last value will be saved.
                  </p>
                )}
                {!isDuplicate && hasKeyNoValue && (
                  <p className="px-0.5 text-[10.5px] text-theme-muted">
                    Empty value — this field won't be saved until you add a value.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {isCompact && (
          <p className="px-0.5 text-[10.5px] text-theme-muted">
            Type a name or pick a suggestion below.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => addCustomField()}
          className="inline-flex items-center gap-1 rounded-lg border border-theme-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-theme-fg shadow-sm transition hover:bg-theme-subtle dark:bg-neutral-800"
        >
          <Plus className="h-3 w-3" />
          {isCompact ? 'Add field' : 'Add custom field'}
        </button>

        {availableVariablePresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] font-medium text-theme-muted">
              {isCompact ? 'Suggestions:' : 'Presets:'}
            </span>
            {availableVariablePresets.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => addCustomField(preset.key, '')}
                className="inline-flex items-center gap-0.5 rounded-md border border-dashed border-sky-300 bg-sky-50/70 px-2 py-0.5 text-[10.5px] font-medium text-sky-700 transition hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300"
              >
                <Plus className="h-2.5 w-2.5" />
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const consentField = (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-theme-border bg-theme-subtle/40 px-4 py-3 transition hover:bg-theme-subtle/60">
      <input
        type="checkbox"
        checked={form.optedIn}
        onChange={(e) => set({ optedIn: e.target.checked })}
        className="mt-0.5 h-4 w-4 rounded border-theme-border text-emerald-600 focus:ring-emerald-500/30"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[13px] font-semibold text-theme-fg">{messagingConsent.allowCampaignMessages}</p>
          <ContactConsentInfoTip />
        </div>
        <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-theme-muted">
          {messagingConsent.allowCampaignHint}
        </p>
      </div>
    </label>
  );

  if (isCompact) {
    return (
      <div className="space-y-4">
        {phoneField}
        {nameField}

        <button
          type="button"
          onClick={() => setShowOptional((open) => !open)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-theme-border/80 bg-theme-subtle/30 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-theme-secondary transition hover:bg-theme-subtle/60"
          aria-expanded={showOptional}
        >
          <span>More options (email, tags, notes…)</span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-theme-muted transition ${showOptional ? 'rotate-180' : ''}`}
          />
        </button>

        {showOptional && (
          <div className="space-y-4 border-t border-theme-border/60 pt-4">
            {emailField}
            {tagsSection}
            {notesField}
            {customFieldsSection}
            {consentField}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {phoneField}

      <div className="grid gap-3 sm:grid-cols-2">
        {nameField}
        {emailField}
      </div>

      {tagsSection}
      {notesField}
      {customFieldsSection}
      {consentField}
    </div>
  );
}
