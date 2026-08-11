import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import { contactApi } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Contact } from '../../types';
import Pagination from '../ui/Pagination';

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
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showSelected, setShowSelected] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '10' };
    if (debouncedSearch) params.search = debouncedSearch;

    contactApi
      .list(params)
      .then(({ data }) => {
        const next = data.data.contacts as Contact[];
        setContacts(next);
        setTotal(data.data.total ?? next.length);
        setError(null);
      })
      .catch(() => {
        setContacts([]);
        setTotal(0);
        setError('Could not load contacts. Refresh this section and try again.');
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const visibleContacts = useMemo(
    () => (showSelected ? contacts.filter((contact) => selectedIds.includes(contact.id)) : contacts),
    [contacts, selectedIds, showSelected],
  );

  const selectAllVisible = () => {
    const visibleIds = visibleContacts.map((contact) => contact.id);
    const next = new Set(selectedIds);
    visibleIds.forEach((id) => next.add(id));
    onChange([...next]);
  };

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
        placeholder="Search contacts"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={showSelected}
            onClick={() => setShowSelected((value) => !value)}
            className="min-h-11 rounded-lg border border-theme-border px-2.5 py-1.5 text-[11px] font-bold text-theme-secondary transition hover:bg-theme-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            {showSelected ? 'Show all contacts' : 'Show selected'}
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={!selectedIds.length}
            className="min-h-11 rounded-lg border border-theme-border px-2.5 py-1.5 text-[11px] font-bold text-theme-secondary transition hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            Clear selection
          </button>
        </div>
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={!visibleContacts.length}
          className="min-h-11 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
        >
          Select all visible
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-theme-border bg-theme-surface">
        {loading ? (
          <p className="px-4 py-8 text-center text-[12px] font-medium text-theme-muted">
            Loading contacts…
          </p>
        ) : error ? (
          <p className="px-4 py-8 text-center text-[12px] font-medium text-amber-700 dark:text-amber-300" role="alert">{error}</p>
        ) : visibleContacts.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] font-medium text-theme-muted">
            {showSelected ? 'No selected contacts on this page' : 'No contacts found. Try a different search.'}
          </p>
        ) : (
          <ul className="max-h-56 divide-y divide-theme-border overflow-auto">
            {visibleContacts.map((contact) => {
              const checked = selectedIds.includes(contact.id);
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => toggle(contact.id)}
                    aria-checked={checked}
                    role="checkbox"
                    className={`min-h-11 flex w-full items-center gap-3 px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/40 ${
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
      {!showSelected && <Pagination page={page} pageSize={10} total={total} onPageChange={setPage} itemLabel="contacts" />}

      <div className="flex items-center justify-end rounded-xl bg-emerald-50/70 px-3 py-2.5 ring-1 ring-emerald-100 dark:bg-emerald-950/25 dark:ring-emerald-900/40">
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          {selectedIds.length} selected
        </span>
      </div>
    </div>
  );
}
