import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Sparkles,
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
import { useAuth } from '../../contexts/AuthContext';
import { gmailApi, type GmailAttachment, type GmailContact, type GmailSend, type GmailTemplate } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { fetchStudioMediaBlob, studioPublicUrlFromStoragePath } from '../../utils/studioHandoffMedia';
import {
  applyMergeFields,
  buildAutoFill,
  combinedFills,
  EMAIL_COMPOSE_VARIABLES,
  EMAIL_CONTACT_VARIABLES,
  extractMergeKeys,
  findUnresolvedMergeKeys,
  keysNeedingUserInput,
  mergePreviewValue,
} from '../../utils/emailMergeFields';
import { dedupeLatestSendPerEmail, filterRecentSends } from './emailList';
import '../email/email.css';

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 2000;

const LIMITS_COPY =
  'Google limits this mailbox — about 500 emails/day on free Gmail, about 2,000/day on paid Workspace. If sending stops, wait up to 24 hours.';

function formatSentListWhen(iso: string): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return '';
  const mins = Math.floor(Math.max(0, Date.now() - at) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type PickerAudience = 'all' | 'ready' | 'whatsapp-opted-in' | 'tagged' | 'inbound';

const PICKER_FILTERS: { id: PickerAudience; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ready', label: 'Ready to send' },
  { id: 'whatsapp-opted-in', label: 'WhatsApp opted in' },
  { id: 'tagged', label: 'By tag' },
  { id: 'inbound', label: 'From chat' },
];

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

function previewNodes(text: string, fills: Record<string, string>, empty: string): ReactNode {
  if (!text.trim()) return <span className="ema-mail__empty">{empty}</span>;
  return text.split(/(\{\{[^}]+\}\})/g).map((part, i) => {
    if (!part) return null;
    const filled = mergePreviewValue(part, fills);
    if (filled) return <mark key={i} className="ema-fill">{filled}</mark>;
    if (part.startsWith('{{') && part.endsWith('}}')) {
      return <mark key={i} className="ema-fill ema-fill--miss">{part}</mark>;
    }
    return <span key={i}>{part}</span>;
  });
}

function mergeFieldLabel(key: string): string {
  return key.replace(/_/g, ' ');
}

export default function EmailComposePage() {
  const { organization } = useAuth();
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
  const [pickerAudience, setPickerAudience] = useState<PickerAudience>('all');
  const [pickerTags, setPickerTags] = useState<string[]>([]);
  const [panel, setPanel] = useState<'sent' | 'compose'>('compose');
  const [composeTab, setComposeTab] = useState<'write' | 'preview'>('write');
  const [selectedId, setSelectedId] = useState('');
  const [sentQuery, setSentQuery] = useState('');
  const [sendStatus, setSendStatus] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [consentContactId, setConsentContactId] = useState<string | null>(null);
  const [consentError, setConsentError] = useState('');
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const activeComposeField = useRef<'subject' | 'body'>('body');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [mergeFields, setMergeFields] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [sentListExpanded, setSentListExpanded] = useState(false);
  const selected = recentSends.find((s) => s.id === selectedId) ?? recentSends[0] ?? null;
  const filteredSends = useMemo(
    () => filterRecentSends(recentSends, sentQuery, 'ALL'),
    [recentSends, sentQuery],
  );
  const dedupedSends = useMemo(() => dedupeLatestSendPerEmail(filteredSends), [filteredSends]);
  const visibleSends = sentListExpanded ? filteredSends : dedupedSends;
  const hiddenSendCount = sentListExpanded ? 0 : Math.max(0, filteredSends.length - dedupedSends.length);
  const selectedRecipientEmails = useMemo(
    () => new Set(recipients.map((r) => r.email.trim().toLowerCase())),
    [recipients],
  );
  const template: EmailTemplate | null = templates.find((t) => t.id === templateId) ?? null;
  const emailedBefore = useMemo(() => {
    const set = new Set<string>();
    for (const send of recentSends) {
      const email = send.email.trim().toLowerCase();
      if (email) set.add(email);
    }
    return set;
  }, [recentSends]);

  const contactTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contact of contacts) {
      for (const tag of contact.tags ?? []) {
        const key = tag.trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    let list = contacts;
    if (pickerAudience === 'ready') list = list.filter((c) => c.eligible);
    else if (pickerAudience === 'whatsapp-opted-in') list = list.filter((c) => c.optedIn);
    else if (pickerAudience === 'tagged') {
      list = list.filter((c) => (c.tags?.length ?? 0) > 0);
      if (pickerTags.length > 0) {
        list = list.filter((c) => pickerTags.some((tag) => (c.tags ?? []).includes(tag)));
      }
    } else if (pickerAudience === 'inbound') list = list.filter((c) => c.source === 'INBOUND');
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.tags ?? []).some((tag) => tag.toLowerCase().includes(q)),
    );
  }, [contacts, pickerAudience, pickerTags, query]);

  const visibleReadyCount = useMemo(
    () => filteredContacts.filter((c) => c.eligible).length,
    [filteredContacts],
  );

  const previewContact = recipients[0] ?? null;
  const templateKeys = useMemo(() => extractMergeKeys(subject, message), [subject, message]);
  const autoFill = useMemo(
    () => buildAutoFill(previewContact, organization?.companyName),
    [previewContact, organization?.companyName],
  );
  const previewFills = useMemo(() => combinedFills(autoFill, mergeFields), [autoFill, mergeFields]);
  const pendingMergeKeys = useMemo(
    () => keysNeedingUserInput(templateKeys, autoFill, mergeFields),
    [templateKeys, autoFill, mergeFields],
  );
  const unresolvedMergeKeys = useMemo(() => {
    const mergedSubject = applyMergeFields(subject, previewFills);
    const mergedMessage = applyMergeFields(message, previewFills);
    return findUnresolvedMergeKeys(mergedSubject, mergedMessage);
  }, [subject, message, previewFills]);
  const missing = [
    recipients.length === 0 ? 'a contact' : '',
    !subject.trim() ? 'a subject' : '',
    !message.trim() ? 'a message' : '',
    pendingMergeKeys.length > 0 ? `values for ${pendingMergeKeys.map((k) => `{{${k}}}`).join(', ')}` : '',
  ].filter(Boolean);
  const eligible =
    missing.length === 0 &&
    unresolvedMergeKeys.length === 0 &&
    mailboxConnected &&
    attachments.every((item) => item.status === 'ready');

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

  /* ---------------- AI Studio hand-off ----------------
     Studio navigates here with subject + body and the generated poster PNG,
     which is attached as a real file (uploads through the normal pipeline). */
  const [studioHandoffName, setStudioHandoffName] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const handoffConsumedRef = useRef(false);
  useEffect(() => {
    if (handoffConsumedRef.current) return;
    const state = (location.state || {}) as {
      studioHandoff?: boolean;
      studioName?: string;
      subject?: string;
      body?: string;
      attachmentFile?: File;
      mediaUrl?: string;
    };
    if (!state.studioHandoff) return;
    handoffConsumedRef.current = true;
    setPanel('compose');
    setComposeTab('write');
    if (state.subject) setSubject(state.subject);
    if (state.body) setMessage(state.body);
    const posterName = `${(state.studioName || 'ai-studio').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-poster.png`;
    if (state.attachmentFile instanceof File) {
      void addFiles([state.attachmentFile]);
    } else if (state.mediaUrl) {
      const posterUrl = state.mediaUrl.includes('..')
        ? ''
        : state.mediaUrl.startsWith('http') || state.mediaUrl.startsWith('/') || state.mediaUrl.startsWith('blob:')
          ? state.mediaUrl
          : studioPublicUrlFromStoragePath(state.mediaUrl);
      if (posterUrl) {
        void fetchStudioMediaBlob(posterUrl)
          .then((blob) =>
            addFiles([new File([blob], posterName, { type: blob.type || 'image/png' })]),
          )
          .catch(() => {
            setSendError('AI Studio poster could not be attached. Add an image manually.');
          });
      }
    }
    setStudioHandoffName(state.studioName || 'AI Studio');
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeAttachment = (localId: string) => {
    setAttachments((current) => {
      const item = current.find((entry) => entry.localId === localId);
      item?.controller.abort();
      return current.filter((entry) => entry.localId !== localId);
    });
  };

  const insertComposeVariable = (token: string) => {
    if (activeComposeField.current === 'subject') {
      const input = subjectInputRef.current;
      const start = input?.selectionStart ?? subject.length;
      const end = input?.selectionEnd ?? subject.length;
      const next = `${subject.slice(0, start)}${token}${subject.slice(end)}`.slice(0, SUBJECT_MAX);
      setSubject(next);
      requestAnimationFrame(() => {
        input?.focus();
        const caret = Math.min(start + token.length, next.length);
        input?.setSelectionRange(caret, caret);
      });
      return;
    }
    const input = messageRef.current;
    const start = input?.selectionStart ?? message.length;
    const end = input?.selectionEnd ?? message.length;
    const next = `${message.slice(0, start)}${token}${message.slice(end)}`.slice(0, MESSAGE_MAX);
    setMessage(next);
    requestAnimationFrame(() => {
      input?.focus();
      const caret = Math.min(start + token.length, next.length);
      input?.setSelectionRange(caret, caret);
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
    if (pendingMergeKeys.length > 0 || unresolvedMergeKeys.length > 0) {
      setComposeTab('preview');
      setSendError('Fill in every template field highlighted in orange before sending.');
      return;
    }
    if (!eligible || recipients.length === 0 || sendingRef.current) return;
    if (mockPreview) {
      setSendError(GMAIL_MOCK_PREVIEW_BLOCK);
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    setSendStatus('Sending…');
    try {
      const outboundMergeFields = Object.fromEntries(
        Object.entries(mergeFields).filter(([, value]) => value.trim()),
      );
      const response = await gmailApi.send({
        contactIds: recipients.map((r) => r.id),
        subject: subject.trim(),
        textBody: plainTextFromMarkup(message).trim(),
        htmlBody: safeHtmlFromMarkup(message),
        attachmentIds: attachments.flatMap((item) => item.uploaded?.id || []),
        ...(Object.keys(outboundMergeFields).length ? { mergeFields: outboundMergeFields } : {}),
      }, idempotencyKeyRef.current);
      const result = response.data.data[0];
      setSendStatus(result ? statusLabel(result.status) : 'Queued');
      setSelectedId(result?.id || '');
      setPanel('sent');
      idempotencyKeyRef.current = crypto.randomUUID();
      refresh();
    } catch (cause) {
      setSendStatus('');
      setSendError(getErrorMessage(cause, 'Email could not be queued. Try again.'));
      idempotencyKeyRef.current = crypto.randomUUID();
      refresh();
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    setMergeFields({});
    const t = templates.find((x) => x.id === id);
    if (t) {
      setSubject(t.subject);
      setMessage(t.textBody);
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    setQuery('');
    setPickerAudience('all');
    setPickerTags([]);
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

  const toggleContactPick = (c: EmailContact) => {
    if (!c.eligible) return;
    setRecipients((prev) => {
      const picked = prev.some((r) => r.id === c.id);
      if (picked) return prev.filter((r) => r.id !== c.id);
      return [...prev, c];
    });
  };

  const addAllVisibleReady = () => {
    setRecipients((prev) => {
      const ids = new Set(prev.map((r) => r.id));
      const toAdd = filteredContacts.filter((c) => c.eligible && !ids.has(c.id));
      return [...prev, ...toAdd];
    });
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
      <PageShell className="h-full min-h-0 overflow-y-auto">
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
        {studioHandoffName && (
          <p className="mb-2 flex items-center gap-2 rounded-xl border border-[#e6defb] bg-[#f4efff] px-3 py-2 text-[12px] font-medium text-[#4c3a86]">
            <Sparkles size={14} className="flex-none text-[#6d3df2]" />
            Loaded from AI Studio — “{studioHandoffName}”. Subject, body and the generated poster (attachment) are pre-filled. Choose recipients and send when ready.
          </p>
        )}
        <div className="ema-compose-head flex flex-wrap items-center justify-between gap-2">
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
                <p className="ema-card__sub">
                  {sentListExpanded
                    ? `${visibleSends.length} sends`
                    : `${visibleSends.length} people · ${recentSends.length} sends total`}
                </p>
              </div>
            </div>
            <div className="ema-sent__filters">
              <input
                className="ema-input ema-input--compact"
                placeholder="Search sent mail"
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
                const matchRecipient = selectedRecipientEmails.has(send.email.trim().toLowerCase());
                const statusClass =
                  send.status === 'accepted'
                    ? 'ema-sent__dot--ok'
                    : send.status === 'failed'
                      ? 'ema-sent__dot--fail'
                      : send.status === 'reconnect-required'
                        ? 'ema-sent__dot--warn'
                        : 'ema-sent__dot--pending';
                return (
                  <button
                    key={send.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    aria-label={`${send.name}, ${send.subject}, ${statusLabel(send.status)}`}
                    className={`ema-sent__item ema-sent__item--compact ${on ? 'ema-sent__item--on' : ''} ${matchRecipient ? 'ema-sent__item--match' : ''}`}
                    onClick={() => openSent(send.id)}
                  >
                    <span className={`ema-sent__dot ${statusClass}`} title={statusLabel(send.status)} />
                    <span className="min-w-0 flex-1">
                      <span className="ema-sent__row">
                        <span className="ema-sent__name">{send.name}</span>
                        <span className="ema-sent__time">{formatSentListWhen(send.createdAt)}</span>
                      </span>
                      <span className="ema-sent__subject">{send.subject}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {hiddenSendCount > 0 && !sentListExpanded ? (
              <button
                type="button"
                className="ema-sent__expand"
                onClick={() => setSentListExpanded(true)}
              >
                Show all {filteredSends.length} sends
              </button>
            ) : null}
            {sentListExpanded && filteredSends.length > dedupedSends.length ? (
              <button
                type="button"
                className="ema-sent__expand"
                onClick={() => setSentListExpanded(false)}
              >
                Group by person
              </button>
            ) : null}
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
                            {recipients.length === 0
                              ? 'Add contacts to see who this goes to'
                              : recipients.length === 1 && previewContact
                                ? `To ${previewContact.name} · ${previewContact.email}`
                                : `To ${recipients.length} contacts (preview shows ${previewContact?.name ?? 'first'})`}
                          </span>
                        </span>
                      </div>
                      <h2 className="ema-mail__subject">
                        {previewNodes(subject, previewFills, 'Subject appears here')}
                      </h2>
                      <div className="ema-mail__body">
                        {previewNodes(message, previewFills, 'Write the message, then check it here before you send.')}
                      </div>
                    </div>
                    {pendingMergeKeys.length > 0 && (
                      <div className="ema-field" style={{ marginTop: 14 }}>
                        <span className="ema-field__label">Values for this email</span>
                        <p className="ema-field__hint" style={{ marginBottom: 8 }}>
                          Orange tags need a value here or in your text. Name and email come from the contact; company uses your org name when set.
                        </p>
                        <div className="flex flex-col gap-2">
                          {pendingMergeKeys.map((key) => (
                            <label key={key} className="flex flex-col gap-1">
                              <span className="text-xs font-medium text-[var(--ema-muted)]">
                                <code>{`{{${key}}}`}</code>
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  className="ema-input flex-1"
                                  value={mergeFields[key] ?? ''}
                                  placeholder={`Enter ${mergeFieldLabel(key)}`}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setMergeFields((current) => ({ ...current, [key]: value }));
                                  }}
                                />
                                {key === 'date' ? (
                                  <button
                                    type="button"
                                    className="ema-btn ema-btn--ghost shrink-0"
                                    onClick={() => {
                                      setMergeFields((current) => ({
                                        ...current,
                                        date: new Date().toLocaleDateString('en-CA'),
                                      }));
                                    }}
                                  >
                                    Today
                                  </button>
                                ) : null}
                                {key === 'time' ? (
                                  <button
                                    type="button"
                                    className="ema-btn ema-btn--ghost shrink-0"
                                    onClick={() => {
                                      setMergeFields((current) => ({
                                        ...current,
                                        time: new Date().toLocaleTimeString(undefined, {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: false,
                                        }),
                                      }));
                                    }}
                                  >
                                    Now
                                  </button>
                                ) : null}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="ema-mail__legend" style={{ padding: '10px 2px 0' }}>
                      {previewContact && (
                        <span><mark className="ema-fill">{previewContact.name}</mark> is filled from this contact</span>
                      )}
                      {recipients.length > 1 && (
                        <span>Each person gets their own email. This preview is only for {previewContact?.name}.</span>
                      )}
                      <span>Opens, replies, and delivery are not shown. A successful send is Accepted by Gmail.</span>
                      <span>Each email includes a link the recipient can open to stop further email.</span>
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
                          placeholder="Search by name, email, or tag..."
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                        <div className="ema-picker__filters" role="tablist" aria-label="Contact filters">
                          {PICKER_FILTERS.map((filter) => (
                            <button
                              key={filter.id}
                              type="button"
                              role="tab"
                              aria-selected={pickerAudience === filter.id}
                              className={`ema-picker__chip ${pickerAudience === filter.id ? 'ema-picker__chip--on' : ''}`}
                              onClick={() => {
                                setPickerAudience(filter.id);
                                if (filter.id !== 'tagged') setPickerTags([]);
                              }}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                        {pickerAudience === 'tagged' ? (
                          <div className="ema-picker__tags" aria-label="Choose contact tags">
                            <span className="ema-picker__tags-label">Pick tag(s)</span>
                            {contactTags.length > 0 ? (
                              <div className="ema-picker__tags-scroll">
                                {contactTags.map(({ tag, count }) => {
                                  const on = pickerTags.includes(tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      className={`ema-picker__tag ${on ? 'ema-picker__tag--on' : ''}`}
                                      aria-pressed={on}
                                      onClick={() => {
                                        setPickerTags((current) =>
                                          current.includes(tag)
                                            ? current.filter((t) => t !== tag)
                                            : [...current, tag],
                                        );
                                      }}
                                    >
                                      {tag}
                                      <span className="ema-picker__tag-count">{count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-[11px] font-semibold text-[var(--ema-muted)]">
                                No tags on contacts yet. Add tags in Contacts first.
                              </p>
                            )}
                          </div>
                        ) : null}
                        <div className="ema-picker__toolbar">
                          <span className="ema-picker__toolbar-meta">
                            {filteredContacts.length} shown · {visibleReadyCount} ready
                          </span>
                          <button
                            type="button"
                            className="ema-picker__toolbar-btn"
                            disabled={visibleReadyCount === 0}
                            onClick={addAllVisibleReady}
                          >
                            Add all shown (ready)
                          </button>
                        </div>
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
                            const sentBefore = emailedBefore.has(c.email.trim().toLowerCase());
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`ema-picker__item ${picked ? 'ema-picker__item--on' : ''} ${!c.eligible ? 'ema-picker__item--disabled' : ''}`}
                                aria-pressed={picked}
                                aria-disabled={!c.eligible}
                                disabled={consentContactId !== null}
                                onClick={() => (c.eligible ? toggleContactPick(c) : void enableEmailPermission(c))}
                              >
                                <span className={`ema-avatar ema-avatar--${c.avatar}`}>
                                  {initials(c.name)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[12px] font-bold text-[var(--ema-ink)]">{c.name}</span>
                                  <span className="block text-[11px] font-semibold text-[var(--ema-muted)]">{c.email}</span>
                                </span>
                                {sentBefore ? (
                                  <span className="ema-picker__sent-mark" title="You emailed this contact before">
                                    Sent
                                  </span>
                                ) : null}
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
                            Select multiple contacts, then Done. “Sent” = emailed before (see list on the left).
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
                    ref={subjectInputRef}
                    className="ema-input"
                    placeholder="Enter email subject"
                    maxLength={SUBJECT_MAX}
                    value={subject}
                    onFocus={() => { activeComposeField.current = 'subject'; }}
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
                    onFocus={() => { activeComposeField.current = 'body'; }}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="ema-vars" style={{ marginTop: 8 }}>
                    {EMAIL_CONTACT_VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="ema-var"
                        onClick={() => insertComposeVariable(v)}
                      >
                        {v}
                      </button>
                    ))}
                    {EMAIL_COMPOSE_VARIABLES.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className="ema-var ema-var--compose"
                        onClick={() => insertComposeVariable(v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <span className="ema-field__hint">Click subject or message first, then insert. Orange tags are filled in Preview before send.</span>
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
                  <button type="button" className="ema-btn ema-btn--primary" disabled={!eligible || sending} onClick={() => void sendEmail()}>
                    <SendHorizontal className="h-4 w-4" strokeWidth={2.2} />
                    {sending ? 'Sending…' : 'Send Email'}
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
