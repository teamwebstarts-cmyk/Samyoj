import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  X,
  Check,
  Info,
  ChevronDown,
  SendHorizontal,
  History,
  PenLine,
  Paperclip,
  Bold,
  Italic,
  Link as LinkIcon,
  Upload,
} from 'lucide-react';
import PageShell from '../../components/ui/PageShell';
import MetaMockNotice from '../../components/meta/MetaMockNotice';
import EmailLoadingSkeleton from '../../components/email/EmailLoadingSkeleton';
import { GMAIL_MOCK_PREVIEW_BLOCK } from '../../utils/gmailMockData';
import GmailGlyph from '../../components/email/GmailGlyph';
import EmailConnectScreen from '../../components/email/EmailConnectScreen';
import {
  GMAIL_ALLOWED_ATTACHMENT_MIMES,
  GMAIL_EMAIL_CONSENT_SOURCE,
  GMAIL_EMAIL_CONSENT_VERSION,
  GMAIL_MAX_ATTACHMENT_BYTES,
  GMAIL_MAX_ATTACHMENTS,
  GMAIL_MAX_DECODED_MIME_BYTES,
  avatarFor,
  formatDate,
  initials,
  plainTextFromMarkup,
  safeHtmlFromMarkup,
  statusLabel,
  useGmailWorkspace,
} from '../../components/email/emailData';
import { gmailApi, type GmailAttachment, type GmailContact, type GmailSend, type GmailTemplate } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { filterRecentSends, priorSendsFor } from './emailList';
import '../email/email.css';

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 2000;

const LIMITS_COPY =
  'Google limits this mailbox — about 500 emails/day on free Gmail, about 2,000/day on paid Workspace. If sending stops, wait up to 24 hours.';

type EmailContact = GmailContact & {
  name: string;
  email: string;
  avatar: ReturnType<typeof avatarFor>;
};

type EmailTemplate = GmailTemplate;

type DisplaySend = GmailSend & {
  name: string;
  email: string;
  body: string;
  sentAt: string;
  avatar: ReturnType<typeof avatarFor>;
  failReason?: string;
};

type AttachmentItem = {
  localId: string;
  file: File;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  uploaded?: GmailAttachment;
  error?: string;
  controller: AbortController;
};

function previewNodes(text: string, contact: EmailContact | null, empty: string): ReactNode {
  if (!text.trim()) return <span className="ema-mail__empty">{empty}</span>;
  const fill: Record<string, string> = contact
    ? { '{{name}}': contact.name, '{{email}}': contact.email }
    : {};
  return text.split(/(\{\{[^}]+\}\})/g).map((part, i) => {
    if (!part) return null;
    if (fill[part]) return <mark key={i} className="ema-fill">{fill[part]}</mark>;
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return <mark key={i} className="ema-fill ema-fill--miss">{part}</mark>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function EmailComposePage() {
  const { status, sends, templates: apiTemplates, contacts: apiContacts, loading, error: loadError, mockPreview, refresh } = useGmailWorkspace();
  const mailboxConnected = status?.status === 'connected';
  const mailboxEmail = status?.email || '';
  const templates = apiTemplates;
  const contacts = useMemo<EmailContact[]>(
    () => apiContacts
      .filter((contact): contact is GmailContact & { email: string } => Boolean(contact.email?.trim()))
      .map((contact) => {
        const email = contact.email.trim();
        return {
          ...contact,
          name: contact.name?.trim() || email,
          email,
          avatar: avatarFor(email),
        };
      }),
    [apiContacts],
  );
  const recentSends = useMemo<DisplaySend[]>(
    () => sends.map((send) => ({
      ...send,
      name: send.recipientName || send.recipientEmail,
      email: send.recipientEmail,
      body: send.textBody,
      sentAt: formatDate(send.createdAt),
      avatar: avatarFor(send.recipientEmail),
      failReason: send.statusReason || undefined,
    })),
    [sends],
  );
  const [recipients, setRecipients] = useState<EmailContact[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'sent' | 'compose'>('compose');
  const [composeTab, setComposeTab] = useState<'write' | 'preview'>('write');
  const [selectedId, setSelectedId] = useState('');
  const [sentQuery, setSentQuery] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [sendError, setSendError] = useState('');
  const [consentContactId, setConsentContactId] = useState<string | null>(null);
  const [consentError, setConsentError] = useState('');
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const selected = recentSends.find((s) => s.id === selectedId) ?? recentSends[0] ?? null;
  const visibleSends = filterRecentSends(recentSends, sentQuery, 'ALL');
  const template: EmailTemplate | null = templates.find((t) => t.id === templateId) ?? null;
  const priorSends = recipients.flatMap((contact) =>
    priorSendsFor(recentSends, contact.email).map((send) => ({ ...send, who: contact.name }))
  );

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  const previewContact = recipients[0] ?? null;
  const missing = [
    recipients.length === 0 ? 'a contact' : '',
    !subject.trim() ? 'a subject' : '',
    !message.trim() ? 'a message' : '',
  ].filter(Boolean);
  const eligible = missing.length === 0 && mailboxConnected && attachments.every((item) => item.status === 'ready');

  const addFiles = async (files: File[]) => {
    const existingBytes = attachments.reduce((total, item) => total + item.file.size, 0);
    if (attachments.length + files.length > GMAIL_MAX_ATTACHMENTS) {
      setSendError(`You can attach up to ${GMAIL_MAX_ATTACHMENTS} files.`);
      return;
    }
    if (existingBytes + files.reduce((total, file) => total + file.size, 0) > GMAIL_MAX_DECODED_MIME_BYTES) {
      setSendError('Attachments exceed the 20 MB total decoded budget. Remove a file before adding another.');
      return;
    }
    setSendError('');
    for (const file of files) {
      const localId = `${file.name}-${file.lastModified}-${Math.random()}`;
      const controller = new AbortController();
      const item: AttachmentItem = { localId, file, progress: 0, status: 'uploading', controller };
      setAttachments((current) => [...current, item]);
      if (!GMAIL_ALLOWED_ATTACHMENT_MIMES.has(file.type.toLowerCase())) {
        setAttachments((current) => current.map((entry) => entry.localId === localId
          ? { ...entry, status: 'error', error: 'This file type is not supported.' }
          : entry));
        continue;
      }
      if (!file.size || file.size > GMAIL_MAX_ATTACHMENT_BYTES) {
        setAttachments((current) => current.map((entry) => entry.localId === localId
          ? { ...entry, status: 'error', error: 'Each file must be 15 MB or smaller.' }
          : entry));
        continue;
      }
      try {
        const response = await gmailApi.uploadAttachment(file, {
          signal: controller.signal,
          onUploadProgress: (progress) => {
            const total = progress.total || file.size;
            setAttachments((current) => current.map((entry) => entry.localId === localId
              ? { ...entry, progress: Math.min(100, Math.round((progress.loaded / total) * 100)) }
              : entry));
          },
        });
        setAttachments((current) => current.map((entry) => entry.localId === localId
          ? { ...entry, status: 'ready', progress: 100, uploaded: response.data.data }
          : entry));
      } catch (cause) {
        if ((cause as { code?: string })?.code === 'ERR_CANCELED') continue;
        setAttachments((current) => current.map((entry) => entry.localId === localId
          ? { ...entry, status: 'error', error: getErrorMessage(cause, 'Attachment upload failed.') }
          : entry));
      }
    }
  };

  const removeAttachment = (localId: string) => {
    setAttachments((current) => {
      const item = current.find((entry) => entry.localId === localId);
      item?.controller.abort();
      return current.filter((entry) => entry.localId !== localId);
    });
  };

  const wrapSelection = (prefix: string, suffix = prefix) => {
    const input = messageRef.current;
    const start = input?.selectionStart ?? message.length;
    const end = input?.selectionEnd ?? message.length;
    const selectedText = message.slice(start, end) || 'text';
    const next = `${message.slice(0, start)}${prefix}${selectedText}${suffix}${message.slice(end)}`.slice(0, MESSAGE_MAX);
    setMessage(next);
    requestAnimationFrame(() => {
      input?.focus();
      const caret = Math.min(start + prefix.length + selectedText.length + suffix.length, next.length);
      input?.setSelectionRange(caret, caret);
    });
  };

  const addLink = () => {
    const url = window.prompt('Paste a safe https:// link');
    if (!url || !/^https:\/\//i.test(url.trim())) {
      if (url) setSendError('Links must use https://.');
      return;
    }
    const input = messageRef.current;
    const start = input?.selectionStart ?? message.length;
    const end = input?.selectionEnd ?? message.length;
    const label = message.slice(start, end) || url.trim();
    const next = `${message.slice(0, start)}[${label}](${url.trim()})${message.slice(end)}`.slice(0, MESSAGE_MAX);
    setMessage(next);
  };

  const sendEmail = async () => {
    if (!eligible || !recipients[0]) return;
    if (mockPreview) {
      setSendError(GMAIL_MOCK_PREVIEW_BLOCK);
      return;
    }
    setSendError('');
    setSendStatus('Sending…');
    try {
      const response = await gmailApi.send({
        contactIds: [recipients[0].id] as [string],
        subject: subject.trim(),
        textBody: plainTextFromMarkup(message).trim(),
        htmlBody: safeHtmlFromMarkup(message),
        attachmentIds: attachments.flatMap((item) => item.uploaded?.id || []),
      }, crypto.randomUUID());
      const result = response.data.data[0];
      setSendStatus(result ? statusLabel(result.status) : 'Queued');
      setSelectedId(result?.id || '');
      setPanel('sent');
      refresh();
    } catch (cause) {
      setSendStatus('');
      setSendError(getErrorMessage(cause, 'Email could not be queued.'));
    }
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setMessage(t.textBody);
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    setQuery('');
    setConsentError('');
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const pickContact = (c: EmailContact) => {
    if (!c.eligible) return;
    setRecipients([c]);
    setPickerOpen(false);
    setQuery('');
  };

  const enableEmailPermission = async (contact: EmailContact) => {
    if (contact.eligible || consentContactId) return;
    setConsentContactId(contact.id);
    setConsentError('');
    try {
      await gmailApi.setConsent(contact.id, {
        optedIn: true,
        source: GMAIL_EMAIL_CONSENT_SOURCE,
        version: GMAIL_EMAIL_CONSENT_VERSION,
      });
      refresh();
    } catch (cause) {
      setConsentError(getErrorMessage(cause, 'Could not enable email permission.'));
    } finally {
      setConsentContactId(null);
    }
  };

  const removeRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const openCompose = () => {
    setPickerOpen(false);
    setComposeTab('write');
    setPanel('compose');
  };

  const openSent = (id: string) => {
    setPickerOpen(false);
    setSelectedId(id);
    setPanel('sent');
  };

  if (loading) {
    return (
      <PageShell list>
        <EmailLoadingSkeleton variant="compose" />
      </PageShell>
    );
  }

  if (!mailboxConnected) {
    return (
      <PageShell>
        <div className="ema-page ema-shell">
          {loadError ? <div className="ema-notice ema-notice--fail" role="alert">{loadError}</div> : null}
          <EmailConnectScreen connectionStatus={status?.status} />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell list>
      <div className="ema-page ema-shell ema-shell--compose">
        {mockPreview ? <MetaMockNotice /> : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-[var(--ema-ink)]">
              Email
            </h1>
            <p className="mt-0.5 text-[12px] font-semibold text-[var(--ema-muted)]">
              Sent mail on the left. Open one to read it, or start a new email.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="ema-btn ema-btn--primary"
              onClick={openCompose}
              aria-pressed={panel === 'compose'}
            >
              <PenLine className="h-4 w-4" strokeWidth={2.2} />
              Compose email
            </button>
            <span className="ema-chip ema-chip--connected">Connected</span>
          </div>
        </div>
        {loadError ? (
          <div className="ema-notice ema-notice--fail mt-3" role="alert">
            <Info className="h-[15px] w-[15px] shrink-0" />
            <span>{loadError}</span>
          </div>
        ) : null}

        <div className="ema-split ema-split--viewport">
          <section className="ema-card ema-sent" aria-label="Recently sent">
            <div className="ema-card__head" style={{ paddingBottom: 10 }}>
              <div>
                <div className="ema-card__title">
                  <History className="h-[15px] w-[15px] text-[var(--ema-blue)]" />
                  Recently sent
                </div>
                <p className="ema-card__sub">{visibleSends.length} of {recentSends.length} saved</p>
              </div>
            </div>
            <div className="ema-sent__filters">
              <input
                className="ema-input ema-input--compact"
                placeholder="Search name, email, or subject"
                value={sentQuery}
                onChange={(e) => setSentQuery(e.target.value)}
                aria-label="Search sent emails"
              />
            </div>
            <div className="ema-sent__list" role="listbox" aria-label="Sent emails">
              {recentSends.length === 0 && (
                <p className="px-2 py-6 text-center text-[12px] font-semibold text-[var(--ema-muted)]">
                  No sent emails saved.
                </p>
              )}
              {recentSends.length > 0 && visibleSends.length === 0 && (
                <p className="px-2 py-6 text-center text-[12px] font-semibold text-[var(--ema-muted)]">
                  No emails match your search.
                </p>
              )}
              {visibleSends.map((send) => {
                const on = panel === 'sent' && send.id === selected?.id;
                return (
                  <button
                    key={send.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`ema-sent__item ${on ? 'ema-sent__item--on' : ''}`}
                    onClick={() => openSent(send.id)}
                  >
                    <span className={`ema-avatar ema-avatar--${send.avatar}`}>
                      {initials(send.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="ema-sent__top">
                        <span className="ema-sent__name">{send.name}</span>
                        <span className={`ema-chip ${
                          send.status === 'accepted'
                            ? 'ema-chip--accepted'
                            : send.status === 'failed'
                              ? 'ema-chip--failed'
                              : send.status === 'reconnect-required'
                                ? 'ema-chip--reconnect'
                                : 'ema-chip--blue'
                        }`}>{statusLabel(send.status)}</span>
                      </span>
                      <span className="ema-sent__subject">{send.subject}</span>
                      <span className="ema-sent__meta">
                        <span className="ema-sent__email">{send.email}</span>
                        <span className="ema-sent__time">{send.sentAt}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ema-card ema-pane" aria-live="polite">
            {panel === 'compose' ? (
              <div className="ema-pane__pad ema-form">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="ema-card__title">New email</div>
                    <p className="ema-card__sub">Send from your connected Gmail. Not an inbox.</p>
                  </div>
                </div>
                <div className="ema-ttabs" role="tablist" aria-label="Compose">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={composeTab === 'write'}
                    className={`ema-ttab ${composeTab === 'write' ? 'ema-ttab--on' : ''}`}
                    onClick={() => setComposeTab('write')}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={composeTab === 'preview'}
                    className={`ema-ttab ${composeTab === 'preview' ? 'ema-ttab--on' : ''}`}
                    onClick={() => setComposeTab('preview')}
                  >
                    Preview
                  </button>
                </div>

                {composeTab === 'preview' ? (
                  <div>
                    <div className="ema-mail" style={{ margin: 0 }}>
                      <div className="ema-mail__who">
                        <span className={`ema-avatar ${previewContact ? `ema-avatar--${previewContact.avatar}` : 'ema-avatar--pink'}`} style={{ width: 36, height: 36, fontSize: 12 }}>
                          {previewContact ? initials(previewContact.name) : '?'}
                        </span>
                        <span className="min-w-0">
                          <span className="ema-mail__from">From {mailboxEmail}</span>
                          <span className="ema-mail__to">
                            {previewContact
                              ? `To ${previewContact.name} · ${previewContact.email}`
                              : 'Add a contact to see who this goes to'}
                          </span>
                        </span>
                      </div>
                      <h2 className="ema-mail__subject">
                        {previewNodes(subject, previewContact, 'Subject appears here')}
                      </h2>
                      <div className="ema-mail__body">
                        {previewNodes(message, previewContact, 'Write the message, then check it here before you send.')}
                      </div>
                    </div>
                    <div className="ema-mail__legend" style={{ padding: '10px 2px 0' }}>
                      {previewContact && (
                        <span><mark className="ema-fill">{previewContact.name}</mark> is filled from this contact</span>
                      )}
                      {recipients.length > 1 && (
                        <span>Each person gets their own email. This preview is only for {previewContact?.name}.</span>
                      )}
                      <span>Opens, replies, and delivery are not shown. A successful send is Accepted by Gmail.</span>
                    </div>
                  </div>
                ) : (
                <>

                <div className="ema-field">
                  <span className="ema-field__label">From</span>
                  <div className="ema-from">
                    <span className="ema-from__glyph">
                      <GmailGlyph className="h-[17px] w-[17px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="ema-from__addr block">{mailboxEmail}</span>
                      <span className="ema-from__via">
                        <Check className="h-[10px] w-[10px]" strokeWidth={3} />
                        Connected via Google (send-only)
                      </span>
                    </span>
                  </div>
                </div>

                <div className="ema-field">
                  <span className="ema-field__label">
                    To
                    {recipients.length === 0 && <span className="ema-req">*</span>}
                    {recipients.length > 0 && (
                      <span className="ema-field__counter">
                        {recipients.length} contact{recipients.length > 1 ? 's' : ''} selected
                      </span>
                    )}
                    {recipients.length > 0 && (
                      <button type="button" className="ema-card__link" onClick={() => setRecipients([])}>
                        Clear all
                      </button>
                    )}
                  </span>

                  {recipients.length > 0 && (
                    <div className="ema-tochips">
                      {recipients.map((r) => (
                        <span key={r.id} className="ema-tochip">
                          <span className={`ema-avatar ema-avatar--${r.avatar}`} style={{ width: 20, height: 20, fontSize: 8.5 }}>
                            {initials(r.name)}
                          </span>
                          <span className="ema-tochip__name">{r.name}</span>
                          <button
                            type="button"
                            className="ema-recipient__x"
                            style={{ width: 18, height: 18 }}
                            aria-label={`Remove ${r.name}`}
                            onClick={() => removeRecipient(r.id)}
                          >
                            <X className="h-2.5 w-2.5" strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="ema-picker" ref={pickerRef}>
                    <button
                      type="button"
                      className="ema-picker__toggle"
                      onClick={openPicker}
                      aria-expanded={pickerOpen}
                      aria-haspopup="listbox"
                    >
                      <Search className="h-4 w-4 text-[var(--ema-muted)]" strokeWidth={2.2} />
                      Add from Contacts
                      <ChevronDown className="ml-auto h-4 w-4 text-[var(--ema-muted)]" strokeWidth={2.2} />
                    </button>

                    {pickerOpen && (
                      <div className="ema-picker__menu">
                        <input
                          ref={searchRef}
                          className="ema-picker__search"
                          placeholder="Search contacts by name or email..."
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        {consentError ? (
                          <div className="ema-notice ema-notice--fail" role="alert" style={{ margin: '8px 8px 0' }}>
                            <Info className="h-[15px] w-[15px] shrink-0" />
                            <span>{consentError}</span>
                          </div>
                        ) : null}
                        <div className="ema-picker__list">
                          {filteredContacts.length === 0 && (
                            <p className="px-3 py-4 text-center text-[11.5px] font-semibold text-[var(--ema-muted)]">
                              No contacts with an email found
                            </p>
                          )}
                          {filteredContacts.map((c) => {
                            const picked = recipients.some((r) => r.id === c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`ema-picker__item ${picked ? 'ema-picker__item--on' : ''} ${!c.eligible ? 'ema-picker__item--disabled' : ''}`}
                                aria-pressed={picked}
                                aria-disabled={!c.eligible}
                                disabled={consentContactId !== null}
                                onClick={() => c.eligible ? pickContact(c) : void enableEmailPermission(c)}
                              >
                                <span className={`ema-avatar ema-avatar--${c.avatar}`}>
                                  {initials(c.name)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[12px] font-bold text-[var(--ema-ink)]">{c.name}</span>
                                  <span className="block text-[11px] font-semibold text-[var(--ema-muted)]">{c.email}</span>
                                </span>
                                {picked && (
                                  <Check className="h-4 w-4 shrink-0 text-[var(--ema-primary)]" strokeWidth={2.6} />
                                )}
                                {!c.eligible && (
                                  <span className="shrink-0 text-[10.5px] font-extrabold text-[var(--ema-primary)]">
                                    {consentContactId === c.id ? 'Enabling…' : 'Enable email permission'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-[var(--ema-line)] px-3 py-2">
                          <p className="text-[10.5px] font-semibold text-[var(--ema-muted)]">
                            Contacts with an email are shown. Permission is required before sending.
                          </p>
                          <button
                            type="button"
                            className="ema-btn ema-btn--primary"
                            style={{ height: 28, padding: '0 12px', fontSize: 11 }}
                            onClick={() => setPickerOpen(false)}
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {priorSends.length > 0 && (
                    <div className="ema-prior">
                      <span className="ema-field__label">Already sent to this contact</span>
                      {priorSends.map((send) => (
                        <button
                          key={send.id}
                          type="button"
                          className="ema-prior__item"
                          onClick={() => openSent(send.id)}
                        >
                          <span className="min-w-0">
                            <span className="ema-prior__subject">{send.subject}</span>
                            <span className="ema-prior__meta">{send.who} · {send.sentAt}</span>
                          </span>
                          <span className={`ema-chip ${send.status === 'accepted' ? 'ema-chip--accepted' : send.status === 'failed' ? 'ema-chip--failed' : 'ema-chip--blue'}`}>
                            {statusLabel(send.status)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ema-field">
                  <span className="ema-field__label">
                    Use a template (optional)
                    <Link to="/email/templates" className="ema-card__link">Manage templates</Link>
                  </span>
                  <select
                    className="ema-select"
                    value={templateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">Select a template to fill subject and message</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {template && (
                    <span className="ema-field__hint">
                      Applied “{template.name}” — fields are editable.
                    </span>
                  )}
                </div>

                <div className="ema-field">
                  <span className="ema-field__label">
                    Subject <span className="ema-req">*</span>
                    <span className="ema-field__counter">{subject.length}/{SUBJECT_MAX}</span>
                  </span>
                  <input
                    className="ema-input"
                    placeholder="Enter email subject"
                    maxLength={SUBJECT_MAX}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="ema-field">
                  <span className="ema-field__label">
                    Message (plain text) <span className="ema-req">*</span>
                    <span className="ema-field__counter">{message.length}/{MESSAGE_MAX}</span>
                  </span>
                  <textarea
                    ref={messageRef}
                    className="ema-textarea"
                    placeholder="Write your message here..."
                    maxLength={MESSAGE_MAX}
                    rows={8}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="ema-formatbar" aria-label="Safe message formatting">
                    <button type="button" className="ema-formatbar__button" onClick={() => wrapSelection('**')} title="Bold">
                      <Bold className="h-3.5 w-3.5" /><span className="sr-only">Bold</span>
                    </button>
                    <button type="button" className="ema-formatbar__button" onClick={() => wrapSelection('*')} title="Italic">
                      <Italic className="h-3.5 w-3.5" /><span className="sr-only">Italic</span>
                    </button>
                    <button type="button" className="ema-formatbar__button" onClick={addLink} title="Add https link">
                      <LinkIcon className="h-3.5 w-3.5" /><span className="sr-only">Link</span>
                    </button>
                    <span className="ema-field__hint">Safe formatting is sent as HTML plus plain text.</span>
                  </div>
                </div>

                <div className="ema-field">
                  <span className="ema-field__label">
                    Attachments <span className="ema-field__counter">{attachments.length}/{GMAIL_MAX_ATTACHMENTS}</span>
                  </span>
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    multiple
                    onChange={(event) => {
                      void addFiles(Array.from(event.target.files || []));
                      event.currentTarget.value = '';
                    }}
                  />
                  <button
                    type="button"
                    className="ema-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void addFiles(Array.from(event.dataTransfer.files));
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    <span>Drop files here or choose files</span>
                    <small>Up to 5 files · 15 MB each · 20 MB total</small>
                  </button>
                  {attachments.length > 0 ? (
                    <div className="ema-attachments">
                      {attachments.map((item) => (
                        <div key={item.localId} className="ema-attachment">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--ema-muted)]" />
                          <span className="min-w-0 flex-1">
                            <span className="ema-attachment__name">{item.file.name}</span>
                            {item.status === 'uploading' ? <span className="ema-attachment__meta">Uploading… {item.progress}%</span> : null}
                            {item.status === 'ready' ? <span className="ema-attachment__meta">Ready to send</span> : null}
                            {item.error ? <span className="ema-attachment__error">{item.error}</span> : null}
                          </span>
                          {item.status === 'uploading' ? <progress max="100" value={item.progress} aria-label={`Uploading ${item.file.name}`} /> : null}
                          <button type="button" className="ema-recipient__x" aria-label={`Remove ${item.file.name}`} onClick={() => removeAttachment(item.localId)}>
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <span className="ema-field__hint">Allowed: PDF, images, text/CSV, ZIP, and Office files. Files are private and temporary.</span>
                </div>

                {sendError ? <div className="ema-notice ema-notice--fail" role="alert"><Info className="h-[15px] w-[15px] shrink-0" /> <span>{sendError}</span></div> : null}
                {sendStatus ? <div className="ema-notice ema-notice--ok" role="status"><Check className="h-[15px] w-[15px] shrink-0" /> <span>{sendStatus}. Gmail acceptance is not delivery or read confirmation.</span></div> : null}
                <div className="ema-notice ema-notice--info" role="note">
                  <Info className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
                  <span>{LIMITS_COPY}</span>
                </div>
                </>
                )}

                <div className="ema-foot">
                  {missing.length > 0 && (
                    <span className="ema-field__hint" style={{ marginRight: 'auto' }}>
                      Add {missing.join(', ')} to send.
                    </span>
                  )}
                  <button type="button" className="ema-btn ema-btn--ghost" onClick={() => setPanel('sent')}>
                    Cancel
                  </button>
                  <button type="button" className="ema-btn ema-btn--primary" disabled={!eligible} onClick={() => void sendEmail()}>
                    <SendHorizontal className="h-4 w-4" strokeWidth={2.2} />
                    Send Email
                  </button>
                </div>
              </div>
            ) : selected ? (
              <div className="ema-read">
                <div className="ema-read__head">
                  <div className="min-w-0">
                    <div className="ema-card__title">Sent email</div>
                    <p className="ema-card__sub">{selected.sentAt}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`ema-chip ${
                      selected.status === 'accepted'
                        ? 'ema-chip--accepted'
                        : selected.status === 'failed'
                          ? 'ema-chip--failed'
                          : selected.status === 'reconnect-required'
                            ? 'ema-chip--reconnect'
                            : 'ema-chip--blue'
                    }`}>{statusLabel(selected.status)}</span>
                  </div>
                </div>
                {selected.status === 'accepted' ? (
                  <div className="ema-notice ema-notice--ok" role="status" style={{ margin: '0 16px' }}>
                    <Check className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
                    <span>Gmail accepted this email. Delivery, opens, and replies are not shown.</span>
                  </div>
                ) : (
                  <div className="ema-notice ema-notice--fail" role="status" style={{ margin: '0 16px' }}>
                    <Info className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
                    <span>{selected.failReason || `Gmail status: ${statusLabel(selected.status)}.`}</span>
                  </div>
                )}
                <div className="ema-mail">
                  <div className="ema-mail__who">
                    <span className={`ema-avatar ema-avatar--${selected.avatar}`} style={{ width: 36, height: 36, fontSize: 12 }}>
                      {initials(selected.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="ema-mail__from">From {mailboxEmail}</span>
                      <span className="ema-mail__to">To {selected.name} · {selected.email}</span>
                    </span>
                  </div>
                  <h2 className="ema-mail__subject">{selected.subject}</h2>
                  <div className="ema-mail__body">{selected.body}</div>
                </div>
              </div>
            ) : (
              <div className="ema-zero" style={{ padding: '72px 24px' }}>
                <p className="ema-zero__title">No email selected</p>
                <p className="ema-zero__desc">Pick a sent email on the left, or start a new one.</p>
                <div className="mt-4">
                  <button type="button" className="ema-btn ema-btn--primary" onClick={openCompose}>
                    <PenLine className="h-4 w-4" strokeWidth={2.2} />
                    Compose email
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
}
