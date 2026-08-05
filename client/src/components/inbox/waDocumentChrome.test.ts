import { describe, expect, it } from 'vitest';
import { resolveWaDocumentKind, waDocumentBadge } from './waDocumentChrome';

describe('waDocumentChrome', () => {
  it('maps Meta-supported document types by extension/mime', () => {
    expect(resolveWaDocumentKind('invoice.pdf', 'application/pdf')).toBe('pdf');
    expect(resolveWaDocumentKind('report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('word');
    expect(resolveWaDocumentKind('sheet.xlsx', null)).toBe('excel');
    expect(resolveWaDocumentKind('02_BACKEND_SCHEMA.md', 'text/markdown')).toBe('markdown');
    expect(waDocumentBadge('pdf')).toBe('PDF');
    expect(waDocumentBadge('markdown', 'x.md')).toBe('MD');
  });
});
