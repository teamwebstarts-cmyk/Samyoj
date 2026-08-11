import { validatePhone } from './phone';

export interface ContactImportRow {
  phone: string;
  name?: string;
  tags?: string[];
  notes?: string;
}

export interface ContactImportPreview {
  rows: ContactImportRow[];
  errors: string[];
  fileName?: string;
}

const TEMPLATE_HEADERS = ['phone', 'name', 'tags', 'notes'] as const;

const TEMPLATE_SAMPLE_ROWS = [
  ['919876543210', 'John Doe', 'vip,lead', 'Optional notes'],
  ['14155552671', 'Jane Smith', '', ''],
];

export const CONTACT_IMPORT_TEMPLATE_FILENAME = 'contacts-import-template.csv';

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildContactImportTemplateCsv(): string {
  const lines = [
    TEMPLATE_HEADERS.join(','),
    ...TEMPLATE_SAMPLE_ROWS.map((row) => row.map(escapeCsvValue).join(',')),
  ];
  return `${lines.join('\n')}\n`;
}

export function downloadContactImportTemplate(): void {
  const csv = buildContactImportTemplateCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = CONTACT_IMPORT_TEMPLATE_FILENAME;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((value) => value.replace(/^"|"$/g, '').trim());
}

function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function describeImportValue(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `"${trimmed}"` : '(empty)';
}

function parseCsvContacts(text: string): ContactImportPreview {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { rows: [], errors: ['File is empty'] };
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader);
  const hasHeader = headerCells.includes('phone');
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const phoneIndex = hasHeader ? headerCells.indexOf('phone') : 0;
  const nameIndex = hasHeader ? headerCells.indexOf('name') : 1;
  const tagsIndex = hasHeader ? headerCells.indexOf('tags') : 2;
  const notesIndex = hasHeader ? headerCells.indexOf('notes') : 3;

  const rows: ContactImportRow[] = [];
  const errors: string[] = [];

  dataLines.forEach((line, index) => {
    const rowNumber = hasHeader ? index + 2 : index + 1;
    const cells = parseCsvLine(line);
    const phoneRaw = cells[phoneIndex >= 0 ? phoneIndex : 0] ?? cells[0] ?? '';
    const nameRaw = nameIndex >= 0 ? cells[nameIndex] : cells[1];
    const tagsRaw = tagsIndex >= 0 ? cells[tagsIndex] : cells[2];
    const notesRaw = notesIndex >= 0 ? cells[notesIndex] : cells[3];

    if (!phoneRaw && !nameRaw && !tagsRaw && !notesRaw) return;

    const phoneResult = validatePhone(phoneRaw);
    if (!phoneResult.ok) {
      errors.push(`Row ${rowNumber}: value ${describeImportValue(phoneRaw)} — ${phoneResult.error}`);
      return;
    }

    rows.push({
      phone: phoneResult.phone,
      name: nameRaw || undefined,
      tags: parseTags(tagsRaw),
      notes: notesRaw || undefined,
    });
  });

  if (!rows.length && !errors.length) {
    errors.push('No valid contact rows found in file');
  }

  return { rows, errors };
}

function parseJsonContacts(text: string): ContactImportPreview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], errors: ['Invalid JSON file'] };
  }

  if (!Array.isArray(parsed)) {
    return { rows: [], errors: ['JSON must be an array of contacts'] };
  }

  const rows: ContactImportRow[] = [];
  const errors: string[] = [];

  parsed.forEach((item, index) => {
    const rowNumber = index + 1;
    if (!item || typeof item !== 'object') {
      errors.push(`Row ${rowNumber}: Invalid contact object`);
      return;
    }

    const record = item as Record<string, unknown>;
    const phoneRaw = String(record.phone ?? '');
    const phoneResult = validatePhone(phoneRaw);
    if (!phoneResult.ok) {
      errors.push(`Row ${rowNumber}: value ${describeImportValue(phoneRaw)} — ${phoneResult.error}`);
      return;
    }

    const tags = Array.isArray(record.tags)
      ? record.tags.map(String).filter(Boolean)
      : typeof record.tags === 'string'
        ? parseTags(record.tags)
        : [];

    rows.push({
      phone: phoneResult.phone,
      name: record.name ? String(record.name) : undefined,
      tags,
      notes: record.notes ? String(record.notes) : undefined,
    });
  });

  if (!rows.length && !errors.length) {
    errors.push('No valid contact rows found in file');
  }

  return { rows, errors };
}

export function parseContactImportFile(text: string, fileName: string): ContactImportPreview {
  const lowerName = fileName.toLowerCase();
  const preview =
    lowerName.endsWith('.json') ? parseJsonContacts(text) : parseCsvContacts(text);

  return { ...preview, fileName };
}

export const CONTACT_IMPORT_ACCEPT = '.csv,.json,text/csv,application/json';
