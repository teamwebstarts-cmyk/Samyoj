import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CornerDownLeft,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Send,
  Settings2,
  ShoppingBag,
  Target,
  UserPlus,
  Users,
  Search,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { contactApi, commerceApi, leadApi, ticketApi } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

type ResultType = 'contact' | 'ticket' | 'lead' | 'order' | 'page' | 'action';

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  href: string;
  /** Optional icon override (for action results). */
  Icon?: LucideIcon;
}

interface JumpLink {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  keywords: string[];
}

const TYPE_META: Record<
  ResultType,
  { icon: LucideIcon; label: string; group: string; accent: string }
> = {
  contact: {
    icon: Users,
    label: 'Contact',
    group: 'Contacts',
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
  },
  ticket: {
    icon: LifeBuoy,
    label: 'Ticket',
    group: 'Tickets',
    accent: 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
  },
  lead: {
    icon: Target,
    label: 'Lead',
    group: 'Leads',
    accent: 'bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
  },
  order: {
    icon: ShoppingBag,
    label: 'Order',
    group: 'Orders',
    accent: 'bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
  },
  page: {
    icon: LayoutDashboard,
    label: 'Page',
    group: 'Pages',
    accent: 'bg-neutral-100 text-neutral-700 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-700',
  },
  action: {
    icon: Zap,
    label: 'Action',
    group: 'Quick actions',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20',
  },
};

const JUMP_LINKS: JumpLink[] = [
  {
    id: 'inbox',
    title: 'Inbox',
    subtitle: 'Reply to customer chats',
    href: '/inbox',
    icon: MessageSquare,
    keywords: ['inbox', 'chat', 'message', 'conversation'],
  },
  {
    id: 'contacts',
    title: 'Contacts',
    subtitle: 'People you message on WhatsApp',
    href: '/contacts',
    icon: UserPlus,
    keywords: ['contact', 'contacts', 'people', 'phone'],
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    subtitle: 'Broadcasts and outreach',
    href: '/campaigns',
    icon: Send,
    keywords: ['campaign', 'campaigns', 'broadcast', 'send'],
  },
  {
    id: 'help',
    title: 'Help assistant',
    subtitle: 'How to use WhatsApp, Messenger, Instagram, and Email',
    href: '/help',
    icon: LifeBuoy,
    keywords: ['help', 'support assistant', 'help center', 'assistant'],
  },
  {
    id: 'tickets',
    title: 'Tickets',
    subtitle: 'WhatsApp chats that still need a reply',
    href: '/tickets',
    icon: LifeBuoy,
    keywords: ['ticket', 'tickets', 'support'],
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'WhatsApp connection and workspace',
    href: '/settings',
    icon: Settings2,
    keywords: ['settings', 'whatsapp', 'connect', 'webhook'],
  },
];

const RECENT_KEY = 'samyoj.globalSearch.recent';
const MAX_RECENT = 5;

function loadRecent(): SearchResult[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchResult[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(item: SearchResult) {
  try {
    const prev = loadRecent().filter((r) => !(r.type === item.type && r.id === item.id));
    localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...prev].slice(0, MAX_RECENT)));
  } catch {
    /* ignore quota / private mode */
  }
}

function useIsApplePlatform() {
  const [isApple, setIsApple] = useState(true);
  useEffect(() => {
    const ua = navigator.userAgent || '';
    const platform = (navigator as Navigator & { userAgentData?: { platform?: string } })
      .userAgentData?.platform;
    setIsApple(/Mac|iPhone|iPad|iPod/i.test(platform || navigator.platform || ua));
  }, []);
  return isApple;
}

function matchPages(q: string): SearchResult[] {
  const ql = q.trim().toLowerCase();
  if (!ql) return [];
  return JUMP_LINKS.filter(
    (j) =>
      j.title.toLowerCase().includes(ql) ||
      j.keywords.some((k) => k.includes(ql) || ql.includes(k))
  ).map((j) => ({
    id: j.id,
    type: 'page' as const,
    title: j.title,
    subtitle: j.subtitle,
    href: j.href,
  }));
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 250);
  const onCloseRef = useRef(onClose);
  const isApple = useIsApplePlatform();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setRecent(loadRecent());
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
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const pages = matchPages(q);
      const [contactsRes, ticketsRes, leadsRes, ordersRes] = await Promise.allSettled([
        contactApi.list({ search: q, limit: '6', page: '1' }),
        ticketApi.list(),
        leadApi.list(),
        commerceApi.orders({ limit: '50' }),
      ]);

      const found: SearchResult[] = [...pages];

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
          if (t.title.toLowerCase().includes(ql) || contact.toLowerCase().includes(ql)) {
            found.push({
              id: t.id,
              type: 'ticket',
              title: t.title,
              subtitle: contact || undefined,
              href: `/tickets?ticket=${t.id}`,
            });
          }
        }
      }

      if (leadsRes.status === 'fulfilled') {
        const ql = q.toLowerCase();
        for (const l of leadsRes.value.data.data.leads || []) {
          const contact = l.contact?.name || l.contact?.phone || '';
          if (l.title.toLowerCase().includes(ql) || contact.toLowerCase().includes(ql)) {
            found.push({
              id: l.id,
              type: 'lead',
              title: l.title,
              subtitle: contact || undefined,
              href: '/contacts?tab=pipeline',
            });
          }
        }
      }

      if (ordersRes.status === 'fulfilled') {
        const ql = q.toLowerCase();
        for (const o of ordersRes.value.data.data.orders || []) {
          const customer = o.contact?.name || o.contact?.phone || '';
          if (o.referenceId.toLowerCase().includes(ql) || customer.toLowerCase().includes(ql)) {
            found.push({
              id: o.id,
              type: 'order',
              title: o.referenceId,
              subtitle: customer || undefined,
              href: '/commerce',
            });
          }
        }
      }

      setResults(found.slice(0, 16));
      setActiveIndex(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void search(debouncedQuery);
  }, [debouncedQuery, open, search]);

  const emptyJumpItems: SearchResult[] = useMemo(
    () =>
      JUMP_LINKS.map((j) => ({
        id: j.id,
        type: 'page' as const,
        title: j.title,
        subtitle: j.subtitle,
        href: j.href,
      })),
    []
  );

  const grouped = useMemo(() => {
    if (query.trim()) {
      const order: ResultType[] = ['page', 'contact', 'ticket', 'lead', 'order'];
      return order
        .map((type) => ({
          type,
          label: TYPE_META[type].group,
          items: results.filter((r) => r.type === type),
        }))
        .filter((g) => g.items.length > 0);
    }
    const groups: Array<{ type: string; label: string; items: SearchResult[] }> = [];
    if (recent.length > 0) {
      groups.push({ type: 'recent', label: 'Recent', items: recent });
    }
    groups.push({ type: 'page', label: 'Jump to', items: emptyJumpItems });
    return groups;
  }, [query, results, recent, emptyJumpItems]);

  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, recent.length, results]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-search-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = (result: SearchResult) => {
    saveRecent(result);
    navigate(result.href);
    onClose();
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) handleSelect(item);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  let runningIndex = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[10vh] sm:pt-[12vh]"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/25 backdrop-blur-[2px] dark:bg-black/40"
        onClick={onClose}
        aria-label="Close search"
      />

      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-theme-border dark:bg-theme-surface dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-label="Search workspace"
      >
        <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3.5 dark:border-theme-border">
          <Search className="h-5 w-5 shrink-0 text-neutral-400" strokeWidth={2} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search contacts, tickets, leads, orders…"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-theme-fg dark:placeholder:text-theme-muted"
            aria-autocomplete="list"
            aria-controls="global-search-results"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-theme-subtle"
            >
              Clear
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-theme-subtle"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          id="global-search-results"
          ref={listRef}
          className="max-h-[min(52vh,420px)] overflow-y-auto px-2 py-2"
          role="listbox"
        >
          {loading && query.trim() && (
            <div className="space-y-2 px-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <div className="h-9 w-9 animate-pulse rounded-xl bg-neutral-100 dark:bg-theme-subtle" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100 dark:bg-theme-subtle" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-neutral-100 dark:bg-theme-subtle" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-[14px] font-bold text-neutral-900 dark:text-theme-fg">No results</p>
              <p className="mt-1 text-[12.5px] font-medium text-neutral-500 dark:text-theme-muted">
                Try a name, phone number, or ticket title.
              </p>
            </div>
          )}

          {!loading &&
            grouped.map((group) => (
              <div key={group.label} className="mb-1.5">
                <p className="px-3 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-neutral-400 dark:text-theme-muted">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((result) => {
                    runningIndex += 1;
                    const index = runningIndex;
                    const meta = TYPE_META[result.type];
                    const jump = JUMP_LINKS.find((j) => j.id === result.id && result.type === 'page');
                    const Icon = jump?.icon || meta.icon;
                    const active = index === activeIndex;

                    return (
                      <button
                        key={`${group.label}-${result.type}-${result.id}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        data-search-index={index}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => handleSelect(result)}
                        className={[
                          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                          active
                            ? 'bg-emerald-50/90 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20'
                            : 'hover:bg-neutral-50 dark:hover:bg-theme-subtle',
                        ].join(' ')}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.accent}`}
                        >
                          <Icon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-bold text-neutral-900 dark:text-theme-fg">
                            {result.title}
                          </span>
                          {result.subtitle ? (
                            <span className="mt-0.5 block truncate text-[12px] font-medium text-neutral-500 dark:text-theme-muted">
                              {result.type === 'page' || group.label === 'Recent'
                                ? result.subtitle
                                : `${meta.label} · ${result.subtitle}`}
                            </span>
                          ) : (
                            <span className="mt-0.5 block truncate text-[12px] font-medium text-neutral-400">
                              {meta.label}
                            </span>
                          )}
                        </span>
                        {active ? (
                          <span className="hidden items-center gap-1 text-[11px] font-semibold text-neutral-400 sm:inline-flex">
                            <CornerDownLeft className="h-3 w-3" />
                            Open
                          </span>
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-300 opacity-0 transition group-hover:opacity-100" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

          {!loading && !query.trim() && (
            <p className="px-3 pb-2 pt-1 text-[11.5px] font-medium text-neutral-400 dark:text-theme-muted">
              Tip: search a contact name or phone to jump straight into Inbox.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 px-4 py-2.5 dark:border-theme-border">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <kbd className="topbar-kbd topbar-kbd--key">↑</kbd>
              <kbd className="topbar-kbd topbar-kbd--key">↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="topbar-kbd topbar-kbd--key">↵</kbd>
              open
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-400">
            <kbd className={`topbar-kbd ${isApple ? 'topbar-kbd--mod' : 'topbar-kbd--ctrl'}`}>
              {isApple ? '⌘' : 'Ctrl'}
            </kbd>
            <kbd className="topbar-kbd topbar-kbd--key">K</kbd>
            <span>open</span>
            <span className="mx-1 text-neutral-300">·</span>
            <kbd className="topbar-kbd topbar-kbd--ctrl">Esc</kbd>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Hook to register global ⌘K / Ctrl+K shortcut */
export function useGlobalSearchShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
