/** How MediaViewer should render a DOCUMENT (or mis-typed media). */

export type DocumentPreviewKind = 'pdf' | 'text' | 'image' | 'audio' | 'unsupported';

const TEXT_EXT = new Set([
  'md',
  'markdown',
  'txt',
  'csv',
  'tsv',
  'json',
  'xml',
  'yml',
  'yaml',
  'log',
  'html',
  'htm',
  'css',
  'js',
  'ts',
  'tsx',
  'jsx',
  'sql',
  'env',
  'sh',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
]);

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg']);

function extOf(filename?: string | null): string {
  if (!filename) return '';
  const i = filename.lastIndexOf('.');
  if (i < 0) return '';
  return filename.slice(i + 1).toLowerCase();
}

export function classifyDocumentPreview(
  filename?: string | null,
  mimeType?: string | null
): DocumentPreviewKind {
  const mime = (mimeType || '').split(';')[0].trim().toLowerCase();
  const ext = extOf(filename);

  if (mime.startsWith('image/') || IMAGE_EXT.has(ext)) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/javascript' ||
    mime === 'application/x-javascript' ||
    mime === 'application/sql' ||
    TEXT_EXT.has(ext)
  ) {
    return 'text';
  }
  return 'unsupported';
}
