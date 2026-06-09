import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus, Settings2, Upload, UserCheck, Users } from 'lucide-react';
import ContactBulkBar from '../components/contacts/ContactBulkBar';
import ContactDetailPanel from '../components/contacts/ContactDetailPanel';
import ContactFiltersBar, { type ContactQuickFilter } from '../components/contacts/ContactFiltersBar';
import ContactInsightCards from '../components/contacts/ContactInsightCards';
import ContactTable from '../components/contacts/ContactTable';
import ContactTagManager from '../components/contacts/ContactTagManager';
import ImportContactsModal from '../components/contacts/ImportContactsModal';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppTextarea from '../components/ui/AppTextarea';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { contactApi } from '../services/api';
import { downloadBlob } from '../utils/contactUtils';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhone } from '../utils/phone';
import { toastError, toastSuccess } from '../utils/toast';
import type { Contact, ContactSummary, ContactTag } from '../types';

const emptyForm = { phone: '', name: '', email: '', tags: '', notes: '', optedIn: true };

export default function ContactsPage() {
  const navigate = useNavigate();
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

  const debouncedSearch = useDebouncedValue(search);
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
    if (!editing || !confirm(`Delete contact ${editing.name || editing.phone}?`)) return;
    setSaving(true);
    try {
      await contactApi.delete(editing.id);
      closeSlide();
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
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Delete contact ${contact.name || contact.phone}?`)) return;
    try {
      await contactApi.delete(contact.id);
      setSelectedIds((prev) => prev.filter((id) => id !== contact.id));
      load();
      refreshTags();
      toastSuccess('Contact deleted');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to delete contact';
      toastError(msg);
    }
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

  const runBulk = async (
    action: 'delete' | 'addTags' | 'removeTags' | 'setOptedIn',
    extra?: { optedIn?: boolean }
  ) => {
    if (!selectedIds.length) return;
    if (action === 'delete' && !confirm(`Delete ${selectedIds.length} contact(s)?`)) return;
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
      <PageHeader
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
              Add Contact
            </AppButton>
          </div>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Audience"
          badgeIcon={Users}
          title="Your contacts"
          description="Manage customers, tags, and groups for campaigns."
          accent="sky"
          stats={[
            { label: 'Total', value: summary.total },
            {
              label: 'Opted in',
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
          ]}
        />

        <ContactInsightCards />

        <ContactFiltersBar
          search={search}
          onSearchChange={setSearch}
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
          <LoadingState label="Loading contacts..." />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts found"
            description={
              hasActiveFilters
                ? 'Try adjusting your search or filters.'
                : 'Add your first contact or import a CSV to build your audience.'
            }
            action={
              !hasActiveFilters ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                    Add Contact
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
        ) : (
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
      </div>

      <ContactBulkBar
        selectedCount={selectedIds.length}
        bulkTags={bulkTags}
        onBulkTagsChange={setBulkTags}
        onClear={() => setSelectedIds([])}
        onAddTags={() => runBulk('addTags')}
        onRemoveTags={() => runBulk('removeTags')}
        onOptIn={() => runBulk('setOptedIn', { optedIn: true })}
        onOptOut={() => runBulk('setOptedIn', { optedIn: false })}
        onDelete={() => runBulk('delete')}
        onAddToCampaign={() => navigate(`/campaigns?contacts=${selectedIds.join(',')}`)}
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
            <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-500/10 to-blue-500/5 p-4 dark:border-sky-800/40">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]">
                  <UserCheck className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div>
                  <p className="text-[13px] font-extrabold text-theme-fg">New customer record</p>
                  <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
                    Use international format with country code for WhatsApp delivery.
                  </p>
                </div>
              </div>
            </div>
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
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/50 px-4 py-3.5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <input
              type="checkbox"
              checked={form.optedIn}
              onChange={(e) => setForm({ ...form, optedIn: e.target.checked })}
              className="contact-checkbox h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500/30"
            />
            <div>
              <p className="text-[13px] font-bold text-theme-fg">Marketing opt-in</p>
              <p className="text-[11px] font-medium text-theme-muted">
                Required for campaign broadcasts in most regions.
              </p>
            </div>
          </label>
        </form>
      </SlideOver>

      <ImportContactsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImportContacts}
      />
    </PageShell>
  );
}
