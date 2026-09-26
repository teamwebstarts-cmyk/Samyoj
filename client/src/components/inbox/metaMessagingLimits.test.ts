import { describe, expect, it } from 'vitest';
import { metaOutboundKindForFile, validateMetaDmAttachment } from './metaMessagingLimits';

describe('metaMessagingLimits', () => {
  it('accepts jpeg within size cap', () => {
    const file = new File([new Uint8Array(1024)], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateMetaDmAttachment(file)).toEqual({ ok: true, kind: 'image' });
  });

  it('rejects unsupported office docs', () => {
    const file = new File([new Uint8Array(1024)], 'sheet.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(metaOutboundKindForFile(file)).toBeNull();
  });
});
