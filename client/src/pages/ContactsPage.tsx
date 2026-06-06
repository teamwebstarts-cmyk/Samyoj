import { useCallback, useEffect, useState } from 'react';
import { Plus, Upload, UserCheck, Users } from 'lucide-react';
import ImportContactsModal from '../components/contacts/ImportContactsModal';
import ContactAvatar from '../components/inbox/ContactAvatar';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import AppTextarea from '../components/ui/AppTextarea';
import DataTable, { TableSerialCell } from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHeader from '../components/ui/PageHeader';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import RowActions from '../components/ui/RowActions';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { contactApi } from '../services/api';
import { PHONE_HINT, PHONE_PLACEHOLDER, validatePhone } from '../utils/phone';
import type { Contact } from '../types';

const emptyForm = { phone: '', name: '', tags: '', notes: '' };

const ALL_TAGS = '';
const UNTAGGED = '__none__';
const ALL_NAMES = '';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState(ALL_TAGS);
  const [nameFilter, setNameFilter] = useState(ALL_NAMES);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, named: 0 });
  const [slideOpen, setSlideOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    contactApi
      .tags()
      .then(({ data }) => setAvailableTags(data.data.tags))
      .catch(console.error);
  }, []);

  const refreshTags = useCallback(() => {
    contactApi
      .tags()
      .then(({ data }) => setAvailableTags(data.data.tags))
      .catch(console.error);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (tagFilter) params.tag = tagFilter;
    if (nameFilter === 'named') params.named = 'true';
    if (nameFilter === 'unnamed') params.named = 'false';

    contactApi
      .list(params)
      .then(({ data }) => {
        setContacts(data.data.contacts);
        setTotal(data.data.total);
        setSummary(data.data.summary ?? { total: data.data.total, named: 0 });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debouncedSearch, tagFilter, nameFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tagFilter, nameFilter]);

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
      tags: contact.tags.join(', '),
      notes: contact.notes || '',
    });
    setSlideOpen(true);
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
        alert(phoneResult.error);
        return;
      }
      phone = phoneResult.phone;
    }

    setSaving(true);
    try {
      if (editing) {
        await contactApi.update(editing.id, {
          name: form.name || undefined,
          tags,
          notes: form.notes || undefined,
        });
      } else {
        await contactApi.create({
          phone: phone!,
          name: form.name || undefined,
          tags,
          notes: form.notes || undefined,
        });
      }
      closeSlide();
      load();
      refreshTags();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to save contact';
      alert(msg);
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
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to delete contact';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!confirm(`Delete contact ${contact.name || contact.phone}?`)) return;
    try {
      await contactApi.delete(contact.id);
      load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Failed to delete contact';
      alert(msg);
    }
  };

  const handleImportContacts = async (
    rows: Array<{ phone: string; name?: string; tags?: string[]; notes?: string }>
  ) => {
    await contactApi.import(rows);
    load();
    refreshTags();
  };

  const hasActiveFilters = Boolean(search || tagFilter || nameFilter);

  return (
    <PageShell>
      <PageHeader
        actions={
          <>
            <AppButton variant="secondary" icon={<Upload size={16} />} onClick={() => setImportOpen(true)}>
              Import
            </AppButton>
            <AppButton icon={<Plus size={16} />} onClick={openCreate}>
              Add Contact
            </AppButton>
          </>
        }
      />

      <div className="space-y-5 animate-fade-up-delay sm:space-y-6">
        <PageHero
          badge="Audience"
          badgeIcon={Users}
          title="Manage your customer contacts"
          description="Keep phone numbers organized with names, tags, and notes for campaigns and inbox conversations."
          accent="sky"
          stats={[
            { label: 'Total', value: summary.total },
            { label: 'Named', value: summary.named, tone: 'text-sky-700' },
            {
              label: 'Tagged',
              value: contacts.filter((c) => c.tags.length > 0).length,
              tone: 'text-violet-700',
            },
          ]}
        />

        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name or phone..."
          filters={
            <>
              <AppSelect
                className="w-full sm:w-44"
                value={tagFilter}
                placeholder="All tags"
                isSearchable={availableTags.length > 6}
                options={[
                  { value: ALL_TAGS, label: 'All tags' },
                  { value: UNTAGGED, label: 'Untagged' },
                  ...availableTags.map((tag) => ({ value: tag, label: tag })),
                ]}
                onChange={(e) => setTagFilter(e.target.value)}
              />
              <AppSelect
                className="w-full sm:w-40"
                value={nameFilter}
                placeholder="All contacts"
                isSearchable={false}
                options={[
                  { value: ALL_NAMES, label: 'All contacts' },
                  { value: 'named', label: 'Named' },
                  { value: 'unnamed', label: 'Unnamed' },
                ]}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </>
          }
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
                : 'Add your first contact to get started.'
            }
            action={
              !hasActiveFilters ? (
                <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                  Add Contact
                </AppButton>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            headers={['Contact', 'Phone', 'Tags', 'Actions']}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          >
            {contacts.map((contact, index) => (
              <tr key={contact.id}>
                <TableSerialCell page={page} pageSize={DEFAULT_PAGE_SIZE} rowIndex={index} />
                <td>
                  <div className="flex items-center gap-3">
                    <ContactAvatar name={contact.name} phone={contact.phone} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900">
                        {contact.name || 'Unnamed contact'}
                      </p>
                      {contact.notes && (
                        <p className="truncate text-[11px] font-medium text-neutral-500">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="font-mono text-[13px] text-neutral-600">+{contact.phone}</td>
                <td>
                  {contact.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-100"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[13px] text-neutral-400">—</span>
                  )}
                </td>
                <td>
                  <RowActions
                    onEdit={() => openEdit(contact)}
                    onDelete={() => handleDeleteContact(contact)}
                  />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={editing ? 'Edit contact' : 'Add contact'}
        subtitle={editing ? 'Update contact details' : 'Save a new customer contact'}
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
            <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-500/10 to-blue-500/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]">
                  <UserCheck className="h-4 w-4" strokeWidth={2.25} />
                </div>
                <div>
                  <p className="text-[13px] font-extrabold text-neutral-900">New customer record</p>
                  <p className="mt-0.5 text-[12px] font-medium text-neutral-600">
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
