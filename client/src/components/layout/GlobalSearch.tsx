import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { LifeBuoy, Search, ShoppingBag, Target, Users, X } from 'lucide-react';
import { contactApi, commerceApi, leadApi, ticketApi } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

interface SearchResult {
  id: string;
  type: 'contact' | 'ticket' | 'lead' | 'order';
  title: string;
  subtitle?: string;
  href: string;
}

const TYPE_META = {
  contact: { icon: Users, label: 'Contact' },
  ticket: { icon: LifeBuoy, label: 'Ticket' },
  lead: { icon: Target, label: 'Lead' },
  order: { icon: ShoppingBag, label: 'Order' },
};

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const [contactsRes, ticketsRes, leadsRes, ordersRes] = await Promise.allSettled([
        contactApi.list({ search: q, limit: '5', page: '1' }),
        ticketApi.list(),
        leadApi.list(),
        commerceApi.orders({ limit: '50' }),
      ]);

      const found: SearchResult[] = [];

      if (contactsRes.status === 'fulfilled') {
        for (const c of contactsRes.value.data.data.contacts || []) {
          found.push({
            id: c.id,
            type: 'contact',
            title: c.name || c.phone,
            subtitle: c.phone,
            href: c.conversation?.id ? `/inbox?conversation=${c.conversation.id}` : '/contacts',
          });
        }
      }

      if (ticketsRes.status === 'fulfilled') {
        const ql = q.toLowerCase();
        for (const t of ticketsRes.value.data.data.tickets || []) {
          const contact = t.contact?.name || t.contact?.phone || '';
          if (
            t.title.toLowerCase().includes(ql) ||
            contact.toLowerCase().includes(ql)
          ) {
            found.push({
              id: t.id,
              type: 'ticket',
              title: t.title,
              subtitle: contact,
              href: '/tickets',
            });
          }
        }
      }

      if (leadsRes.status === 'fulfilled') {
        const ql = q.toLowerCase();
        for (const l of leadsRes.value.data.data.leads || []) {
          const contact = l.contact?.name || l.contact?.phone || '';
          if (
            l.title.toLowerCase().includes(ql) ||
            contact.toLowerCase().includes(ql)
          ) {
            found.push({
              id: l.id,
              type: 'lead',
              title: l.title,
              subtitle: contact,
              href: '/contacts?tab=pipeline',
            });
          }
        }
      }

      if (ordersRes.status === 'fulfilled') {
        const ql = q.toLowerCase();
        for (const o of ordersRes.value.data.data.orders || []) {
          const customer = o.contact?.name || o.contact?.phone || '';
          if (
            o.referenceId.toLowerCase().includes(ql) ||
            customer.toLowerCase().includes(ql)
          ) {
            found.push({
              id: o.id,
              type: 'order',
              title: o.referenceId,
              subtitle: customer,
              href: '/commerce',
            });
          }
        }
      }

      setResults(found.slice(0, 12));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void search(debouncedQuery);
  }, [debouncedQuery, open, search]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.href);
    onClose();
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70"
        onClick={onClose}
        aria-label="Close search"
      />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
      >
        <div className="flex items-center gap-3 border-b border-theme-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-theme-muted" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts, tickets, leads, orders…"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-theme-fg outline-none placeholder:text-theme-muted"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-theme-muted hover:bg-theme-subtle"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading && (
            <p className="px-3 py-6 text-center text-[13px] text-theme-muted">Searching…</p>
          )}
          {!loading && !query.trim() && (
            <p className="px-3 py-6 text-center text-[13px] text-theme-muted">
              Type to search across your workspace
            </p>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-[13px] font-semibold text-theme-fg">No results found</p>
              <p className="mt-1 text-[12px] text-theme-muted">Try a different search word or check the spelling.</p>
            </div>
          )}
          {results.map((result) => {
            const meta = TYPE_META[result.type];
            const Icon = meta.icon;
            return (
              <button
                key={`${result.type}-${result.id}`}
                type="button"
                onClick={() => handleSelect(result)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-theme-subtle"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-subtle text-theme-secondary ring-1 ring-theme-border">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-theme-fg">
                    {result.title}
                  </span>
                  {result.subtitle && (
                    <span className="block truncate text-caption text-theme-muted">
                      {meta.label} · {result.subtitle}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-theme-border px-4 py-2 text-center text-micro text-theme-muted">
          <kbd className="rounded bg-theme-subtle px-1.5 py-0.5 font-mono">⌘K</kbd> to open ·{' '}
          <kbd className="rounded bg-theme-subtle px-1.5 py-0.5 font-mono">Esc</kbd> to close
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Hook to register global ⌘K / Ctrl+K shortcut */
export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
