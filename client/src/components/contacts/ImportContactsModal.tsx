import { useCallback, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  X,
} from 'lucide-react';
import AppAlert from '../ui/AppAlert';
import AppButton from '../ui/AppButton';
import { ModalCallout, ModalPanel, ModalSection } from '../ui/modalUi';
import SlideOver from '../ui/SlideOver';
import { toastError, toastSuccess } from '../../utils/toast';
import { messagingConsent } from '../../utils/plainLanguage';
import {
  CONTACT_IMPORT_ACCEPT,
  downloadContactImportTemplate,
  parseContactImportFile,
  type ContactImportPreview,
  type ContactImportRow,
} from '../../utils/contactImport';
import { PHONE_HINT } from '../../utils/phone';

interface ImportContactsModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: ContactImportRow[]) => Promise<void>;
}

const emptyPreview: ContactImportPreview = { rows: [], errors: [] };

export default function ImportContactsModal({ open, onClose, onImport }: ImportContactsModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ContactImportPreview>(emptyPreview);
  const [importing, setImporting] = useState(false);

  const resetState = useCallback(() => {
    setPreview(emptyPreview);
    setDragging(false);
    setImporting(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.json')) {
      setPreview({ rows: [], errors: ['Only CSV or JSON files are supported'], fileName: file.name });
      return;
    }

    const text = await file.text();
    setPreview(parseContactImportFile(text, file.name));
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    void processFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleImport = async () => {
    if (!preview.rows.length || preview.errors.length) return;

    setImporting(true);
    try {
      await onImport(preview.rows);
      toastSuccess(`Successfully imported ${preview.rows.length} contact(s).`);
      handleClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Import failed. Please try again.';
      toastError(msg);
    } finally {
      setImporting(false);
    }
  };

  const canImport = preview.rows.length > 0 && preview.errors.length === 0 && !importing;

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title="Import contacts"
      subtitle="Upload a CSV or JSON file with your customer list"
      size="lg"
      icon={Upload}
      accent="violet"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={handleClose}
            disabled={importing}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </AppButton>
          <AppButton
            onClick={() => void handleImport()}
            loading={importing}
            disabled={!canImport}
            icon={<Upload size={16} />}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            Import{preview.rows.length > 0 ? ` ${preview.rows.length} contacts` : ' contacts'}
          </AppButton>
        </div>
      }
    >
      <div className="space-y-5">
        <ModalCallout
          icon={CheckCircle2}
          accent="violet"
          title="Before you import"
          description={messagingConsent.importNotice}
        />

        <ModalSection
          step={1}
          title="Download template"
          subtitle={`Use international format with country code. ${PHONE_HINT}`}
        >
          <ModalPanel title="CSV template" accent="violet">
            <div className="space-y-3">
              <p className="text-[12px] font-medium text-theme-secondary">
                Columns: <span className="font-semibold text-theme-fg">phone</span>, name, tags (optional)
              </p>
              <AppButton
                variant="secondary"
                icon={<Download size={16} />}
                onClick={downloadContactImportTemplate}
                fullWidth
              >
                Download CSV template
              </AppButton>
            </div>
          </ModalPanel>
        </ModalSection>

        <ModalSection step={2} title="Upload file" subtitle="Drag and drop or click to browse">
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (e.currentTarget === e.target) setDragging(false);
            }}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging
                ? 'border-sky-400 bg-sky-50/80 dark:border-sky-500/50 dark:bg-sky-950/30'
                : 'border-theme-border bg-theme-subtle/50 hover:border-sky-300 hover:bg-sky-50/40 dark:hover:border-sky-700/50 dark:hover:bg-sky-950/20'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={CONTACT_IMPORT_ACCEPT}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-theme-surface text-sky-600 shadow-sm ring-1 ring-sky-200/60 dark:text-sky-400 dark:ring-sky-800/40">
              <Upload className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <p className="mt-4 text-[13px] font-bold text-theme-fg">
              {dragging ? 'Drop file here' : 'Drag & drop your file here'}
            </p>
            <p className="mt-1 text-[12px] font-medium text-theme-muted">
              CSV / JSON only · Max 1 file
            </p>
          </div>

          {preview.fileName && (
            <div className="flex items-center gap-3 rounded-xl border border-theme-border bg-theme-surface px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-theme-fg">{preview.fileName}</p>
                <p className="text-[11px] font-medium text-theme-muted">
                  {preview.rows.length} valid row(s)
                  {preview.errors.length ? ` · ${preview.errors.length} error(s)` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetState();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-theme-muted transition hover:bg-theme-subtle hover:text-theme-fg"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </ModalSection>

        {preview.errors.length > 0 && (
          <AppAlert variant="error">
            <div>
              <p className="font-bold">Fix these issues before importing</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-left text-[12px] font-medium">
                {preview.errors.map((error: string) => (
                  <li key={error} className="flex gap-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AppAlert>
        )}

        {preview.rows.length > 0 && preview.errors.length === 0 && (
          <ModalSection title="Preview" subtitle={`${preview.rows.length} contact(s) ready to import`}>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-[13px] font-bold">File validated successfully</p>
            </div>

            <ModalPanel title="Sample rows" accent="violet">
              <div className="overflow-hidden rounded-2xl border border-theme-border">
                <table className="min-w-full text-left text-[12px]">
                  <thead className="bg-theme-subtle text-[10px] font-bold uppercase tracking-wide text-theme-muted">
                    <tr>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-border">
                    {preview.rows.slice(0, 5).map((row: ContactImportRow) => (
                      <tr key={`${row.phone}-${row.name ?? ''}`}>
                        <td className="px-3 py-2 font-mono text-theme-secondary">+{row.phone}</td>
                        <td className="px-3 py-2 text-theme-fg">{row.name || '—'}</td>
                        <td className="px-3 py-2 text-theme-secondary">
                          {row.tags?.length ? row.tags.join(', ') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 5 && (
                  <p className="border-t border-theme-border bg-theme-subtle px-3 py-2 text-[11px] font-medium text-theme-muted">
                    + {preview.rows.length - 5} more row(s) not shown
                  </p>
                )}
              </div>
            </ModalPanel>
          </ModalSection>
        )}
      </div>
    </SlideOver>
  );
}
