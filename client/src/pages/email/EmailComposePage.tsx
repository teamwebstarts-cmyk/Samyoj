import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  X,
  Check,
  Info,
  ChevronDown,
  SendHorizontal,
  Link2,
  History,
  PenLine,
  Trash2,
} from 'lucide-react';
import PageShell from '../../components/ui/PageShell';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import GmailGlyph from '../../components/email/GmailGlyph';
import { MOCK_CONTACTS, MOCK_MAILBOX, deleteRecentSend, useEmailTemplates, useRecentSends } from './mockData';
import { filterRecentSends, priorSendsFor } from './emailList';
import type { EmailContact, EmailTemplate } from './mockData';
import '../email/email.css';

const SUBJECT_MAX = 200;
const MESSAGE_MAX = 2000;

const LIMITS_COPY =
  'Google limits this mailbox — about 500 emails/day on free Gmail, about 2,000/day on paid Workspace. If sending stops, wait up to 24 hours.';

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('');
}

function shortWhen(sentAt: string) {
  const match = sentAt.match(/^([A-Za-z]+ \d+), \d+ (.+)$/);
  return match ? `${match[1]} · ${match[2].replace(':00', '')}` : sentAt;
}

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
  const mailboxConnected = MOCK_MAILBOX.connected;
  const [recipients, setRecipients] = useState<EmailContact[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'sent' | 'compose'>('compose');
  const [composeTab, setComposeTab] = useState<'write' | 'preview'>('write');
  const [selectedId, setSelectedId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sentQuery, setSentQuery] = useState('');
  const [sentStatus, setSentStatus] = useState<'ALL' | 'ACCEPTED' | 'FAILED'>('ALL');
  const recentSends = useRecentSends();
  const templates = useEmailTemplates();
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const selected = recentSends.find((s) => s.id === selectedId) ?? recentSends[0] ?? null;
  const visibleSends = filterRecentSends(recentSends, sentQuery, sentStatus);
  const template: EmailTemplate | null = templates.find((t) => t.id === templateId) ?? null;
  const priorSends = recipients.flatMap((contact) =>
    priorSendsFor(recentSends, contact.email).map((send) => ({ ...send, who: contact.name }))
  );

  const eligibleContacts = useMemo(
    () => MOCK_CONTACTS.filter((c) => c.eligible),
    []
  );

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligibleContacts;
    return eligibleContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [eligibleContacts, query]);

  const previewContact = recipients[0] ?? null;
  const missing = [
    recipients.length === 0 ? 'a contact' : '',
    !subject.trim() ? 'a subject' : '',
    !message.trim() ? 'a message' : '',
  ].filter(Boolean);
  const eligible = missing.length === 0 && mailboxConnected;

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
    setRecipients((prev) => (prev.some((r) => r.id === c.id) ? prev : [...prev, c]));
    setPickerOpen(false);
    setQuery('');
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

  if (!mailboxConnected) {
    return (
      <PageShell>
        <div className="ema-page ema-shell">
          <section className="ema-card">
            <div className="ema-zero" style={{ padding: '60px 24px' }}>
              <span className="ema-zero__icon">
                <Link2 className="h-6 w-6" strokeWidth={2.1} />
              </span>
              <p className="ema-zero__title">Connect your Gmail mailbox first</p>
              <p className="ema-zero__desc">
                Composing needs a connected Gmail or Google Workspace mailbox. Connect it from Settings — Channels,
                or ask an admin if you do not see the option.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link to="/settings?tab=channels" className="ema-btn ema-btn--primary">Connect Gmail</Link>
              </div>
            </div>
          </section>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="ema-page ema-shell">
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

        <div className="ema-split">
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
                className="ema-input"
                placeholder="Filter by name, email, or subject"
                value={sentQuery}
                onChange={(e) => setSentQuery(e.target.value)}
                aria-label="Filter sent emails"
              />
              <div className="ema-sent__status" role="group" aria-label="Filter by status">
                {(['ALL', 'ACCEPTED', 'FAILED'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`ema-sent__statusbtn ${sentStatus === status ? 'ema-sent__statusbtn--on' : ''}`}
                    aria-pressed={sentStatus === status}
                    onClick={() => setSentStatus(status)}
                  >
                    {status === 'ALL' ? 'All' : status === 'ACCEPTED' ? 'Accepted' : 'Failed'}
                  </button>
                ))}
              </div>
            </div>
            <div className="ema-sent__list" role="listbox" aria-label="Sent emails">
              {recentSends.length === 0 && (
                <p className="px-2 py-6 text-center text-[12px] font-semibold text-[var(--ema-muted)]">
                  No sent emails saved.
                </p>
              )}
              {recentSends.length > 0 && visibleSends.length === 0 && (
                <p className="px-2 py-6 text-center text-[12px] font-semibold text-[var(--ema-muted)]">
                  No emails match this filter.
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
                        {send.status === 'ACCEPTED' ? (
                          <span className="ema-chip ema-chip--accepted">Accepted</span>
                        ) : (
                          <span className="ema-chip ema-chip--failed">Failed</span>
                        )}
                      </span>
                      <span className="ema-sent__subject">{send.subject}</span>
                      <span className="ema-sent__meta">
                        <span className="ema-sent__email">{send.email}</span>
                        <span className="ema-sent__time">{shortWhen(send.sentAt)}</span>
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
                          <span className="ema-mail__from">From {MOCK_MAILBOX.email}</span>
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
                      <span className="ema-from__addr block">{MOCK_MAILBOX.email}</span>
                      <span className="ema-from__via">
                        <Check className="h-[10px] w-[10px]" strokeWidth={3} />
                        Connected via Google (Read-only)
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
                        <div className="ema-picker__list">
                          {filteredContacts.length === 0 && (
                            <p className="px-3 py-4 text-center text-[11.5px] font-semibold text-[var(--ema-muted)]">
                              No eligible contacts found
                            </p>
                          )}
                          {filteredContacts.map((c) => {
                            const picked = recipients.some((r) => r.id === c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`ema-picker__item ${picked ? 'ema-picker__item--on' : ''}`}
                                aria-pressed={picked}
                                onClick={() => pickContact(c)}
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
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-[var(--ema-line)] px-3 py-2">
                          <p className="text-[10.5px] font-semibold text-[var(--ema-muted)]">
                            Only contacts with a valid email and permission are shown.
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
                            <span className="ema-prior__meta">{send.who} · {shortWhen(send.sentAt)}</span>
                          </span>
                          <span className={`ema-chip ${send.status === 'ACCEPTED' ? 'ema-chip--accepted' : 'ema-chip--failed'}`}>
                            {send.status === 'ACCEPTED' ? 'Accepted' : 'Failed'}
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
                    className="ema-textarea"
                    placeholder="Write your message here..."
                    maxLength={MESSAGE_MAX}
                    rows={8}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

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
                  <button type="button" className="ema-btn ema-btn--primary" disabled={!eligible}>
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
                    {selected.status === 'ACCEPTED' ? (
                      <span className="ema-chip ema-chip--accepted">Accepted by Gmail</span>
                    ) : (
                      <span className="ema-chip ema-chip--failed">Failed</span>
                    )}
                    <button
                      type="button"
                      className="ema-iconbtn"
                      aria-label={`Delete email to ${selected.name}`}
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
                {selected.status === 'ACCEPTED' ? (
                  <div className="ema-notice ema-notice--ok" role="status" style={{ margin: '0 16px' }}>
                    <Check className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
                    <span>Gmail accepted this email. Delivery, opens, and replies are not shown.</span>
                  </div>
                ) : (
                  <div className="ema-notice ema-notice--fail" role="status" style={{ margin: '0 16px' }}>
                    <Info className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
                    <span>{selected.failReason || 'Gmail did not accept this email. It was not sent.'}</span>
                  </div>
                )}
                <div className="ema-mail">
                  <div className="ema-mail__who">
                    <span className={`ema-avatar ema-avatar--${selected.avatar}`} style={{ width: 36, height: 36, fontSize: 12 }}>
                      {initials(selected.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="ema-mail__from">From {MOCK_MAILBOX.email}</span>
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
        <ConfirmDialog
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => {
            if (!selected) return;
            const index = recentSends.findIndex((send) => send.id === selected.id);
            const next = recentSends[index + 1] ?? recentSends[index - 1] ?? null;
            deleteRecentSend(selected.id);
            setSelectedId(next?.id ?? '');
            setDeleteOpen(false);
            setPanel('sent');
          }}
          title="Delete this email?"
          description="This removes the email from Samyoj’s sent list. It does not delete the copy in Gmail."
          highlight={selected?.subject}
          highlightLabel="Subject"
          confirmLabel="Delete email"
          cancelLabel="Keep email"
          variant="danger"
          icon={Trash2}
        />
      </div>
    </PageShell>
  );
}
