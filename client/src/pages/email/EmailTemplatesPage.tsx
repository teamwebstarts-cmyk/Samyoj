import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Copy,
  Check,
  Trash2,
  Plus,
  Mail,
} from 'lucide-react';
import PageShell from '../../components/ui/PageShell';
import MetaMockNotice from '../../components/meta/MetaMockNotice';
import EmailLoadingSkeleton from '../../components/email/EmailLoadingSkeleton';
import { GMAIL_MOCK_PREVIEW_BLOCK } from '../../utils/gmailMockData';
import EmailConnectScreen from '../../components/email/EmailConnectScreen';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Trash2 as TrashIcon } from 'lucide-react';
import {
  EMAIL_TEMPLATE_LIBRARY,
  nextTemplateName,
  useGmailWorkspace,
} from '../../components/email/emailData';
import { gmailApi, type GmailTemplate } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import './email.css';

const NAME_MAX = 50;
const SUBJECT_MAX = 200;
const BODY_MAX = 2000;

const TIPS = [
  'Use a clear and relevant subject line',
  'Keep the message short and to the point',
  'Personalize with variables',
  'Keep attachments in Compose, not saved templates',
] as const;

const SAMPLE_FILL: Record<string, string> = {
  '{{name}}': 'Asha',
  '{{email}}': 'asha@example.com',
  '{{phone}}': '+91 98765 43210',
};

function renderPreview(text: string, empty: string): ReactNode {
  if (!text.trim()) return <span className="ema-mail__empty">{empty}</span>;
  return text.split(/(\{\{[^}]+\}\})/g).map((part, i) => {
    if (!part) return null;
    const sample = SAMPLE_FILL[part];
    if (sample) return <mark key={i} className="ema-fill">{sample}</mark>;
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return <mark key={i} className="ema-fill ema-fill--miss">{part}</mark>;
    }
    return <span key={i}>{part}</span>;
  });
}

const TEMPLATE_VARIABLES = ['{{name}}', '{{email}}', '{{phone}}'] as const;

type EmailTemplate = GmailTemplate;

const blankTemplate = (): EmailTemplate => ({
  id: 'new',
  name: '',
  subject: '',
  textBody: '',
  htmlBody: null,
  createdAt: '',
  updatedAt: '',
});

/**
 * Email Templates — narrow list, create/edit in the middle, live preview on the right.
 */
export default function EmailTemplatesPage() {
  const { status, templates, loading, error: loadError, mockPreview, refresh } = useGmailWorkspace();
  const connected = status?.status === 'connected';
  const mailboxEmail = status?.email || '';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailTemplate>(blankTemplate());
  const [copied, setCopied] = useState(false);
  const activeField = useRef<'subject' | 'body'>('body');
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [browseTab, setBrowseTab] = useState<'yours' | 'library'>('yours');
  const [libraryPreviewId, setLibraryPreviewId] = useState<string>(EMAIL_TEMPLATE_LIBRARY[0].id);
  const [actionError, setActionError] = useState('');

  const isEditingNew = selectedId === null;
  const canSave = useMemo(
    () => Boolean(draft.name.trim() && draft.subject.trim() && draft.textBody.trim()),
    [draft]
  );
  const dirty = useMemo(() => {
    if (isEditingNew) return Boolean(draft.name.trim() || draft.subject.trim() || draft.textBody.trim());
    const saved = templates.find((t) => t.id === selectedId);
    if (!saved) return false;
    return saved.name !== draft.name || saved.subject !== draft.subject || saved.textBody !== draft.textBody;
  }, [draft, isEditingNew, selectedId, templates]);

  const libraryItem = useMemo(
    () => EMAIL_TEMPLATE_LIBRARY.find((item) => item.id === libraryPreviewId) ?? EMAIL_TEMPLATE_LIBRARY[0],
    [libraryPreviewId],
  );
  const previewSubject = browseTab === 'library' ? libraryItem.subject : draft.subject;
  const previewBody = browseTab === 'library' ? libraryItem.textBody : draft.textBody;
  const previewUnknownVars = useMemo(() => {
    const found = new Set<string>();
    const re = /\{\{[^}]+\}\}/g;
    for (const src of [previewSubject, previewBody]) {
      for (const match of src.matchAll(re)) {
        if (!SAMPLE_FILL[match[0]]) found.add(match[0]);
      }
    }
    return [...found];
  }, [previewSubject, previewBody]);

  if (loading) {
    return (
      <PageShell list>
        <EmailLoadingSkeleton variant="templates" />
      </PageShell>
    );
  }

  // Not-connected gate — no template management until the mailbox is connected.
  if (!connected) {
    return (
      <PageShell>
        <div className="ema-page ema-shell">
          <EmailConnectScreen connectionStatus={status?.status} />
        </div>
      </PageShell>
    );
  }

  const selectTemplate = (t: EmailTemplate) => {
    setSelectedId(t.id);
    setDraft({ ...t });
  };

  const startNew = () => {
    setSelectedId(null);
    setDraft(blankTemplate());
  };

  const cancelEdit = () => {
    if (isEditingNew) {
      setDraft(blankTemplate());
      return;
    }
    const saved = templates.find((t) => t.id === selectedId);
    if (saved) setDraft({ ...saved });
  };

  const insertVariable = (token: string) => {
    const field = activeField.current;
    const el = field === 'subject' ? subjectRef.current : bodyRef.current;
    const key = field === 'subject' ? 'subject' : 'textBody';
    const max = field === 'subject' ? SUBJECT_MAX : BODY_MAX;
    const current = draft[key];
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = (current.slice(0, start) + token + current.slice(end)).slice(0, max);
    setDraft({ ...draft, [key]: next });
    const caret = Math.min(start + token.length, next.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const saveDraft = async () => {
    setActionError('');
    if (mockPreview) {
      setActionError(GMAIL_MOCK_PREVIEW_BLOCK);
      return;
    }
    try {
      const payload = {
        name: draft.name.trim(),
        subject: draft.subject.trim(),
        textBody: draft.textBody,
        htmlBody: null,
      };
      const response = isEditingNew
        ? await gmailApi.createTemplate(payload)
        : await gmailApi.updateTemplate(draft.id, payload);
      const saved = response.data.data;
      setSelectedId(saved.id);
      setDraft(saved);
      setSavedFlash(true);
      refresh();
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch (cause) {
      setActionError(getErrorMessage(cause, 'Could not save this template.'));
    }
  };

  const copyLibraryTemplate = async () => {
    const source = EMAIL_TEMPLATE_LIBRARY.find((item) => item.id === libraryPreviewId);
    if (!source) return;
    setActionError('');
    if (mockPreview) {
      setActionError(GMAIL_MOCK_PREVIEW_BLOCK);
      return;
    }
    try {
      const response = await gmailApi.createTemplate({
        name: nextTemplateName(source.name, templates),
        subject: source.subject,
        textBody: source.textBody,
        htmlBody: null,
      });
      setSelectedId(response.data.data.id);
      setDraft(response.data.data);
      setBrowseTab('yours');
      refresh();
    } catch (cause) {
      setActionError(getErrorMessage(cause, 'Could not copy this library template.'));
    }
  };

  const copyVariables = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE_VARIABLES.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <PageShell list>
      <div className="ema-page ema-shell ema-shell--templates">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-[var(--ema-ink)]">
              Email Templates
            </h1>
            <p className="mt-0.5 text-[12px] font-semibold text-[var(--ema-muted)]">
              Save a reusable template to send faster and keep your messaging consistent.
            </p>
          </div>
          <button type="button" className="ema-btn ema-btn--primary" onClick={startNew}>
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            New template
          </button>
        </div>
        {loadError ? <div className="ema-notice ema-notice--fail" role="alert">{loadError}</div> : null}
        {actionError ? <div className="ema-notice ema-notice--fail" role="alert">{actionError}</div> : null}
        {mockPreview ? <MetaMockNotice /> : null}

        <div className="ema-templates ema-templates--viewport">
          {/* ============ Left column: template list ============ */}
          <div className="ema-editor">
            <section className="ema-card ema-tlibrary">
              <div className="ema-ttabs" role="tablist" aria-label="Template browsing">
                <button type="button" role="tab" aria-selected={browseTab === 'yours'} className={`ema-ttab ${browseTab === 'yours' ? 'ema-ttab--on' : ''}`} onClick={() => setBrowseTab('yours')}>Yours ({templates.length})</button>
                <button type="button" role="tab" aria-selected={browseTab === 'library'} className={`ema-ttab ${browseTab === 'library' ? 'ema-ttab--on' : ''}`} onClick={() => setBrowseTab('library')}>Library (12)</button>
              </div>
              {browseTab === 'library' ? (
                <>
                  <div className="ema-card__head" style={{ paddingBottom: 10 }}>
                    <div>
                      <div className="ema-card__title">Template library</div>
                      <p className="ema-card__sub">{EMAIL_TEMPLATE_LIBRARY.length} starters · pick one to preview</p>
                    </div>
                  </div>
                  <div className="ema-tlist" style={{ paddingTop: 10 }}>
                    {EMAIL_TEMPLATE_LIBRARY.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`ema-trow ${item.id === libraryPreviewId ? 'ema-trow--on' : ''}`}
                        onClick={() => setLibraryPreviewId(item.id)}
                      >
                        <span className="ema-trow__main">
                          <span className="ema-trow__name block">{item.name}</span>
                          <span className="ema-trow__subject block">{item.subject}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
              <div className="ema-card__head" style={{ paddingBottom: 10 }}>
                <div>
                  <div className="ema-card__title">Your templates</div>
                  <p className="ema-card__sub">{templates.length} templates · pick one to preview</p>
                </div>
              </div>
              <div className="ema-tlist" style={{ paddingTop: 10 }}>
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ema-trow ${t.id === selectedId ? 'ema-trow--on' : ''}`}
                    onClick={() => selectTemplate(t)}
                  >
                    <span className="ema-trow__main">
                      <span className="ema-trow__name block">{t.name}</span>
                      <span className="ema-trow__subject block">{t.subject}</span>
                    </span>
                    <span className="ema-trow__time">{t.updatedAt}</span>
                    <span
                      className="ema-trow__del"
                      role="button"
                      tabIndex={0}
                      aria-label={`Delete ${t.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(t);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setDeleteTarget(t);
                        }
                      }}
                    >
                      <Trash2 className="h-[14px] w-[14px]" strokeWidth={2.1} />
                    </span>
                  </button>
                ))}
                {templates.length === 0 && (
                  <div className="ema-zero" style={{ padding: '22px 16px' }}>
                    <span className="ema-zero__icon">
                      <Plus className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <p className="ema-zero__title">No email templates yet</p>
                    <p className="ema-zero__desc">Create your first template with the New template button.</p>
                  </div>
                )}
              </div>
                </>
              )}
            </section>
          </div>

          <section className="ema-card ema-tcreate">
            {browseTab === 'library' ? (
              <>
                <div className="ema-card__head" style={{ paddingBottom: 10 }}>
                  <div className="min-w-0">
                    <div className="ema-card__title">{libraryItem.name}</div>
                    <p className="ema-card__sub">Read-only library starter · copy to save as yours</p>
                  </div>
                </div>
                <div className="ema-editor" style={{ padding: '0 16px 16px' }}>
                  <div className="ema-field">
                    <span className="ema-field__label">Subject</span>
                    <div className="ema-library-read">{libraryItem.subject}</div>
                  </div>
                  <div className="ema-field">
                    <span className="ema-field__label">Message</span>
                    <div className="ema-library-read ema-library-read--body">{libraryItem.textBody}</div>
                  </div>
                  <p className="ema-field__hint">
                    Library templates are read-only and never count as yours until copied.
                  </p>
                  <div className="ema-foot">
                    <button type="button" className="ema-btn ema-btn--primary" onClick={() => void copyLibraryTemplate()}>
                      <Copy className="h-4 w-4" /> Copy and edit
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="ema-card__head" style={{ paddingBottom: 10 }}>
              <div className="min-w-0">
                <div className="ema-card__title">
                  {isEditingNew ? 'Create template' : 'Edit template'}
                  {dirty && <span className="ema-unsaved">Unsaved</span>}
                </div>
                <p className="ema-card__sub">
                  {isEditingNew ? 'Contacts never see the template name.' : draft.name || 'Untitled template'}
                </p>
              </div>
            </div>
            <div className="ema-editor" style={{ padding: '0 16px 16px' }}>
                {/* Template name */}
                <div className="ema-field">
                  <span className="ema-field__label">
                    Template name <span className="ema-req">*</span>
                    <span className="ema-field__counter">{draft.name.length}/{NAME_MAX}</span>
                  </span>
                  <input
                    className="ema-input"
                    placeholder="e.g. Order follow-up"
                    maxLength={NAME_MAX}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                  <span className="ema-field__hint">
                    This is only for internal reference. Your contacts will not see this name.
                  </span>
                </div>

                {/* Subject */}
                <div className="ema-field">
                  <span className="ema-field__label">
                    Subject <span className="ema-req">*</span>
                    <span className="ema-field__counter">{draft.subject.length}/{SUBJECT_MAX}</span>
                  </span>
                  <input
                    ref={subjectRef}
                    className="ema-input"
                    placeholder="e.g. Your order is on the way, {{name}}"
                    maxLength={SUBJECT_MAX}
                    value={draft.subject}
                    onFocus={() => { activeField.current = 'subject'; }}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </div>

                {/* Plain text body */}
                <div className="ema-field">
                  <span className="ema-field__label">
                    Message <span className="ema-req">*</span>
                    <span className="ema-field__counter">{draft.textBody.length}/{BODY_MAX}</span>
                  </span>
                  <textarea
                    ref={bodyRef}
                    className="ema-textarea"
                    placeholder="Write your message here..."
                    maxLength={BODY_MAX}
                    rows={8}
                    value={draft.textBody}
                    onFocus={() => { activeField.current = 'body'; }}
                    onChange={(e) => setDraft({ ...draft, textBody: e.target.value })}
                  />
                </div>

                {/* Variables */}
                <div className="ema-field">
                  <span className="ema-field__label">
                    Insert a variable
                    <button type="button" className="ema-vars__copy" onClick={copyVariables}>
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy all
                        </>
                      )}
                    </button>
                  </span>
                  <div className="ema-vars">
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="ema-var"
                        title={`Insert ${v} into the field you are editing`}
                        onClick={() => insertVariable(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tips */}
                <div className="rounded-[12px] border border-[var(--ema-line)] bg-[var(--ema-wash)] p-3">
                  <p className="mb-2 text-[11.5px] font-extrabold text-[var(--ema-ink)]">Tips for better templates</p>
                  <ul className="flex flex-col gap-1.5">
                    {TIPS.map((tip) => (
                      <li key={tip} className="flex items-center gap-2 text-[11px] font-semibold text-[var(--ema-muted)]">
                        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--ema-green)]" strokeWidth={2.4} />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer */}
                <div className="ema-foot">
                  <button type="button" className="ema-btn ema-btn--ghost" onClick={cancelEdit}>
                    {isEditingNew ? 'Reset' : 'Cancel'}
                  </button>
                  <button type="button" className="ema-btn ema-btn--primary" disabled={!canSave} onClick={saveDraft}>
                    {savedFlash ? (
                      <>
                        <Check className="h-4 w-4" /> Saved
                      </>
                    ) : (
                      'Save Template'
                    )}
                  </button>
                </div>
            </div>
              </>
            )}
          </section>

          <aside className="ema-card ema-tpreview" aria-label="Email preview">
            <div className="ema-card__head" style={{ paddingBottom: 8 }}>
              <div>
                <div className="ema-card__title">
                  <Mail className="h-[15px] w-[15px] text-[var(--ema-primary)]" />
                  Preview
                </div>
                <p className="ema-card__sub">
                  {browseTab === 'library' ? 'How this library template would look' : 'How Asha would read this email'}
                </p>
              </div>
            </div>
            <div className="ema-mail">
              <div className="ema-mail__who">
                <span className="ema-avatar ema-avatar--pink" style={{ width: 36, height: 36, fontSize: 12 }}>A</span>
                <span className="min-w-0">
                  <span className="ema-mail__from">From {mailboxEmail}</span>
                  <span className="ema-mail__to">To Asha · asha@example.com</span>
                </span>
              </div>
              <h2 className="ema-mail__subject">
                {renderPreview(previewSubject, 'Subject appears here')}
              </h2>
              <div className="ema-mail__body">
                {renderPreview(
                  previewBody,
                  browseTab === 'library'
                    ? 'Pick a library template on the left.'
                    : 'Write a message on the left. It shows up here as you type.',
                )}
              </div>
            </div>
            <div className="ema-mail__legend">
              <span><mark className="ema-fill">Asha</mark> filled from the sample contact</span>
              {previewUnknownVars.length > 0 && (
                <span className="ema-mail__warn">
                  {previewUnknownVars.join(', ')} will be sent as written. Use {'{{name}}'}, {'{{email}}'}, or {'{{phone}}'}.
                </span>
              )}
            </div>
          </aside>
        </div>

        {/* Delete confirmation — brief §4.4: row Delete (confirm) */}
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget) return;
            if (mockPreview) {
              setActionError(GMAIL_MOCK_PREVIEW_BLOCK);
              setDeleteTarget(null);
              return;
            }
            void (async () => {
              try {
                await gmailApi.deleteTemplate(deleteTarget.id);
                if (deleteTarget.id === selectedId) startNew();
                setDeleteTarget(null);
                refresh();
              } catch (cause) {
                setActionError(getErrorMessage(cause, 'Could not delete this template.'));
              }
            })();
          }}
          title="Delete email template?"
          description={`"${deleteTarget?.name ?? 'This template'}" will be permanently removed. Past emails already sent with it are not affected.`}
          confirmLabel="Delete template"
          cancelLabel="Keep template"
          variant="danger"
          icon={TrashIcon}
        />
      </div>
    </PageShell>
  );
}
