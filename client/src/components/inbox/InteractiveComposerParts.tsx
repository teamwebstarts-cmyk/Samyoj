import { memo, useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, List, MousePointerClick, Phone, Plus, Ticket, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppInput from '../ui/AppInput';
import { WhatsAppInteractivePreview } from './WhatsAppPreview';
import type { InteractiveComposerMode } from './InteractiveComposerTypes';

export type { InteractiveComposerMode };

export const LIMITS = {
  header: 60,
  body: 1024,
  footer: 60,
  buttonTitle: 20,
  maxButtons: 3,
  listButtonLabel: 20,
  sectionTitle: 24,
  rowTitle: 24,
  rowDescription: 72,
  maxSections: 10,
  maxTotalRows: 10,
  ctaLabel: 20,
  couponCode: 15,
} as const;

export type ListSection = {
  title: string;
  rows: Array<{ id: string; title: string; description: string }>;
};

export const MODES: Array<{
  id: InteractiveComposerMode;
  label: string;
  short: string;
  icon: typeof MousePointerClick;
  hint: string;
}> = [
  {
    id: 'reply',
    label: 'Buttons',
    short: 'Buttons',
    icon: MousePointerClick,
    hint: 'Up to 3 quick replies',
  },
  {
    id: 'list',
    label: 'List',
    short: 'List',
    icon: List,
    hint: 'Up to 10 rows',
  },
  {
    id: 'cta_url',
    label: 'URL',
    short: 'URL',
    icon: ExternalLink,
    hint: 'Open https link',
  },
  {
    id: 'cta_call',
    label: 'Call',
    short: 'Call',
    icon: Phone,
    hint: 'Dial a number',
  },
  {
    id: 'copy_code',
    label: 'Copy code',
    short: 'Code',
    icon: Copy,
    hint: 'Offer / coupon template',
  },
];

export const COMPACT_INPUT = '!h-9 text-[13px]';
export const COMPACT_LABEL = 'text-[11px] font-semibold text-theme-secondary';

export function charHint(value: string, max: number) {
  return `${value.length}/${max}`;
}

export function emptyListSection(index: number): ListSection {
  return {
    title: index === 0 ? 'Options' : `Section ${index + 1}`,
    rows: [{ id: `row_${index}_1`, title: 'Option 1', description: '' }],
  };
}

type TypeSwitcherProps = {
  mode: InteractiveComposerMode;
  onModeChange: (mode: InteractiveComposerMode) => void;
  /** @deprecated use `size="compact"` */
  compact?: boolean;
  size?: 'compact' | 'default' | 'form' | 'header';
  className?: string;
};

export function InteractiveTypeSwitcher({
  mode,
  onModeChange,
  compact = false,
  size,
  className = '',
}: TypeSwitcherProps) {
  const resolvedSize = size === 'header' ? 'form' : (size ?? (compact ? 'compact' : 'default'));

  const containerClass =
    resolvedSize === 'form'
      ? 'gap-1 rounded-xl p-1 bg-violet-50/80 ring-violet-200/70 dark:bg-violet-950/35 dark:ring-violet-800/45'
      : 'gap-0.5 rounded-xl p-0.5 bg-white/70 ring-violet-200/60 dark:bg-neutral-900/60 dark:ring-violet-800/50';

  const buttonClass = (selected: boolean) => {
    if (resolvedSize === 'form') {
      return `inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 ${
        selected
          ? 'bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-sm ring-1 ring-violet-500/30'
          : 'text-violet-700 hover:bg-white/80 dark:text-violet-200 dark:hover:bg-violet-900/35'
      }`;
    }
    if (resolvedSize === 'compact') {
      return `inline-flex shrink-0 items-center gap-1 rounded-[10px] px-1.5 py-0.5 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 ${
        selected
          ? 'bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-sm ring-1 ring-violet-500/30'
          : 'text-violet-700 hover:bg-violet-50/80 dark:text-violet-200 dark:hover:bg-violet-900/35'
      }`;
    }
    return `inline-flex shrink-0 items-center gap-1 rounded-[10px] px-2 py-1 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 ${
      selected
        ? 'bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-sm ring-1 ring-violet-500/30'
        : 'text-violet-700 hover:bg-violet-50/80 dark:text-violet-200 dark:hover:bg-violet-900/35'
    }`;
  };

  const iconClass =
    resolvedSize === 'form' ? 'h-3.5 w-3.5' : resolvedSize === 'compact' ? 'h-2.5 w-2.5' : 'h-3 w-3';

  const labelClass =
    resolvedSize === 'form' ? 'inline' : resolvedSize === 'compact' ? 'hidden min-[400px]:inline' : 'hidden sm:inline';

  const shortClass =
    resolvedSize === 'form' ? 'hidden' : resolvedSize === 'compact' ? 'min-[400px]:hidden' : 'sm:hidden';

  return (
    <div
      className={`inline-flex shrink-0 items-center backdrop-blur-md ring-1 ${containerClass} ${className}`}
      role="tablist"
      aria-label="Interactive message type"
    >
      {MODES.map((entry) => {
        const Icon = entry.icon;
        const selected = mode === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onModeChange(entry.id)}
            title={entry.hint}
            className={buttonClass(selected)}
          >
            <Icon className={iconClass} strokeWidth={2.25} aria-hidden />
            <span className={labelClass}>{entry.label}</span>
            <span className={shortClass}>{entry.short}</span>
          </button>
        );
      })}
    </div>
  );
}

type ListRowProps = {
  rowKey: string;
  rowIndex: number;
  title: string;
  description: string;
  showRowDescriptions: boolean;
  canRemove: boolean;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onRemove: () => void;
};

export const InteractiveListRow = memo(function InteractiveListRow({
  rowKey,
  rowIndex,
  title,
  description,
  showRowDescriptions,
  canRemove,
  onTitleChange,
  onDescriptionChange,
  onRemove,
}: ListRowProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [localDescription, setLocalDescription] = useState(description);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    setLocalDescription(description);
  }, [description]);

  return (
    <div
      key={rowKey}
      className={`grid gap-1.5 ${
        showRowDescriptions ? 'sm:grid-cols-[1fr_1fr_auto]' : 'sm:grid-cols-[1fr_auto]'
      }`}
    >
      <AppInput
        label={showRowDescriptions ? 'Title' : `Row ${rowIndex + 1}`}
        hint={charHint(localTitle, LIMITS.rowTitle)}
        value={localTitle}
        onChange={(e) => {
          const next = e.target.value.slice(0, LIMITS.rowTitle);
          setLocalTitle(next);
          onTitleChange(next);
        }}
        className={COMPACT_INPUT}
        labelClassName={COMPACT_LABEL}
      />
      {showRowDescriptions && (
        <AppInput
          label="Description"
          hint={charHint(localDescription, LIMITS.rowDescription)}
          value={localDescription}
          onChange={(e) => {
            const next = e.target.value.slice(0, LIMITS.rowDescription);
            setLocalDescription(next);
            onDescriptionChange(next);
          }}
          className={COMPACT_INPUT}
          labelClassName={COMPACT_LABEL}
        />
      )}
      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="mb-0.5 self-end rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          aria-label={`Remove row ${rowIndex + 1}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
    </div>
  );
});

type ListSectionProps = {
  sectionIndex: number;
  section: ListSection;
  totalRows: number;
  canRemoveSection: boolean;
  showRowDescriptions: boolean;
  onSectionTitleChange: (title: string) => void;
  onAddRow: () => void;
  onRemoveSection: () => void;
  onRowTitleChange: (rowIndex: number, title: string) => void;
  onRowDescriptionChange: (rowIndex: number, description: string) => void;
  onRemoveRow: (rowIndex: number) => void;
};

export const InteractiveListSection = memo(function InteractiveListSection({
  sectionIndex,
  section,
  totalRows,
  canRemoveSection,
  showRowDescriptions,
  onSectionTitleChange,
  onAddRow,
  onRemoveSection,
  onRowTitleChange,
  onRemoveRow,
  onRowDescriptionChange,
}: ListSectionProps) {
  return (
    <div className="rounded-xl border border-violet-200/50 bg-white/60 p-2.5 shadow-sm backdrop-blur-sm dark:border-violet-800/40 dark:bg-violet-950/25">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">
          Section {sectionIndex + 1}
        </span>
        <div className="flex items-center gap-1">
          {totalRows < LIMITS.maxTotalRows && (
            <button
              type="button"
              onClick={onAddRow}
              className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-violet-700 hover:bg-violet-50 dark:text-violet-300"
            >
              <Plus className="h-3 w-3" />
              Row
            </button>
          )}
          {canRemoveSection && (
            <button
              type="button"
              onClick={onRemoveSection}
              className="rounded-md p-1 text-neutral-400 hover:text-red-600"
              aria-label={`Remove section ${sectionIndex + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <AppInput
        label="Section title"
        hint={charHint(section.title || '', LIMITS.sectionTitle)}
        value={section.title || ''}
        onChange={(e) => onSectionTitleChange(e.target.value.slice(0, LIMITS.sectionTitle))}
        className={COMPACT_INPUT}
        labelClassName={COMPACT_LABEL}
      />

      <div className="mt-1.5 space-y-1.5">
        {section.rows.map((row, rowIndex) => (
          <InteractiveListRow
            key={row.id}
            rowKey={row.id}
            rowIndex={rowIndex}
            title={row.title}
            description={row.description || ''}
            showRowDescriptions={showRowDescriptions}
            canRemove={section.rows.length > 1}
            onTitleChange={(t) => onRowTitleChange(rowIndex, t)}
            onDescriptionChange={(d) => onRowDescriptionChange(rowIndex, d)}
            onRemove={() => onRemoveRow(rowIndex)}
          />
        ))}
      </div>
    </div>
  );
});

export type PreviewModel = {
  mode: InteractiveComposerMode;
  header?: string;
  body: string;
  footer?: string;
  buttons: Array<{ id: string; title: string }>;
  ctaLabel: string;
  listButtonLabel: string;
  listSections: ListSection[];
  couponCode?: string;
};

export const MemoizedInteractivePreview = memo(function MemoizedInteractivePreview({
  model,
}: {
  model: PreviewModel;
}) {
  return (
    <WhatsAppInteractivePreview
      mode={model.mode}
      header={model.header}
      body={model.body}
      footer={model.footer}
      buttons={model.buttons}
      ctaLabel={model.ctaLabel}
      listButtonLabel={model.listButtonLabel}
      listSections={model.listSections}
      couponCode={model.couponCode}
      compact
      direction="outbound"
      showSurface={false}
    />
  );
});

export function CopyCodeEmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-violet-200/40 bg-white/50 px-4 py-5 text-center shadow-sm backdrop-blur-md dark:border-violet-800/35 dark:bg-violet-950/20">
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600 ring-1 ring-violet-200/70 dark:from-violet-900/55 dark:to-violet-950/35 dark:text-violet-300 dark:ring-violet-800/45">
        <Ticket className="h-5 w-5" strokeWidth={2} />
      </div>
      <p className="text-[13px] font-bold text-theme-fg">No copy-code templates yet</p>
      <p className="mt-1 max-w-[260px] text-[12px] leading-snug text-theme-secondary">
        Create an approved template with a copy-code button to send offers outside the 24-hour window.
      </p>
      <Link
        to="/templates"
        className="mt-3 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-violet-700 transition hover:bg-violet-100/80 dark:text-violet-300 dark:hover:bg-violet-900/40"
      >
        Go to Templates
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

/** Hook: stable section callbacks keyed by section index */
export function useListSectionHandlers(
  sectionIndex: number,
  setListSections: React.Dispatch<React.SetStateAction<ListSection[]>>
) {
  const onSectionTitleChange = useCallback(
    (title: string) => {
      setListSections((prev) =>
        prev.map((entry, idx) => (idx === sectionIndex ? { ...entry, title } : entry))
      );
    },
    [sectionIndex, setListSections]
  );

  const onAddRow = useCallback(() => {
    setListSections((prev) =>
      prev.map((entry, idx) => {
        if (idx !== sectionIndex) return entry;
        const n = entry.rows.length + 1;
        return {
          ...entry,
          rows: [
            ...entry.rows,
            { id: `row_${sectionIndex}_${n}_${Date.now()}`, title: `Option ${n}`, description: '' },
          ],
        };
      })
    );
  }, [sectionIndex, setListSections]);

  const onRemoveSection = useCallback(() => {
    setListSections((prev) => prev.filter((_, idx) => idx !== sectionIndex));
  }, [sectionIndex, setListSections]);

  const onRowTitleChange = useCallback(
    (rowIndex: number, title: string) => {
      setListSections((prev) =>
        prev.map((entry, idx) => {
          if (idx !== sectionIndex) return entry;
          const rows = [...entry.rows];
          rows[rowIndex] = { ...rows[rowIndex], title };
          return { ...entry, rows };
        })
      );
    },
    [sectionIndex, setListSections]
  );

  const onRowDescriptionChange = useCallback(
    (rowIndex: number, description: string) => {
      setListSections((prev) =>
        prev.map((entry, idx) => {
          if (idx !== sectionIndex) return entry;
          const rows = [...entry.rows];
          rows[rowIndex] = { ...rows[rowIndex], description };
          return { ...entry, rows };
        })
      );
    },
    [sectionIndex, setListSections]
  );

  const onRemoveRow = useCallback(
    (rowIndex: number) => {
      setListSections((prev) =>
        prev.map((entry, idx) => {
          if (idx !== sectionIndex) return entry;
          return { ...entry, rows: entry.rows.filter((_, rIdx) => rIdx !== rowIndex) };
        })
      );
    },
    [sectionIndex, setListSections]
  );

  return {
    onSectionTitleChange,
    onAddRow,
    onRemoveSection,
    onRowTitleChange,
    onRowDescriptionChange,
    onRemoveRow,
  };
}

export function ListSectionBlock({
  sectionIndex,
  section,
  totalRows,
  listSectionsLength,
  showRowDescriptions,
  setListSections,
}: {
  sectionIndex: number;
  section: ListSection;
  totalRows: number;
  listSectionsLength: number;
  showRowDescriptions: boolean;
  setListSections: React.Dispatch<React.SetStateAction<ListSection[]>>;
}) {
  const handlers = useListSectionHandlers(sectionIndex, setListSections);
  return (
    <InteractiveListSection
      sectionIndex={sectionIndex}
      section={section}
      totalRows={totalRows}
      canRemoveSection={listSectionsLength > 1}
      showRowDescriptions={showRowDescriptions}
      {...handlers}
    />
  );
}
