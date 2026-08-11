import { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { toastError } from '../../utils/toast';
import { parseContactImportFile } from '../../utils/contactImport';

interface CampaignPhoneCsvImportProps {
  onPhonesImported: (phones: string[]) => void;
}

export default function CampaignPhoneCsvImport({ onPhonesImported }: CampaignPhoneCsvImportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.json')) {
      toastError('Only CSV or JSON files are supported');
      return;
    }

    const text = await file.text();
    const preview = parseContactImportFile(text, file.name);
    setImportErrors(preview.errors);
    setImportedCount(preview.rows.length);
    if (!preview.rows.length) {
      toastError('No valid phone numbers found in file');
      return;
    }

    onPhonesImported(preview.rows.map((row) => row.phone));
    if (preview.errors.length) toastError(`${preview.errors.length} invalid row${preview.errors.length === 1 ? '' : 's'} skipped`);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Import phone numbers from CSV or JSON"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-4 text-center transition ${
        dragging
          ? 'border-sky-400 bg-sky-50/80 dark:border-sky-500 dark:bg-sky-950/30'
          : 'border-theme-border bg-theme-subtle/30 hover:border-theme-border-strong hover:bg-theme-subtle/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
        <Upload className="h-5 w-5" strokeWidth={2.25} />
      </div>
      <p className="mt-2.5 text-[13px] font-bold text-theme-fg">Import phone numbers</p>
      <p className="mt-1 text-[11px] font-medium text-theme-muted">
        Drop CSV or JSON here, or click to browse
      </p>
      <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-theme-muted">
        <FileSpreadsheet className="h-3 w-3" />
        Uses phone column from contact import format
      </p>
      {(importErrors.length > 0 || importedCount > 0) && (
        <div className="mt-3 text-left text-[11px]" aria-live="polite">
          {importedCount > 0 && (
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              Imported {importedCount} valid row{importedCount === 1 ? '' : 's'}
            </p>
          )}
          {importErrors.length > 0 && (
            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300" role="alert">
              <p className="font-bold">{importErrors.length} invalid row{importErrors.length === 1 ? '' : 's'} skipped</p>
              <ul className="mt-1 space-y-0.5">
                {importErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}
                {importErrors.length > 4 && <li>…and {importErrors.length - 4} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
