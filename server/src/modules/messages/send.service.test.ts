import { describe, expect, it } from 'vitest';
import { toDbMessageType, isCswClosedError, CSW_CLOSED_CODE, META_CSW_ERROR_CODE } from './send.service';
import { AppError } from '../../utils/response';
import { MetaApiError } from '../whatsapp/meta.service';

describe('toDbMessageType', () => {
  it('maps all DeliverMessageType values to Prisma MessageType', () => {
    expect(toDbMessageType('TEXT')).toBe('TEXT');
    expect(toDbMessageType('TEMPLATE')).toBe('TEMPLATE');
    expect(toDbMessageType('INTERACTIVE')).toBe('INTERACTIVE');
    expect(toDbMessageType('IMAGE')).toBe('IMAGE');
    expect(toDbMessageType('DOCUMENT')).toBe('DOCUMENT');
    expect(toDbMessageType('VIDEO')).toBe('VIDEO');
    expect(toDbMessageType('AUDIO')).toBe('AUDIO');
    expect(toDbMessageType('LOCATION')).toBe('LOCATION');
    expect(toDbMessageType('CONTACTS')).toBe('CONTACTS');
  });

  it('defaults unknown types to TEXT', () => {
    expect(toDbMessageType('UNKNOWN' as never)).toBe('TEXT');
  });
});

describe('isCswClosedError', () => {
  it('detects AppError with CSW_CLOSED code', () => {
    const err = new AppError(400, 'CSW closed', CSW_CLOSED_CODE);
    expect(isCswClosedError(err)).toBe(true);
  });

  it('detects MetaApiError with code 131047', () => {
    const err = new MetaApiError('Message failed', { metaCode: 131047 });
    expect(isCswClosedError(err)).toBe(true);
  });

  it('detects Meta error code 131047 in error message', () => {
    const err = new Error('Message failed (#131047)');
    expect(isCswClosedError(err)).toBe(true);
  });

  it('returns false for non-CSW errors', () => {
    expect(isCswClosedError(new Error('random'))).toBe(false);
    expect(isCswClosedError(null)).toBe(false);
    expect(isCswClosedError(undefined)).toBe(false);
  });

  it('returns false for AppError with different code', () => {
    const err = new AppError(400, 'Other error', 'OTHER_CODE');
    expect(isCswClosedError(err)).toBe(false);
  });

  it('returns false for MetaApiError with different code', () => {
    const err = new MetaApiError('Other error', { metaCode: 12345 });
    expect(isCswClosedError(err)).toBe(false);
  });
});

describe('CSW enforcement constants', () => {
  it('uses the correct Meta error code for CSW violations', () => {
    expect(META_CSW_ERROR_CODE).toBe(131047);
  });

  it('has a string CSW_CLOSED_CODE', () => {
    expect(typeof CSW_CLOSED_CODE).toBe('string');
    expect(CSW_CLOSED_CODE.length).toBeGreaterThan(0);
  });
});
