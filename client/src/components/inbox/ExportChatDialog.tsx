import { useEffect, useRef, useState } from 'react';
import { Download, FileJson, FileText, Loader2 } from 'lucide-react';
import InboxModal from './InboxModal';
import { inboxApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import { FOCUS_RING_CLASS, useAutoFocus } from '../../hooks/inboxA11y';

interface ExportChatDialogProps {
  open: boolean;
  conversationId: string;
  contactName: string;
  onClose: () => void;
}

type ExportFormat = 'txt' | 'json';

function filenameFromHeaders(headers: unknown, fallback: string): string {
  const disposition = (headers as Record<string, string | undefined>)?.['content-disposition'];
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/** Downloads the full transcript via GET /inbox/:id/export as an attachment. */
export default function ExportChatDialog({
  open,
  conversationId,
  contactName,
  onClose,
}: ExportChatDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [exporting, setExporting] = useState(false);
  const firstFormatRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) setFormat('txt');
  }, [open]);
  // Auto-focus the first format option (txt) when the dialog opens.
  useAutoFocus(firstFormatRef, open);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await inboxApi.exportChat(conversationId, format);
      const blob =
        res.data instanceof Blob
          ? res.data
          : new Blob([res.data], {
              type: format === 'json' ? 'application/json' : 'text/plain',
            });
      const filename = filenameFromHeaders(res.headers, `chat-export.${format}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toastSuccess('Chat exported');
      onClose();
    } catch {
      toastError('Could not export this chat');
    } finally {
      setExporting(false);
    }
  };

  const options: Array<{
    value: ExportFormat;
    label: string;
    description: string;
    icon: typeof FileText;
  }> = [
    {
      value: 'txt',
      label: 'Text transcript (.txt)',
      description: 'WhatsApp-style lines with timestamps and senders',
      icon: FileText,
    },
    {
      value: 'json',
      label: 'JSON (.json)',
      description: 'Structured conversation and message data',
      icon: FileJson,
    },
  ];

  return (
    <InboxModal
      open={open}
      onClose={onClose}
      title="Export chat"
      subtitle={contactName}
      icon={Download}
      iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
    >
      <div className="space-y-2">
        {options.map((option, idx) => (
          <button
            key={option.value}
            ref={idx === 0 ? firstFormatRef : null}
            type="button"
            onClick={() => setFormat(option.value)}
            aria-pressed={format === option.value}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${FOCUS_RING_CLASS} ${
              format === option.value
                ? 'border-sky-500/60 bg-sky-50/70 dark:bg-sky-950/30'
                : 'border-theme-border hover:bg-theme-subtle'
            }`}
          >
            <option.icon
              className={`h-4 w-4 shrink-0 ${format === option.value ? 'text-sky-600' : 'text-theme-muted'}`}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-theme-fg">{option.label}</span>
              <span className="block truncate text-[11px] text-theme-muted">
                {option.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={exporting}
        className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2.5 text-[13px] font-bold text-white transition hover:bg-sky-700 disabled:opacity-60 ${FOCUS_RING_CLASS}`}
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {exporting ? 'Preparing…' : 'Download'}
      </button>
    </InboxModal>
  );
}
