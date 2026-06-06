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
import SlideOver from '../ui/SlideOver';
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
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');

  const resetState = useCallback(() => {
    setPreview(emptyPreview);
    setDragging(false);
    setImporting(false);
    setImportError('');
    setImportSuccess('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const processFile = async (file: File) => {
    setImportError('');
    setImportSuccess('');

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
    setImportError('');
    try {
      await onImport(preview.rows);
      setImportSuccess(`Successfully imported ${preview.rows.length} contact(s).`);
      setTimeout(() => {
        handleClose();
      }, 900);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || 'Import failed. Please try again.';
      setImportError(msg);
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
      subtitle="Download the template, fill in your customers, then upload the file."
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={importing}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200/80 bg-white px-4 text-[13px] font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canImport}
            onClick={() => void handleImport()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-4 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)] transition hover:from-whatsapp-600 hover:to-whatsapp-700 disabled:opacity-50"
          >
            {importing && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {!importing && <Upload className="h-4 w-4" strokeWidth={2.25} />}
            Import {preview.rows.length > 0 ? `${preview.rows.length} contacts` : 'contacts'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-500/10 to-blue-500/5 p-4">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-neutral-900">Step 1 — Download template</p>
              <p className="mt-1 text-[12px] font-medium text-neutral-600">
                Use the CSV template with sample rows. Phone must include country code without +.
              </p>
              <p className="mt-1 text-[11px] font-medium text-neutral-500">{PHONE_HINT}</p>
            </div>
            <AppButton
              variant="secondary"
              icon={<Download size={16} />}
              onClick={downloadContactImportTemplate}
              fullWidth
            >
              Download template
            </AppButton>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-[13px] font-extrabold text-neutral-900">Step 2 — Upload file</p>
            <p className="mt-1 text-[12px] font-medium text-neutral-600">
              Drag and drop your CSV or JSON file, or click to browse.
            </p>
          </div>

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
                ? 'border-sky-400 bg-sky-50/80'
                : 'border-neutral-200 bg-neutral-50/60 hover:border-sky-300 hover:bg-sky-50/40'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={CONTACT_IMPORT_ACCEPT}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm ring-1 ring-sky-100">
              <Upload className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <p className="mt-4 text-[13px] font-bold text-neutral-900">
              {dragging ? 'Drop file here' : 'Drag & drop your file here'}
            </p>
            <p className="mt-1 text-[12px] font-medium text-neutral-500">or click to choose CSV / JSON</p>
          </div>

          {preview.fileName && (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200/80 bg-white px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-neutral-900">{preview.fileName}</p>
                <p className="text-[11px] font-medium text-neutral-500">
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
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>

        {importError && <AppAlert variant="error">{importError}</AppAlert>}
        {importSuccess && <AppAlert variant="success">{importSuccess}</AppAlert>}

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
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-[13px] font-bold">Ready to import {preview.rows.length} contact(s)</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200/80">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-neutral-50 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {preview.rows.slice(0, 5).map((row: ContactImportRow) => (
                    <tr key={`${row.phone}-${row.name ?? ''}`}>
                      <td className="px-3 py-2 font-mono text-neutral-700">+{row.phone}</td>
                      <td className="px-3 py-2 text-neutral-800">{row.name || '—'}</td>
                      <td className="px-3 py-2 text-neutral-600">
                        {row.tags?.length ? row.tags.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 5 && (
                <p className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] font-medium text-neutral-500">
                  + {preview.rows.length - 5} more row(s) not shown
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </SlideOver>
  );
}
