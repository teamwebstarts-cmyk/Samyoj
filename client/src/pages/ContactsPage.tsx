import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  MessageSquare,
  Plus,
  Settings2,
  Tag,
  Target,
  Trophy,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import ContactBulkBar from '../components/contacts/ContactBulkBar';
import ContactBulkTagModal from '../components/contacts/ContactBulkTagModal';
import ContactDetailPanel from '../components/contacts/ContactDetailPanel';
import ContactFiltersBar, { type ContactQuickFilter } from '../components/contacts/ContactFiltersBar';
import ContactPipelineTab from '../components/contacts/ContactPipelineTab';
import ContactTable from '../components/contacts/ContactTable';
import ContactCard from '../components/contacts/ContactCard';
import ContactTagManager from '../components/contacts/ContactTagManager';
import ImportContactsModal from '../components/contacts/ImportContactsModal';
import type { ContactImportRow } from '../utils/contactImport';
import AppButton from '../components/ui/AppButton';
import ContactFieldsForm from '../components/contacts/ContactFieldsForm';
import { emptyContactForm, parseContactTagList, type ContactFormValues } from '../components/contacts/contactForm';
import { asCustomAttributes, parseCustomAttributeLines, stringifyCustomAttributes } from '../utils/customAttributes';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import ListLayoutSkeleton from '../components/ui/ListLayoutSkeleton';
import ContactHero, { type ContactHeroStat } from '../components/contacts/ContactHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import Pagination from '../components/ui/Pagination';
import SegmentedControl from '../components/ui/SegmentedControl';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { ModalCallout } from '../components/ui/modalUi';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { contactApi } from '../services/api';
import { downloadBlob } from '../utils/contactUtils';
import { PHONE_HINT, validatePhone } from '../utils/phone';
import { toastError, toastSuccess } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';
import { messagingConsent } from '../utils/plainLanguage';
import { contactGetsCampaignMessages } from '../utils/contactConsent';
import type { Contact, ContactSummary, ContactTag } from '../types';

const emptyForm = emptyContactForm;

const CONTACTS_CACHE_KEY = 'contacts';

type ContactsNumberCache = {
  contacts: Contact[];
  total: number;
  summary: ContactSummary;
  page: number;
  search: string;
  quickFilter: ContactQuickFilter;
  tagFilter: string;
  sourceFilter: string;
};

export default function ContactsPage() {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewTab = searchParams.get('tab') === 'pipeline' ? 'pipeline' : 'all';
  const setViewTab = (tab: 'all' | 'pipeline') => {
    setSearchParams(tab === 'pipeline' ? { tab: 'pipeline' } : {});
  };
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<ContactQuickFilter>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [availableTags, setAvailableTags] = useState<ContactTag[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ContactSummary>({
    total: 0,
    named: 0,
    optedIn: 0,
    active7d: 0,
    tagged: 0,
  });
  const [slideOpen, setSlideOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactFormValues>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkTags, setBulkTags] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [pipelineStats, setPipelineStats] = useState({ total: 0, active: 0, won: 0 });
  const [pipelineRefresh, setPipelineRefresh] = useState(0);

  const handleLeadCreated = useCallback(() => {
    setSearchParams({ tab: 'pipeline' });
    setPipelineRefresh((n) => n + 1);
  }, [setSearchParams]);

  const debouncedSearch = useDebouncedValue(search);
  const loadRef = useRef<() => void>(() => {});
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const contactsSnapshotRef = useRef<ContactsNumberCache>({
    contacts: [],
    total: 0,
    summary: { total: 0, named: 0, optedIn: 0, active7d: 0, tagged: 0 },
    page: 1,
    search: '',
    quickFilter: 'all',
    tagFilter: '',
    sourceFilter: '',
  });

  contactsSnapshotRef.current = {
    contacts,
    total,
    summary,
    page,
    search,
    quickFilter,
    tagFilter,
    sourceFilter,
  };
  const tagNames = useMemo(() => availableTags.map((t) => t.name), [availableTags]);

  const refreshTags = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    contactApi
      .tags()
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setAvailableTags(data.data.tags || []);
      })
      .catch(console.error);
  }, [activeNumber, resolved]);

  useEffect(() => {
    refreshTags();
  }, [refreshTags, resolved, activeNumber?.id]);

  const listParams = useMemo(() => {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (tagFilter) params.tag = tagFilter;
    if (sourceFilter) params.source = sourceFilter;

    if (quickFilter === 'opted_in') params.optedIn = 'true';
    if (quickFilter === 'active') params.active = '7d';
    if (quickFilter === 'untagged' && !tagFilter) params.tag = '__none__';
    if (quickFilter === 'unnamed') params.named = 'false';

    return params;
  }, [debouncedSearch, tagFilter, sourceFilter, quickFilter, page]);

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setLoading(true);
    contactApi
      .list(listParams)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setContacts(data.data.contacts);
        setTotal(data.data.total);
        setSummary(
          data.data.summary ?? { total: data.data.total, named: 0, optedIn: 0, active7d: 0, tagged: 0 }
        );
      })
      .catch(console.error)
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, listParams, resolved]);

  loadRef.current = load;

  // Deep-link from Inbox “View full contact”
  useEffect(() => {
    const id = searchParams.get('highlight');
    if (!id || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    let cancelled = false;
    contactApi
      .get(id)
      .then(({ data }) => {
        if (cancelled || requestNumberId !== activeNumberIdRef.current) return;
        const contact = (data.data?.contact ?? data.data) as Contact;
        if (!contact?.id) return;
        setDetailContact(contact);
        setDetailOpen(true);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete('highlight');
            return next;
          },
          { replace: true }
        );
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [activeNumber, resolved, searchParams, setSearchParams]);

  useOnActiveNumberChange(({ numberId, previousNumberId, isInitial }) => {
    if (isInitial) return;

    if (previousNumberId) {
      writeNumberCache(CONTACTS_CACHE_KEY, previousNumberId, contactsSnapshotRef.current);
    }

    const cached = readNumberCache<ContactsNumberCache>(CONTACTS_CACHE_KEY, numberId);
    if (cached) {
      setContacts(cached.contacts);
      setTotal(cached.total);
      setSummary(cached.summary);
      setPage(cached.page);
      setSearch(cached.search);
      setQuickFilter(cached.quickFilter);
      setTagFilter(cached.tagFilter);
      setSourceFilter(cached.sourceFilter);
      setDetailContact(null);
      setDetailOpen(false);
      setSelectedIds([]);
      setDeleteTarget(null);
      setBulkDeleteOpen(false);
      setBulkTagOpen(false);
      setSlideOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setLoading(true);
      loadRef.current();
      return;
    }

    setDetailContact(null);
    setDetailOpen(false);
    setSelectedIds([]);
    setContacts([]);
    setTotal(0);
    setSummary({ total: 0, named: 0, optedIn: 0, active7d: 0, tagged: 0 });
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
    setBulkTagOpen(false);
    setSlideOpen(false);
    setEditing(null);
    setForm(emptyForm);
    loadRef.current();
  });

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [debouncedSearch, tagFilter, sourceFilter, quickFilter]);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSlideOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setForm({
      phone: contact.phone,
      name: contact.name || '',
      email: contact.email || '',
      tags: contact.tags.join(', '),
      notes: contact.notes || '',
      customAttributes: stringifyCustomAttributes(asCustomAttributes(contact.customAttributes)),
      optedIn: contactGetsCampaignMessages(contact),
    });
    setSlideOpen(true);
  };

  const openDetail = (contact: Contact) => {
    setDetailContact(contact);
    setDetailOpen(true);
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tags = parseContactTagList(form.tags);

    let phone: string | undefined;
    if (!editing) {
      const phoneResult = validatePhone(form.phone);
      if (!phoneResult.ok) {
        toastError(phoneResult.error);
        return;
      }
      phone = phoneResult.phone;
    }

    setSaving(true);
    try {
      if (editing) {
        await contactApi.update(editing.id, {
          name: form.name || undefined,
          email: form.email || undefined,
          tags,
          notes: form.notes || undefined,
          customAttributes: parseCustomAttributeLines(form.customAttributes),
          optedIn: form.optedIn,
        });
      } else {
        await contactApi.create({
          phone: phone!,
          name: form.name || undefined,
          email: form.email || undefined,
          tags,
          notes: form.notes || undefined,
          customAttributes: parseCustomAttributeLines(form.customAttributes),
          optedIn: form.optedIn,
        });
      }
      closeSlide();
      load();
      refreshTags();
      toastSuccess(editing ? 'Contact updated' : 'Contact created');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save contact';
      toastError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setDeleteTarget(editing);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await contactApi.delete(deleteTarget.id);
      if (editing?.id === deleteTarget.id) closeSlide();
      if (detailContact?.id === deleteTarget.id) {
        setDetailOpen(false);
        setDetailContact(null);
      }
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      load();
      refreshTags();
      toastSuccess('Contact deleted');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to delete contact';
      toastError(msg);
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteContact = (contact: Contact) => {
    setDeleteTarget(contact);
  };

  const handleImportContacts = async (rows: ContactImportRow[]) => {
    await contactApi.import(rows);
    load();
    refreshTags();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = { ...listParams, format: 'csv' };
      delete params.page;
      delete params.limit;
      const { data } = await contactApi.export(params);
      downloadBlob(data as Blob, 'contacts.csv');
      toastSuccess('Contacts exported');
    } catch {
      toastError('Failed to export contacts');
    } finally {
      setExporting(false);
    }
  };

  const parseBulkTagList = () =>
    bulkTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

  const confirmBulkDelete = async () => {
    if (!selectedIds.length) return;
    setBulkBusy(true);
    try {
      await contactApi.bulk({ ids: selectedIds, action: 'delete' });
      setSelectedIds([]);
      setBulkTags('');
      load();
      refreshTags();
      toastSuccess('Contacts deleted');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Bulk delete failed';
      toastError(msg);
    } finally {
      setBulkBusy(false);
      setBulkDeleteOpen(false);
    }
  };

  const runBulk = async (
    action: 'delete' | 'addTags' | 'removeTags' | 'setOptedIn',
    extra?: { optedIn?: boolean }
  ) => {
    if (!selectedIds.length) return;
    if (action === 'delete') {
      setBulkDeleteOpen(true);
      return;
    }
    if ((action === 'addTags' || action === 'removeTags') && !parseBulkTagList().length) {
      toastError('Enter at least one tag');
      return;
    }

    setBulkBusy(true);
    try {
      await contactApi.bulk({
        ids: selectedIds,
        action,
        tags: parseBulkTagList(),
        optedIn: extra?.optedIn,
      });
      setSelectedIds([]);
      setBulkTags('');
      setBulkTagOpen(false);
      load();
      refreshTags();
      toastSuccess('Bulk action completed');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Bulk action failed';
      toastError(msg);
    } finally {
      setBulkBusy(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map((c) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const openMessage = (contact: Contact) => {
    if (contact.conversation?.id) {
      navigate(`/inbox?conversation=${contact.conversation.id}`);
    } else {
      const phone = encodeURIComponent(contact.phone);
      const name = encodeURIComponent(contact.name || '');
      navigate(`/inbox?new=true&phone=${phone}&name=${name}`);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setQuickFilter('all');
    setTagFilter('');
    setSourceFilter('');
  };

  const hasActiveFilters = Boolean(
    search || quickFilter !== 'all' || tagFilter || sourceFilter
  );

  const allSelected = contacts.length > 0 && selectedIds.length === contacts.length;
  const partialSelected = selectedIds.length > 0 && !allSelected;

  const heroStats: ContactHeroStat[] =
    viewTab === 'pipeline'
      ? [
          { label: 'Total leads', value: pipelineStats.total, hint: 'All prospects', tone: 'total', icon: Target },
          { label: 'Active', value: pipelineStats.active, hint: 'In progress', tone: 'pipeline', icon: Clock },
          { label: 'Won', value: pipelineStats.won, hint: 'Closed deals', tone: 'won', icon: Trophy },
        ]
      : [
          { label: 'Total contacts', value: summary.total, hint: 'All contacts in list', tone: 'total', icon: Users },
          { label: messagingConsent.statsLabel, value: summary.optedIn, hint: 'Campaign eligible', tone: 'optedIn', icon: CheckCircle2 },
          { label: 'Active (7d)', value: summary.active7d, hint: 'Messaged recently', tone: 'active', icon: Activity },
          { label: 'Tagged', value: summary.tagged, hint: 'Grouped & segmented', tone: 'tagged', icon: Tag },
        ];

  return (
    <PageShell list={viewTab === 'all'} className={selectedIds.length > 0 ? 'pb-28' : undefined}>
      <div className={viewTab === 'all' ? 'list-page-stack' : 'space-y-[var(--density-stack-gap)]'}>
        <div className={`space-y-[var(--density-stack-gap)] ${viewTab === 'all' ? 'shrink-0' : ''}`}>
        <ContactHero
          badge={viewTab === 'pipeline' ? 'Pipeline' : 'Audience'}
          badgeIcon={viewTab === 'pipeline' ? Target : Users}
          title={viewTab === 'pipeline' ? 'Sales pipeline' : 'Your contacts'}
          description={
            viewTab === 'pipeline'
              ? 'Track prospects from first contact through to won or lost.'
              : 'Manage customers, tags, and groups for campaigns.'
          }
          stats={heroStats}
        />

        <SegmentedControl
          embedded
          value={viewTab}
          onChange={setViewTab}
          options={[
            { value: 'all', label: 'All contacts', shortLabel: 'All', icon: Users },
            { value: 'pipeline', label: 'Pipeline', shortLabel: 'Pipeline', icon: Target },
          ]}
          ariaLabel="Contact views"
        />
        </div>

        {viewTab === 'pipeline' ? (
          <ContactPipelineTab refreshToken={pipelineRefresh} onStatsChange={setPipelineStats} />
        ) : (
          <div className="inbox-shell list-shell-body overflow-hidden">
            <ListToolbar
              embedded
              stackFilters
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search name, phone, or email..."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={<Settings2 size={15} />}
                    onClick={() => setTagManagerOpen(true)}
                  >
                    Tags
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={<Download size={15} />}
                    onClick={handleExport}
                    loading={exporting}
                  >
                    Export
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="sm"
                    icon={<Upload size={15} />}
                    onClick={() => setImportOpen(true)}
                  >
                    Import
                  </AppButton>
                  <AppButton size="sm" icon={<Plus size={15} />} onClick={openCreate}>
                    Add contact
                  </AppButton>
                </div>
              }
            />

            <ContactFiltersBar
              quickFilter={quickFilter}
              onQuickFilterChange={setQuickFilter}
              tagFilter={tagFilter}
              onTagFilterChange={setTagFilter}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
              tagNames={tagNames}
              total={summary.total}
              filteredTotal={total}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />

            {loading && contacts.length === 0 ? (
              <ListLayoutSkeleton
                label="Loading contacts"
                tableHeaders={['Contact', 'Tags', 'Source', 'Updated', 'Actions']}
              />
            ) : contacts.length === 0 ? (
              <div className="p-4 sm:p-6">
                {hasActiveFilters ? (
                  <EmptyState
                    icon={Users}
                    variant="filter"
                    title="No contacts match your filters"
                    description="Try a different search word or clear your filters."
                    action={
                      <AppButton variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </AppButton>
                    }
                  />
                ) : (
                  <div className="relative overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/35 to-indigo-50/45 px-4 py-5 shadow-sm dark:border-sky-900/50 dark:from-slate-950 dark:via-sky-950/15 dark:to-indigo-950/15 sm:px-6 sm:py-6">
                    <div
                      className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-500/10"
                      aria-hidden="true"
                    />
                    <div
                      className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-indigo-300/15 blur-3xl dark:bg-indigo-500/10"
                      aria-hidden="true"
                    />

                    <div className="relative grid items-center gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
                      <div className="hidden rounded-2xl border border-sky-100 bg-white/75 p-4 shadow-sm dark:border-sky-900/50 dark:bg-slate-950/60 lg:block">
                        <div className="flex items-center gap-2">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_8px_20px_rgba(2,132,199,0.25)]">
                            <Users className="h-5 w-5" strokeWidth={2.1} />
                          </span>
                          <div>
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                              Audience
                            </p>
                            <p className="mt-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                              Ready to connect
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[10px] font-bold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                            <Upload className="h-3.5 w-3.5" />
                            Spreadsheet import
                          </div>
                          <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[10px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                            <Tag className="h-3.5 w-3.5" />
                            Segmented tags
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                          Add your first contact
                        </h3>
                        <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
                          Add customers individually or import an entire spreadsheet to start messaging and running campaigns.
                        </p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          {[
                            {
                              icon: Plus,
                              label: 'Add or import list',
                              tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300',
                            },
                            {
                              icon: Tag,
                              label: 'Organize with tags',
                              tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300',
                            },
                            {
                              icon: MessageSquare,
                              label: 'Message from Inbox',
                              tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300',
                            },
                          ].map(({ icon: StepIcon, label, tone }, index) => (
                            <div
                              key={label}
                              className="group flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_8px_20px_rgba(2,132,199,0.10)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:hover:border-sky-800"
                            >
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                                <StepIcon className="h-4 w-4" strokeWidth={2.1} />
                              </span>
                              <span className="min-w-0">
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-extrabold tabular-nums text-sky-600 dark:text-sky-300">
                                    0{index + 1}
                                  </span>
                                  <span className="truncate text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                                    {label}
                                  </span>
                                </span>
                              </span>
                              {index < 2 && (
                                <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-500 sm:block" />
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2.5">
                          <AppButton
                            className="!min-h-9"
                            size="sm"
                            icon={<Plus className="h-3.5 w-3.5" />}
                            onClick={openCreate}
                          >
                            Add contact
                          </AppButton>
                          <AppButton
                            variant="secondary"
                            className="!min-h-9"
                            size="sm"
                            icon={<Upload className="h-3.5 w-3.5" />}
                            onClick={() => setImportOpen(true)}
                          >
                            Import CSV
                          </AppButton>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="list-shell-scroll">
                  <ResponsiveDataView
                    items={contacts}
                    cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
                    tableClassName="px-4 sm:px-5 pt-4"
                    renderCard={(contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        selected={selectedIds.includes(contact.id)}
                        onToggleSelect={() => toggleSelect(contact.id)}
                        onView={() => openDetail(contact)}
                        onEdit={() => openEdit(contact)}
                        onDelete={() => handleDeleteContact(contact)}
                        onMessage={() => openMessage(contact)}
                      />
                    )}
                    renderTable={() => (
                      <ContactTable
                        contacts={contacts}
                        page={page}
                        pageSize={DEFAULT_PAGE_SIZE}
                        total={total}
                        selectedIds={selectedIds}
                        allSelected={allSelected}
                        partialSelected={partialSelected}
                        onPageChange={setPage}
                        showPagination={false}
                        onToggleSelect={toggleSelect}
                        onToggleSelectAll={toggleSelectAll}
                        onView={openDetail}
                        onEdit={openEdit}
                        onDelete={handleDeleteContact}
                        onMessage={openMessage}
                      />
                    )}
                  />
                </div>
                <footer className="list-shell-footer shrink-0">
                  <Pagination
                    page={page}
                    pageSize={DEFAULT_PAGE_SIZE}
                    total={total}
                    onPageChange={setPage}
                  />
                </footer>
              </>
            )}
          </div>
        )}
      </div>

      <ContactBulkBar
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onOpenTags={() => setBulkTagOpen(true)}
        onOptIn={() => runBulk('setOptedIn', { optedIn: true })}
        onOptOut={() => runBulk('setOptedIn', { optedIn: false })}
        onDelete={() => runBulk('delete')}
        onAddToCampaign={() => navigate(`/campaigns?contacts=${selectedIds.join(',')}`)}
        busy={bulkBusy}
      />

      <ContactBulkTagModal
        open={bulkTagOpen}
        onClose={() => {
          setBulkTagOpen(false);
          setBulkTags('');
        }}
        selectedCount={selectedIds.length}
        availableTags={tagNames}
        bulkTags={bulkTags}
        onBulkTagsChange={setBulkTags}
        onAddTags={() => void runBulk('addTags')}
        onRemoveTags={() => void runBulk('removeTags')}
        busy={bulkBusy}
      />

      <ContactDetailPanel
        contact={detailContact}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailContact(null);
        }}
        onEdit={(contact) => {
          setDetailOpen(false);
          openEdit(contact);
        }}
        onUpdated={load}
        onLeadCreated={handleLeadCreated}
      />

      <ContactTagManager
        open={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
        tags={availableTags}
        onRename={async (from, to) => {
          await contactApi.renameTag(from, to);
          refreshTags();
          load();
          toastSuccess('Tag renamed');
        }}
        onDelete={async (tag) => {
          await contactApi.deleteTag(tag);
          refreshTags();
          load();
          toastSuccess('Tag removed');
        }}
      />

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? 'Edit contact' : 'Add contact'}
        subtitle={editing ? 'Update contact details' : 'Save a new customer contact'}
        icon={UserCheck}
        accent="sky"
        footer={
          <SlideOverFooter
            onCancel={closeSlide}
            submitLabel={editing ? 'Update contact' : 'Add contact'}
            loading={saving}
            onDelete={editing ? handleDelete : undefined}
            deleteLabel="Delete contact"
          />
        }
      >
        <form id="slideover-form" onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <ModalCallout
              icon={UserCheck}
              accent="sky"
              title="New customer record"
              description="Use international format with country code for WhatsApp delivery."
            />
          )}

          <ContactFieldsForm
            form={form}
            onChange={setForm}
            phoneMode="plain"
            phoneDisabled={!!editing}
            phoneHint={editing ? 'Phone cannot be changed' : PHONE_HINT}
            availableTags={tagNames}
          />
        </form>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete contact?"
        description={
          deleteTarget
            ? `${deleteTarget.name || deleteTarget.phone} will be removed. Note: If this contact has recorded chat, call, or order history, the record is preserved in audit logs for compliance.`
            : undefined
        }
        confirmLabel="Delete contact"
        variant="danger"
        loading={saving}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
        title={`Delete ${selectedIds.length} contact(s)?`}
        description="Selected contacts will be permanently removed from your workspace."
        confirmLabel="Delete all"
        variant="danger"
        loading={bulkBusy}
      />

      <ImportContactsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportContacts}
      />
    </PageShell>
  );
}
