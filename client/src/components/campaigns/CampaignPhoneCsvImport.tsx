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

  const handleFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.json')) {
      toastError('Only CSV or JSON files are supported');
      return;
    }

    const text = await file.text();
    const preview = parseContactImportFile(text, file.name);
    if (preview.errors.length) {
      toastError(preview.errors.join('\n'));
      return;
    }
    if (!preview.rows.length) {
      toastError('No valid phone numbers found in file');
      return;
    }

    onPhonesImported(preview.rows.map((row) => row.phone));
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
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`cursor-pointer rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${
        dragging
          ? 'border-sky-400 bg-sky-50/80 dark:border-sky-500 dark:bg-sky-950/30'
          : 'border-theme-border bg-theme-surface/50 hover:border-sky-300/70 hover:bg-sky-50/40 dark:hover:border-sky-700/50 dark:hover:bg-sky-950/20'
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
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.28)]">
        <Upload className="h-5 w-5" strokeWidth={2.25} />
      </div>
      <p className="mt-3 text-[13px] font-extrabold text-theme-fg">Import phone numbers</p>
      <p className="mt-1 text-[11px] font-medium text-theme-muted">
        Drop CSV or JSON here, or click to browse
      </p>
      <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-theme-muted">
        <FileSpreadsheet className="h-3 w-3" />
        Uses phone column from contact import format
      </p>
    </div>
  );
}
