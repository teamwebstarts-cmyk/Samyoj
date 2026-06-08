import { useEffect, useMemo, useState } from 'react';
import { LayoutTemplate, Send, X } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import AppSelect from '../ui/AppSelect';
import { WhatsAppTemplatePreview, getTemplateParts } from './WhatsAppPreview';
import {
  getFilledTemplatePreview,
  templateNeedsHeaderMedia,
} from '../campaigns/campaignPreviewUtils';
import { templateApi } from '../../services/api';
import { countTemplateVars, getTemplateBodyText, getTemplateHeaderText } from '../../utils/templateUtils';
import type { MessageTemplate } from '../../types';

interface TemplateComposerProps {
  onSend: (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
  }) => void;
  sending: boolean;
  onCancel: () => void;
}

export default function TemplateComposer({ onSend, sending, onCancel }: TemplateComposerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateName, setTemplateName] = useState('');
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');

  useEffect(() => {
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setTemplates(list);
        if (list.length) setTemplateName(list[0].name);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.name === templateName),
    [templates, templateName],
  );

  useEffect(() => {
    if (!selected) return;
    setBodyParams(Array(countTemplateVars(getTemplateBodyText(selected))).fill(''));
    setHeaderParams(Array(countTemplateVars(getTemplateHeaderText(selected))).fill(''));
    setHeaderMediaUrl('');
  }, [selected]);

  const preview = selected
    ? getFilledTemplatePreview(selected, { bodyParams, headerParams })
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    onSend({
      templateName: selected.name,
      templateLanguage: selected.language,
      templateParams: {
        body: bodyParams.filter(Boolean),
        header: headerParams.filter(Boolean),
        headerMediaUrl: headerMediaUrl || undefined,
      },
    });
  };

  if (loading) {
    return (
      <div className="border-t border-amber-200/80 bg-gradient-to-r from-amber-50/95 to-orange-50/60 px-4 py-4 dark:from-amber-950/30 dark:to-orange-950/20">
        <p className="text-center text-[13px] font-medium text-amber-900">Loading templates...</p>
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="border-t border-amber-200/80 bg-gradient-to-r from-amber-50/95 to-orange-50/60 px-4 py-4 dark:from-amber-950/30 dark:to-orange-950/20">
        <p className="text-[13px] font-bold text-amber-950">No approved templates</p>
        <p className="mt-1 text-[12px] text-amber-900/85">
          Create and get a template approved under Templates to message outside the 24-hour window.
        </p>
        <AppButton type="button" variant="ghost" size="sm" className="mt-2" onClick={onCancel}>
          Cancel
        </AppButton>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-amber-200/80 bg-gradient-to-b from-amber-50/95 to-theme-surface px-3 py-3 sm:px-4 dark:from-amber-950/30"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <LayoutTemplate className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-amber-950 dark:text-amber-200">Send template</p>
            <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-400">
              24-hour window closed
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1.5 text-amber-700 transition hover:bg-amber-100/80"
          aria-label="Cancel template send"
        >
          <X size={16} />
        </button>
      </div>

      <AppSelect
        label="Approved template"
        value={templateName}
        options={templates.map((t) => ({
          value: t.name,
          label: `${t.name} (${t.language})`,
        }))}
        onChange={(e) => setTemplateName(e.target.value)}
        isSearchable
      />

      {bodyParams.map((_, i) => (
        <AppInput
          key={`inbox-body-${i}`}
          className="mt-3"
          label={`Body {{${i + 1}}}`}
          value={bodyParams[i]}
          onChange={(e) => {
            const next = [...bodyParams];
            next[i] = e.target.value;
            setBodyParams(next);
          }}
        />
      ))}

      {headerParams.map((_, i) => (
        <AppInput
          key={`inbox-header-${i}`}
          className="mt-3"
          label={`Header {{${i + 1}}}`}
          value={headerParams[i]}
          onChange={(e) => {
            const next = [...headerParams];
            next[i] = e.target.value;
            setHeaderParams(next);
          }}
        />
      ))}

      {selected && templateNeedsHeaderMedia(selected) && (
        <AppInput
          className="mt-3"
          label="Header media URL"
          placeholder="https://..."
          value={headerMediaUrl}
          onChange={(e) => setHeaderMediaUrl(e.target.value)}
        />
      )}

      {preview && selected && (
        <div className="mt-3 rounded-xl border border-theme-border bg-theme-surface p-3">
          <WhatsAppTemplatePreview
            {...preview}
            headerFormat={getTemplateParts(selected).headerFormat}
            headerMediaUrl={headerMediaUrl || undefined}
            variant="compact"
          />
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </AppButton>
        <AppButton
          type="submit"
          size="sm"
          icon={<Send size={14} />}
          loading={sending}
          disabled={!selected}
        >
          Send template
        </AppButton>
      </div>
    </form>
  );
}
