import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Copy,
  CopyPlus,
  Eye,
  Info,
  Library,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { platformRequest } from "../api";
import {
  Button,
  Drawer,
  EmptyState,
  Input,
  Notice,
  PageHeader,
  PageLoading,
  ResponsiveDataView,
  Select,
  StatusBadge,
} from "../components/ui";
import {
  PREVIEW_COLUMN,
  TemplatePreviewBlock,
} from "../components/WhatsAppPreview";
import { formatAgo } from "../lib/format";
import { useOperator } from "../context/OperatorContext";
import {
  CATEGORY_AVATAR,
  HONESTY,
  iconFor,
  rowToDraft,
  titleCaseCategory,
  type LibraryRow,
} from "../lib/library-catalog";

function TemplateAvatar({ row }: { row: LibraryRow }) {
  const Icon = iconFor(row);
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${
        CATEGORY_AVATAR[row.category] ??
        "bg-gradient-to-br from-slate-500 to-slate-600"
      }`}
      aria-hidden
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}

/** Newest activity first — rows without timestamps sort last, stably. */
const updatedAtMs = (row: LibraryRow) =>
  row.updatedAt ? Date.parse(row.updatedAt) || 0 : 0;

/** View opens the WhatsApp preview drawer; Edit redirects to the editor page; ⋮ menu holds the rest. */
function RowActions({
  row,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  menuOpen,
  setMenuOpen,
  canWrite,
}: {
  row: LibraryRow;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  canWrite: boolean;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null); // portal root ONLY — never share with inline nodes
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const stop = (fn: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    fn();
  };

  // Fixed position from the trigger, flipped up near the viewport bottom, so the
  // menu escapes the table card's overflow-hidden/overflow-x-auto clipping.
  const measure = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Hidden elements report a zero-size rect — measuring those would portal the
    // menu off-screen (left: -176). Bail; the scroll/resize effect re-measures.
    if (!r.width && !r.height) return;
    const MENU_W = 176;
    const menuH = 120; // approximate: 3 items; only used for the flip decision
    const openUp =
      r.bottom + menuH > window.innerHeight - 8 && r.top - menuH > 8;
    setPos({
      top: Math.max(
        8,
        Math.min(
          openUp ? r.top - menuH - 4 : r.bottom + 4,
          window.innerHeight - menuH - 8,
        ),
      ),
      left: Math.max(
        8,
        Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8),
      ),
    });
  };

  // Measured synchronously in the toggle handler — no rAF wait — so backgrounded
  // tabs and fast double-clicks still get a positioned menu on the first commit.
  useEffect(() => {
    if (!menuOpen) return;
    const onScrollOrResize = () => measure();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trigger is stable per row
  }, [menuOpen]);

  const toggleMenu = () => {
    if (!menuOpen) measure();
    setMenuOpen(!menuOpen);
  };

  const copySlug = () => {
    void navigator.clipboard?.writeText(row.slug).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // Outside-close. Only the instance whose portal is actually rendered (pos set)
  // may close the menu: the page renders RowActions twice per row (card + table,
  // one hidden via CSS), and both share the same open state. The hidden twin has
  // pos === null → no portal → menuRef.current === null → its guard fails, so its
  // listener would close the shared menu on every mousedown, even on menu items
  // ("menu flashes and closes before the click lands").
  useEffect(() => {
    if (!menuOpen || !pos) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return; // trigger toggles itself
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, setMenuOpen]);

  const menuItem = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    tone: "default" | "danger" = "default",
  ) => (
    <button
      type="button"
      role="menuitem"
      onClick={stop(onClick)}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
        tone === "danger"
          ? "text-rose-700 hover:bg-rose-50"
          : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className="flex shrink-0 items-center justify-end gap-1.5"
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        variant="secondary"
        size="sm"
        onClick={stop(onView)}
        aria-label={`View ${row.title}`}
      >
        <Eye className="h-3.5 w-3.5" /> View
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={stop(onEdit)}
        aria-label={`Edit ${row.title}`}
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
      <div className="relative">
        <span ref={triggerRef} className="inline-flex">
          <Button
            variant="secondary"
            size="sm"
            className="w-8 px-0"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`More actions for ${row.title}`}
            onClick={stop(toggleMenu)}
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>
      {menuOpen && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${row.title}`}
              className="fixed z-50 w-44 rounded-xl border border-slate-200/80 bg-white p-1 shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              {menuItem(
                "Duplicate",
                <CopyPlus className="h-3.5 w-3.5" />,
                onDuplicate,
              )}
              {menuItem(
                "Copy slug",
                copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                ),
                copySlug,
              )}
              {canWrite ? (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  {menuItem(
                    "Delete",
                    <Trash2 className="h-3.5 w-3.5" />,
                    onDelete,
                    "danger",
                  )}
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

type CatalogTab = "all" | "published" | "drafts";

const TABS: Array<{ id: CatalogTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "drafts", label: "Drafts" },
];

export function TemplateCatalogPage() {
  const navigate = useNavigate();
  const { allowed } = useOperator();
  const canWrite = allowed("organization.write");
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<CatalogTab>("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");

  const load = () => {
    platformRequest<{ templates: LibraryRow[] }>("/library-templates")
      .then((data) => setRows(data.templates || []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load"),
      );
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads on mount
  }, []);

  const counts = useMemo(() => {
    const all = rows || [];
    return {
      all: all.length,
      published: all.filter((row) => row.published).length,
      drafts: all.filter((row) => !row.published).length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    // Rows are bilingual (one identity, two surfaces) — there is no language filter;
    // search matches both bodies. Newest activity first.
    return (rows || [])
      .filter((row) => {
        if (tab === "published" && !row.published) return false;
        if (tab === "drafts" && row.published) return false;
        if (category !== "ALL" && row.category !== category) return false;
        if (!term) return true;
        const haystack =
          `${row.title} ${row.slug} ${row.copy || ""} ${(row.tags || []).join(" ")} ${row.body} ${row.bodyHi}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => updatedAtMs(b) - updatedAtMs(a));
  }, [rows, tab, q, category]);

  /** Custom (non-builtin) categories currently in use — filter options follow the data. */
  const customCategories = useMemo(
    () =>
      [...new Set((rows || []).map((row) => row.category))].filter(
        (value) =>
          value && !["UTILITY", "MARKETING", "AUTHENTICATION"].includes(value),
      ),
    [rows],
  );

  const openCreate = () => navigate("/library/new");
  const openEdit = (row: LibraryRow) => navigate(`/library/${row.id}/edit`);
  const [viewing, setViewing] = useState<LibraryRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const closeMenu = () => setOpenMenuId(null);

  const duplicateRow = (row: LibraryRow) => {
    closeMenu();
    // Real API: no clone endpoint yet — prefilled editor as a new draft (SAMYOJ-11 Graph clone pending).
    navigate("/library/new", { state: { cloneFrom: row } });
  };

  const deleteRow = async (row: LibraryRow) => {
    closeMenu();
    await platformRequest(`/library-templates/${row.id}`, {
      method: "DELETE",
      body: JSON.stringify({
        reason: `Deleted library template "${row.slug}" from platform catalog`,
      }),
    });
    load();
  };

  if (error) {
    return (
      <Notice tone="error">Could not load the template library. {error}</Notice>
    );
  }
  if (!rows) return <PageLoading label="Loading Samyoj template library…" />;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Templates"
        purpose="Publish WhatsApp drafts that tenants pick in Template Library, then submit to their own number."
        titleExtra={
          <span
            className="group relative inline-flex shrink-0 cursor-help rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
            tabIndex={0}
            role="note"
            aria-label="How the platform catalog works"
          >
            <Info
              className="h-[18px] w-[18px] text-slate-400 transition-colors group-hover:text-indigo-600 group-focus-visible:text-indigo-600"
              aria-hidden
            />
            <span className="pointer-events-none invisible absolute left-1/2 top-7 z-30 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 text-left text-[13px] font-normal leading-relaxed text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100">
              {HONESTY}
            </span>
          </span>
        }
        action={
          canWrite ? (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Add template
            </Button>
          ) : undefined
        }
      />

      <div className="dashboard-card overflow-hidden">
        {/* Search + filters — status and category are both selects */}
        <div className="flex flex-col gap-3 border-b border-slate-200/80 px-4 py-3 sm:flex-row sm:items-center">
          <div className="flex-1 sm:max-w-sm">
            <Input
              icon={Search}
              placeholder="Search templates…"
              aria-label="Search templates"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <Select
            aria-label="Filter by status"
            className="sm:w-40"
            value={tab}
            onChange={(event) => setTab(event.target.value as CatalogTab)}
          >
            {TABS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label} ({counts[id]})
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by category"
            className="sm:w-44"
            value={
              category === "ALL" || customCategories.includes(category)
                ? category
                : category === "UTILITY" ||
                    category === "MARKETING" ||
                    category === "AUTHENTICATION"
                  ? category
                  : "ALL"
            }
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="ALL">All categories</option>
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
            {/* Custom categories appear only when at least one row uses them. */}
            {customCategories.map((value) => (
              <option key={value} value={value}>
                {titleCaseCategory(value)}
              </option>
            ))}
          </Select>
        </div>

        <ResponsiveDataView
          tableFrom="lg"
          cardsClassName="data-list"
          items={filtered}
          emptyState={
            rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Library}
                  title="No library templates yet"
                  description="Add a draft here and publish it. Tenants will see it in Template Library."
                />
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={Search}
                  title="No templates found"
                  description="No templates match your current search, status, or category filter."
                />
              </div>
            )
          }
          renderCard={(row) => (
            <div className="px-4 py-3 sm:px-5">
              {/* Whole card body opens the preview drawer, same as the View button.
                  Footer actions stay outside so nested buttons remain valid HTML. */}
              <button
                type="button"
                onClick={() => setViewing(row)}
                aria-label={`View ${row.title}`}
                className="block w-full cursor-pointer text-left"
              >
                <div className="flex items-start gap-3">
                  <TemplateAvatar row={row} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">
                      {row.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {row.copy || row.body}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.category} />
                  <StatusBadge
                    status={row.published ? "ACTIVE" : "DISABLED"}
                    label={row.published ? "Published" : "Draft"}
                  />
                  <span className="ml-auto text-[11px] text-slate-400">
                    {formatAgo(row.updatedAt)}
                  </span>
                </div>
              </button>
              <div className="mt-2.5 border-t border-slate-200/80 pt-2.5">
                <RowActions
                  row={row}
                  onView={() => setViewing(row)}
                  onEdit={() => openEdit(row)}
                  onDuplicate={() => duplicateRow(row)}
                  onDelete={() => void deleteRow(row)}
                  menuOpen={openMenuId === row.id}
                  canWrite={canWrite}
                  setMenuOpen={(open) =>
                    open ? setOpenMenuId(row.id) : closeMenu()
                  }
                />
              </div>
            </div>
          )}
          renderTable={() => (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setViewing(row)}
                      className="cursor-pointer"
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <TemplateAvatar row={row} />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">
                              {row.title}
                            </p>
                            <p className="mt-0.5 max-w-md truncate text-xs text-slate-500">
                              {row.copy || row.body || row.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={row.category} />
                      </td>
                      <td>
                        <StatusBadge
                          status={row.published ? "ACTIVE" : "DISABLED"}
                          label={row.published ? "Published" : "Draft"}
                        />
                      </td>
                      <td className="text-xs text-slate-600">
                        {formatAgo(row.updatedAt)}
                      </td>
                      <td className="text-right">
                        <RowActions
                          row={row}
                          onView={() => setViewing(row)}
                          onEdit={() => openEdit(row)}
                          onDuplicate={() => duplicateRow(row)}
                          onDelete={() => void deleteRow(row)}
                          menuOpen={openMenuId === row.id}
                          canWrite={canWrite}
                          setMenuOpen={(open) =>
                            open ? setOpenMenuId(row.id) : closeMenu()
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        />

        {filtered.length > 0 && (
          <div className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-2.5 text-[11px] font-medium text-slate-500">
            Showing {filtered.length} of {rows.length} templates
          </div>
        )}
      </div>

      <Drawer
        open={Boolean(viewing)}
        title={viewing?.title || "Preview"}
        onClose={() => setViewing(null)}
        fit
      >
        {viewing ? (
          <div className="space-y-3">
            {/* Same block as the editor aside: header card + EN/HI lens + phone + details table */}
            <TemplatePreviewBlock draft={rowToDraft(viewing)} />
            {canWrite ? (
              <Button
                className={PREVIEW_COLUMN}
                onClick={() => {
                  const target = viewing;
                  setViewing(null);
                  openEdit(target);
                }}
              >
                <Pencil className="h-4 w-4" /> Edit this template
              </Button>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
