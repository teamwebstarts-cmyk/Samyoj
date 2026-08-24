import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import SearchInput from '../ui/SearchInput';
import { contactApi } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Contact } from '../../types';
import Pagination from '../ui/Pagination';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { ContactOptInBadge } from '../contacts/contactUi';
import { messagingConsent } from '../../utils/plainLanguage';

interface CampaignContactPickerProps {
  variant?: 'default' | 'wizard';
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

const avatarTones = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
] as const;

function ContactAvatar({ name, phone }: { name?: string; phone: string }) {
  const initial = (name || phone).charAt(0).toUpperCase();
  const tone = avatarTones[(name || phone).charCodeAt(0) % avatarTones.length];
  return (
    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${tone} text-[10px] font-extrabold text-white shadow-sm`}>
      {initial}
    </div>
  );
}

export default function CampaignContactPicker({
  variant = 'default',
  selectedIds,
  onChange,
}: CampaignContactPickerProps) {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const compact = variant === 'wizard';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showSelected, setShowSelected] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const requestGenerationRef = useRef(0);

  const load = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    const generation = ++requestGenerationRef.current;
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '10' };
    if (debouncedSearch) params.search = debouncedSearch;
    if (eligibleOnly) params.optedIn = 'true';

    contactApi
      .list(params)
      .then(({ data }) => {
        if (
          requestNumberId !== activeNumberIdRef.current ||
          generation !== requestGenerationRef.current
        ) return;
        const next = data.data.contacts as Contact[];
        setContacts(next);
        setTotal(data.data.total ?? next.length);
        setError(null);
      })
      .catch(() => {
        if (
          requestNumberId !== activeNumberIdRef.current ||
          generation !== requestGenerationRef.current
        ) return;
        setContacts([]);
        setTotal(0);
        setError('Could not load contacts. Refresh this section and try again.');
      })
      .finally(() => {
        if (
          requestNumberId === activeNumberIdRef.current &&
          generation === requestGenerationRef.current
        ) {
          setLoading(false);
        }
      });
  }, [activeNumber, debouncedSearch, eligibleOnly, page, resolved]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, eligibleOnly]);

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
    <div className={`campaign-contact-picker ${compact ? 'space-y-2.5' : 'space-y-3'}`}>
      <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-medium leading-relaxed text-theme-secondary`}>
        {messagingConsent.contactPickerNotice}
      </p>
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search contacts"
        compact={compact}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={showSelected}
            onClick={() => setShowSelected((value) => !value)}
            className={`${compact ? 'min-h-8 px-2 text-[9px]' : 'min-h-11 px-2.5 text-[11px]'} rounded-lg border border-theme-border py-1.5 font-bold text-theme-secondary transition hover:bg-theme-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500/40`}
          >
            {showSelected ? 'Show all contacts' : 'Show selected'}
          </button>
          <button
            type="button"
            aria-pressed={eligibleOnly}
            onClick={() => setEligibleOnly((value) => !value)}
            className={`${compact ? 'min-h-8 px-2 text-[9px]' : 'min-h-11 px-2.5 text-[11px]'} rounded-lg border py-1.5 font-bold transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
              eligibleOnly
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-theme-border text-theme-secondary hover:bg-theme-subtle'
            }`}
          >
            Only subscribed contacts
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={!selectedIds.length}
            className={`${compact ? 'min-h-8 px-2 text-[9px]' : 'min-h-11 px-2.5 text-[11px]'} rounded-lg border border-theme-border py-1.5 font-bold text-theme-secondary transition hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40`}
          >
            Clear selection
          </button>
        </div>
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={!visibleContacts.length}
          className={`${compact ? 'min-h-8 px-2 text-[9px]' : 'min-h-11 px-2.5 text-[11px]'} rounded-lg border border-indigo-200 py-1.5 font-bold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/30`}
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
            {showSelected
              ? 'No selected contacts on this page'
              : eligibleOnly
                ? 'No people who get campaign messages match this search.'
                : 'No contacts found. Try a different search.'}
          </p>
        ) : (
          <ul className={`${compact ? 'max-h-44' : 'max-h-56'} divide-y divide-theme-border overflow-auto`}>
            {visibleContacts.map((contact) => {
              const checked = selectedIds.includes(contact.id);
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    onClick={() => toggle(contact.id)}
                    aria-checked={checked}
                    role="checkbox"
                    className={`${compact ? 'min-h-9 gap-2 px-2.5 py-1.5' : 'min-h-11 gap-3 px-3 py-2.5'} flex w-full items-center text-left transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/40 ${
                      checked
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/25'
                        : 'hover:bg-theme-subtle/60'
                    }`}
                  >
                    <span
                        className={`flex ${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 items-center justify-center rounded-md border transition ${
                        checked
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-theme-border bg-theme-surface'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <ContactAvatar name={contact.name} phone={contact.phone} />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${compact ? 'text-[10px]' : 'text-[13px]'} font-semibold text-theme-fg`}>
                        {contact.name || 'Unnamed contact'}
                      </p>
                      <p className={`truncate font-mono ${compact ? 'text-[9px]' : 'text-[11px]'} text-theme-secondary`}>
                        +{contact.phone}
                      </p>
                    </div>
                    <ContactOptInBadge contact={contact} compact={compact} />
                    {contact.tags?.length > 0 && (
                      <span className={`hidden shrink-0 rounded-full bg-violet-50 px-2 py-0.5 ${compact ? 'text-[8px]' : 'text-[10px]'} font-bold text-violet-700 ring-1 ring-violet-100 sm:inline dark:bg-violet-950/40 dark:text-violet-300`}>
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

      <div className="flex items-center justify-end rounded-lg bg-emerald-50/70 px-2.5 py-2 ring-1 ring-emerald-100 dark:bg-emerald-950/25 dark:ring-emerald-900/40">
        <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} rounded-full bg-emerald-100 px-2 py-0.5 font-extrabold tabular-nums text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300`}>
          {selectedIds.length} selected
        </span>
      </div>
    </div>
  );
}
