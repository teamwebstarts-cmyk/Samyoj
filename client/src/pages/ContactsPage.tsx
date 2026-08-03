import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Plus, Settings2, Target, Upload, UserCheck, Users } from 'lucide-react';
import ContactBulkBar from '../components/contacts/ContactBulkBar';
import ContactBulkTagModal from '../components/contacts/ContactBulkTagModal';
import ContactDetailPanel from '../components/contacts/ContactDetailPanel';
import ContactFiltersBar, { type ContactQuickFilter } from '../components/contacts/ContactFiltersBar';
import ContactPipelineTab from '../components/contacts/ContactPipelineTab';
import ContactTable from '../components/contacts/ContactTable';
import ContactCard from '../components/contacts/ContactCard';
import ContactTagManager from '../components/contacts/ContactTagManager';
import ImportContactsModal from '../components/contacts/ImportContactsModal';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppTextarea from '../components/ui/AppTextarea';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import Pagination from '../components/ui/Pagination';
import SegmentedControl from '../components/ui/SegmentedControl';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { ModalCallout } from '../components/ui/modalUi';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { contactApi } from '../services/api';
import { downloadBlob } from '../utils/contactUtils';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhone } from '../utils/phone';
import { toastError, toastSuccess } from '../utils/toast';
import { readNumberCache, writeNumberCache } from '../utils/whatsappNumberCache';
import { messagingConsent } from '../utils/plainLanguage';
import type { Contact, ContactSummary, ContactTag } from '../types';

const emptyForm = { phone: '', name: '', email: '', tags: '', notes: '', optedIn: true };

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
  const [form, setForm] = useState(emptyForm);
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
    contactApi
      .tags()
      .then(({ data }) => setAvailableTags(data.data.tags || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

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
    setLoading(true);
    contactApi
      .list(listParams)
      .then(({ data }) => {
        setContacts(data.data.contacts);
        setTotal(data.data.total);
        setSummary(
          data.data.summary ?? { total: data.data.total, named: 0, optedIn: 0, active7d: 0, tagged: 0 }
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [listParams]);

  loadRef.current = load;

  // Deep-link from Inbox “View full contact”
  useEffect(() => {
    const id = searchParams.get('highlight');
    if (!id) return;
    let cancelled = false;
    contactApi
      .get(id)
      .then(({ data }) => {
        if (cancelled) return;
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
  }, [searchParams, setSearchParams]);

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
      setLoading(false);
      return;
    }

    setDetailContact(null);
    setDetailOpen(false);
    setSelectedIds([]);
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
      optedIn: contact.optedIn ?? false,
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

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

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
          optedIn: form.optedIn,
        });
      } else {
        await contactApi.create({
          phone: phone!,
          name: form.name || undefined,
          email: form.email || undefined,
          tags,
          notes: form.notes || undefined,
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

  const handleImportContacts = async (
    rows: Array<{ phone: string; name?: string; tags?: string[]; notes?: string }>
  ) => {
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

  return (
    <PageShell className={selectedIds.length > 0 ? 'pb-28' : undefined}>
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          badge="Audience"
          badgeIcon={Users}
          title={viewTab === 'pipeline' ? 'Sales pipeline' : 'Your contacts'}
          description={
            viewTab === 'pipeline'
              ? 'Track prospects from first contact through to won or lost.'
              : 'Manage customers, tags, and groups for campaigns.'
          }
          accent="sky"
          stats={
            viewTab === 'pipeline'
              ? [
                  { label: 'Total', value: pipelineStats.total },
                  {
                    label: 'Active',
                    value: pipelineStats.active,
                    tone: 'text-sky-700 dark:text-sky-300',
                  },
                  {
                    label: 'Won',
                    value: pipelineStats.won,
                    tone: 'text-emerald-700 dark:text-emerald-300',
                  },
                ]
              : [
                  { label: 'Total', value: summary.total },
                  {
                    label: messagingConsent.statsLabel,
                    value: summary.optedIn,
                    tone: 'text-emerald-700 dark:text-emerald-300',
                  },
                  {
                    label: 'Active (7d)',
                    value: summary.active7d,
                    tone: 'text-sky-700 dark:text-sky-300',
                  },
                  {
                    label: 'Tagged',
                    value: summary.tagged,
                    tone: 'text-violet-700 dark:text-violet-300',
                  },
                ]
          }
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

        {viewTab === 'pipeline' ? (
          <ContactPipelineTab refreshToken={pipelineRefresh} onStatsChange={setPipelineStats} />
        ) : (
          <div className="inbox-shell overflow-hidden">
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

            {loading ? (
              <div className="p-6">
                <LoadingState label="Loading contacts..." />
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-4 sm:p-6">
                <EmptyState
                  icon={Users}
                  variant={hasActiveFilters ? 'filter' : 'default'}
                  title={hasActiveFilters ? 'No contacts match your filters' : 'No contacts yet'}
                  description={
                    hasActiveFilters
                      ? 'Try a different search word or clear your filters.'
                      : 'Add people one by one or import a list from a spreadsheet (CSV file).'
                  }
                  steps={
                    hasActiveFilters
                      ? undefined
                      : ['Tap Add contact for one person', 'Or tap Import for a list', 'Then message them from Inbox']
                  }
                  action={
                    !hasActiveFilters ? (
                      <div className="flex flex-wrap justify-center gap-2">
                        <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                          Add contact
                        </AppButton>
                        <AppButton variant="secondary" icon={<Upload size={16} />} onClick={() => setImportOpen(true)}>
                          Import CSV
                        </AppButton>
                      </div>
                    ) : (
                      <AppButton variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </AppButton>
                    )
                  }
                />
              </div>
            ) : (
              <>
                <ResponsiveDataView
                  items={contacts}
                  cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
                  tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
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
                      onToggleSelect={toggleSelect}
                      onToggleSelectAll={toggleSelectAll}
                      onView={openDetail}
                      onEdit={openEdit}
                      onDelete={handleDeleteContact}
                      onMessage={openMessage}
                    />
                  )}
                />
                <div className="border-t border-theme-border lg:hidden">
                  <Pagination
                    page={page}
                    pageSize={DEFAULT_PAGE_SIZE}
                    total={total}
                    onPageChange={setPage}
                    className="!border-t-0"
                  />
                </div>
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

          <AppInput
            id="contact-phone"
            label="Phone"
            placeholder={PHONE_PLACEHOLDER}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            disabled={!!editing}
            hint={editing ? 'Phone cannot be changed' : PHONE_HINT}
            inputMode="tel"
          />
          <AppInput
            id="contact-name"
            label="Name"
            placeholder="Customer name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <AppInput
            id="contact-email"
            label="Email"
            placeholder="customer@example.com"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <AppInput
            id="contact-tags"
            label="Tags"
            hint="Comma separated"
            placeholder="vip, lead"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <AppTextarea
            id="contact-notes"
            label="Notes"
            placeholder="Internal notes about this contact..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-theme-border bg-theme-subtle/40 px-4 py-3.5">
            <input
              type="checkbox"
              checked={form.optedIn}
              onChange={(e) => setForm({ ...form, optedIn: e.target.checked })}
              className="h-4 w-4 rounded border-theme-border text-emerald-600 focus:ring-emerald-500/30"
            />
            <div>
              <p className="text-[13px] font-semibold text-theme-fg">{messagingConsent.allowCampaignMessages}</p>
              <p className="text-[11px] font-medium text-theme-muted">
                {messagingConsent.allowCampaignHint}
              </p>
            </div>
          </label>
        </form>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete contact?"
        description={
          deleteTarget
            ? `${deleteTarget.name || deleteTarget.phone} will be permanently removed along with their conversation history.`
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
