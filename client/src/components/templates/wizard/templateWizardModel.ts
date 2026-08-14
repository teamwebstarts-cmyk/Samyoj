import {
  AUTO_FILL_SAMPLES,
  buildCreatePayload,
  emptyTemplateForm,
  syncFormExamples,
  type TemplateFormState,
} from '../../../utils/templateForm';
import {
  getTemplateApprovalChecklist,
  validateTemplateForm,
  type TemplateValidationIssue,
} from '../../../utils/templateUtils';

export const templateWizardStages = [
  { id: 'create', label: 'Create', description: 'Design your message' },
  { id: 'review', label: 'Review', description: 'Add sample values' },
  { id: 'submit', label: 'Submit', description: 'Send for approval' },
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
    return all.filter((issue) => createFields.has(issue.field));
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
    const key = meta?.description || '';
    const pool = AUTO_FILL_SAMPLES[key];
    return pool?.[0] || (key === 'Customer name' ? 'Rahul' : `Sample ${i + 1}`);
  });
  const headerExamples = form.headerExamples.map((val, i) => {
    if (val.trim()) return val;
    const meta = form.variableMeta.find((m) => m.scope === 'header' && m.index === i + 1);
    const key = meta?.description || '';
    const pool = AUTO_FILL_SAMPLES[key];
    return pool?.[0] || `Sample ${i + 1}`;
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
  const lower = message.toLowerCase();
  if (lower.includes('duplicate') || lower.includes('already exists') || lower.includes('same name')) {
    return 'A template with this name already exists. Choose a different name or delete the old template first.';
  }
  if (lower.includes('limit') || lower.includes('250')) {
    return 'Template limit reached for your WhatsApp account. Delete unused templates and try again.';
  }
  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Too many submissions in a short time. Wait a few minutes and try again.';
  }
  if (lower.includes('media') || lower.includes('header')) {
    return 'Header media was rejected or invalid. Upload a different sample file and try again.';
  }
  if (lower.includes('resubmit') || lower.includes('rejected') || lower.includes('paused')) {
    return message;
  }
  if (/#\d{3,}|error code|oauth|graph\.facebook|invalid parameter|permission denied/i.test(lower)) {
    return 'WhatsApp couldn’t save this template. Check the website link and message text, then try again.';
  }
  return message || 'Couldn’t save the template. Check your message and try again.';
}

export function canResubmitTemplateStatus(status?: string) {
  return ['REJECTED', 'PAUSED', 'DISABLED'].includes((status || '').toUpperCase());
}

export { buildCreatePayload, syncFormExamples };
