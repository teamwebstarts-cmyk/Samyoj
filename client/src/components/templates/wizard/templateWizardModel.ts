import {
  buildCreatePayload,
  emptyTemplateForm,
  sampleForVariable,
  syncFormExamples,
  type TemplateFormState,
} from '../../../utils/templateForm';
import {
  getTemplateApprovalChecklist,
  validateTemplateForm,
  type TemplateValidationIssue,
} from '../../../utils/templateUtils';

export const templateWizardStages = [
  { id: 'create', label: 'Create', description: 'Write and connect fields' },
  { id: 'review', label: 'Review', description: 'Check and submit' },
  { id: 'submit', label: 'Submit', description: 'Sent for approval' },
] as const;

export type TemplateWizardMode = 'create' | 'resubmit';

export interface TemplateWizardSubmitResult {
  submissionId: string;
  submittedAt: string;
  templateName: string;
}

const DRAFT_STORAGE_KEY = 'samyoj_template_wizard_draft_v1';

export function createEmptyWizardForm(): TemplateFormState {
  return syncFormExamples({ ...emptyTemplateForm });
}

export function saveTemplateDraft(form: TemplateFormState, step: number, mode: TemplateWizardMode) {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ form, step, mode, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota */
  }
}

export function loadTemplateDraft():
  | { form: TemplateFormState; step: number; mode: TemplateWizardMode }
  | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      form: TemplateFormState;
      step: number;
      mode: TemplateWizardMode;
    };
    if (!parsed.form) return null;
    return {
      form: syncFormExamples({ ...emptyTemplateForm, ...parsed.form, variableMeta: parsed.form.variableMeta || [] }),
      step: parsed.step ?? 0,
      mode: parsed.mode ?? 'create',
    };
  } catch {
    return null;
  }
}

export function clearTemplateDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function validateTemplateWizardStep(
  step: number,
  form: TemplateFormState,
): TemplateValidationIssue[] {
  const all = validateTemplateForm(form);
  if (step === 0) {
    const createFields = new Set([
      'name',
      'body',
      'header',
      'footer',
      'category',
      'headerMediaHandle',
      'buttons',
    ]);
    return all.filter((issue) => createFields.has(issue.field) && issue.severity === 'error');
  }
  return all.filter((issue) => issue.severity === 'error');
}

export function wizardChecklistReady(form: TemplateFormState) {
  return getTemplateApprovalChecklist(form).every(
    (item) => item.passed || item.severity === 'warning',
  );
}

export function autoFillTemplateSamples(form: TemplateFormState): TemplateFormState {
  const bodyExamples = form.bodyExamples.map((val, i) => {
    if (val.trim()) return val;
    const meta = form.variableMeta.find((m) => m.scope === 'body' && m.index === i + 1);
    return sampleForVariable(meta?.description || '', i + 1, meta?.suggestedSource);
  });
  const headerExamples = form.headerExamples.map((val, i) => {
    if (val.trim()) return val;
    const meta = form.variableMeta.find((m) => m.scope === 'header' && m.index === i + 1);
    return sampleForVariable(meta?.description || '', i + 1, meta?.suggestedSource);
  });
  const buttons = form.buttons.map((btn) => {
    if (!btn.text.trim()) return btn;
    if (btn.type === 'PHONE_NUMBER' && !btn.phone_number.trim()) {
      return { ...btn, phone_number: '+919876543210' };
    }
    if (btn.type === 'COPY_CODE' && !btn.example.trim()) {
      return { ...btn, example: 'SAVE20' };
    }
    return btn;
  });
  return syncFormExamples({ ...form, bodyExamples, headerExamples, buttons });
}

export function buildSubmissionId() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `TMP_${now.getFullYear()}_${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function formatSubmissionDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getPreviewSampleParams(form: TemplateFormState) {
  const hasBody = form.bodyExamples.some((v) => v.trim());
  const hasHeader = form.headerExamples.some((v) => v.trim());
  if (hasBody || hasHeader) {
    return { bodyParams: form.bodyExamples, headerParams: form.headerExamples };
  }
  const filled = autoFillTemplateSamples(form);
  return { bodyParams: filled.bodyExamples, headerParams: filled.headerExamples };
}

/** Maps Meta/API errors to user-friendly wizard messages. */
export function mapTemplateApiError(message: string): string {
  const stripped = message.replace(/^(body|header|footer|buttons)(\.\d+)?[:\s]+/i, '').trim();
  const lower = stripped.toLowerCase();
  if (/too many calls|#?80008|\brate limit\b/i.test(lower)) {
    return 'WhatsApp is busy right now. Wait a minute, then try again.';
  }
  if (lower.includes('duplicate') || lower.includes('already exists') || lower.includes('same name')) {
    return 'A template with this name already exists. Rejected or pending templates still use that name — try a name like order_shipped_3.';
  }
  if (/\b(250 templates|template limit|too many templates)\b/.test(lower)) {
    return 'Template limit reached for your WhatsApp account. Delete unused templates and try again.';
  }
  if (/\b(rate limit|too many requests|too many submissions)\b/.test(lower)) {
    return 'Too many submissions in a short time. Wait a few minutes and try again.';
  }
  if (/\b(header media|header_handle|sample file for media headers)\b/.test(lower)) {
    return 'Header media was rejected or invalid. Upload a different sample file and try again.';
  }
  if (
    lower.includes('meta rejected this template:') ||
    lower.includes('leading or trailing') ||
    lower.includes('resubmit') ||
    lower.includes('paused')
  ) {
    return stripped.startsWith('Meta rejected') ? stripped : `Meta rejected this template: ${stripped}`;
  }
  if (/#\d{3,}|error code|oauth|graph\.facebook|invalid parameter|permission denied/i.test(lower)) {
    return 'WhatsApp couldn’t save this template. Check the website link and message text, then try again.';
  }
  return stripped || 'Couldn’t save the template. Check your message and try again.';
}

export function canResubmitTemplateStatus(status?: string) {
  return ['REJECTED', 'PAUSED', 'DISABLED'].includes((status || '').toUpperCase());
}

export { buildCreatePayload, syncFormExamples };
