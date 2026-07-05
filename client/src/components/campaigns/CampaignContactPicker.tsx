import { useCallback, useEffect, useState } from 'react';
import { Check, UserCheck } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import { contactApi } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Contact } from '../../types';
import { messagingConsent } from '../../utils/plainLanguage';

interface CampaignContactPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function ContactAvatar({ name, phone }: { name?: string; phone: string }) {
  const initial = (name || phone).charAt(0).toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[12px] font-extrabold text-white shadow-sm">
      {initial}
    </div>
  );
}

export default function CampaignContactPicker({ selectedIds, onChange }: CampaignContactPickerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: '1', limit: '100' };
    if (debouncedSearch) params.search = debouncedSearch;

    contactApi
      .list(params)
      .then(({ data }) => setContacts(data.data.contacts as Contact[]))
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id],
    );
  };

  return (
    <div className="space-y-3">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search contacts by name or phone..."
      />

      <div className="overflow-hidden rounded-2xl border border-theme-border bg-theme-surface">
        {loading ? (
          <p className="px-4 py-8 text-center text-[12px] font-medium text-theme-muted">
            Loading contacts…
          </p>
        ) : contacts.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] font-medium text-theme-muted">
            No contacts found
          </p>
        ) : (
          <ul className="max-h-56 divide-y divide-theme-border overflow-auto">
            {contacts.map((contact) => {
              const checked = selectedIds.includes(contact.id);
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => toggle(contact.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
                      checked
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/25'
                        : 'hover:bg-theme-subtle/60'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        checked
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-theme-border bg-theme-surface'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <ContactAvatar name={contact.name} phone={contact.phone} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-theme-fg">
                        {contact.name || 'Unnamed contact'}
                      </p>
                      <p className="truncate font-mono text-[11px] text-theme-secondary">
                        +{contact.phone}
                      </p>
                    </div>
                    {contact.tags?.length > 0 && (
                      <span className="hidden shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100 sm:inline dark:bg-violet-950/40 dark:text-violet-300">
                        {contact.tags[0]}
                        {contact.tags.length > 1 ? ` +${contact.tags.length - 1}` : ''}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-100 dark:bg-emerald-950/25 dark:ring-emerald-900/40">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
          <UserCheck className="h-3.5 w-3.5" />
          {messagingConsent.contactPickerNotice}
        </p>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          {selectedIds.length} selected
        </span>
      </div>
    </div>
  );
}
