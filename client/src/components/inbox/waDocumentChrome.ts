/**
 * WhatsApp-style document chrome.
 * Meta picks icons from filename extension on the client; we mirror that in Inbox.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/messages/document-messages/
 */

export type WaDocumentKind =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'text'
  | 'markdown'
  | 'generic';

export function resolveWaDocumentKind(
  filename?: string | null,
  mimeType?: string | null
): WaDocumentKind {
  const name = (filename || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';

  if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
  if (
    mime.includes('word') ||
    mime.includes('msword') ||
    ext === 'doc' ||
    ext === 'docx'
  ) {
    return 'word';
  }
  if (
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    ext === 'xls' ||
    ext === 'xlsx' ||
    ext === 'csv'
  ) {
    return 'excel';
  }
  if (
    mime.includes('powerpoint') ||
    mime.includes('presentation') ||
    ext === 'ppt' ||
    ext === 'pptx'
  ) {
    return 'powerpoint';
  }
  if (ext === 'md' || ext === 'markdown' || mime.includes('markdown')) return 'markdown';
  if (mime.startsWith('text/') || ext === 'txt' || ext === 'log') return 'text';
  return 'generic';
}

/** Short badge like WhatsApp’s file-type chip (PDF, DOC, XLS…). */
export function waDocumentBadge(kind: WaDocumentKind, filename?: string | null): string {
  if (kind === 'pdf') return 'PDF';
  if (kind === 'word') return 'DOC';
  if (kind === 'excel') return 'XLS';
  if (kind === 'powerpoint') return 'PPT';
  if (kind === 'markdown') return 'MD';
  if (kind === 'text') return 'TXT';
  const ext = (filename || '').split('.').pop();
  return (ext || 'FILE').toUpperCase().slice(0, 4);
}

export function waDocumentTone(kind: WaDocumentKind): string {
  switch (kind) {
    case 'pdf':
      return 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300';
    case 'word':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
    case 'excel':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
    case 'powerpoint':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300';
    case 'markdown':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300';
    case 'text':
      return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';
    default:
      return 'bg-chat-bubble-received text-chat-accent';
  }
}
