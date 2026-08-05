import { describe, expect, it } from 'vitest';
import { classifyDocumentPreview } from './documentPreview';

describe('classifyDocumentPreview', () => {
  it('detects markdown by mime and extension', () => {
    expect(classifyDocumentPreview('02_BACKEND_SCHEMA.md', 'text/markdown')).toBe('text');
    expect(classifyDocumentPreview('notes.md', 'application/octet-stream')).toBe('text');
  });

  it('detects pdf', () => {
    expect(classifyDocumentPreview('invoice.pdf', 'application/pdf')).toBe('pdf');
  });

  it('detects image documents', () => {
    expect(classifyDocumentPreview('scan.png', 'image/png')).toBe('image');
  });

  it('falls back for office docs', () => {
    expect(
      classifyDocumentPreview(
        'report.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    ).toBe('unsupported');
  });
});
