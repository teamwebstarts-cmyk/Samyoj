import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getCallRecordingTtlDays,
  purgeExpiredCallRecordings,
} from './media-retention.worker';

describe('getCallRecordingTtlDays', () => {
  const prev = process.env.CALL_RECORDING_TTL_DAYS;

  afterEach(() => {
    if (prev === undefined) delete process.env.CALL_RECORDING_TTL_DAYS;
    else process.env.CALL_RECORDING_TTL_DAYS = prev;
  });

  it('defaults to 7 days', () => {
    delete process.env.CALL_RECORDING_TTL_DAYS;
    expect(getCallRecordingTtlDays()).toBe(7);
  });

  it('reads a valid env override', () => {
    process.env.CALL_RECORDING_TTL_DAYS = '14';
    expect(getCallRecordingTtlDays()).toBe(14);
  });

  it('falls back to 7 for invalid values', () => {
    process.env.CALL_RECORDING_TTL_DAYS = '0';
    expect(getCallRecordingTtlDays()).toBe(7);
    process.env.CALL_RECORDING_TTL_DAYS = 'nope';
    expect(getCallRecordingTtlDays()).toBe(7);
  });
});

describe('purgeExpiredCallRecordings', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('deletes .pcm files older than TTL and keeps recent ones', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'call-rec-ttl-'));
    const oldFile = path.join(tmpDir, 'old-call.pcm');
    const freshFile = path.join(tmpDir, 'fresh-call.pcm');
    const otherFile = path.join(tmpDir, 'notes.txt');

    await fs.writeFile(oldFile, Buffer.alloc(8));
    await fs.writeFile(freshFile, Buffer.alloc(8));
    await fs.writeFile(otherFile, 'keep me');

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await fs.utimes(oldFile, eightDaysAgo, eightDaysAgo);

    const result = await purgeExpiredCallRecordings({
      uploadsDir: tmpDir,
      ttlDays: 7,
      now: new Date(),
    });

    expect(result.scanned).toBe(2);
    expect(result.deleted).toBe(1);
    await expect(fs.access(oldFile)).rejects.toThrow();
    await expect(fs.access(freshFile)).resolves.toBeUndefined();
    await expect(fs.access(otherFile)).resolves.toBeUndefined();
  });

  it('no-ops when uploads directory is missing', async () => {
    const result = await purgeExpiredCallRecordings({
      uploadsDir: path.join(os.tmpdir(), `missing-calls-${Date.now()}`),
      ttlDays: 7,
    });
    expect(result).toEqual({ scanned: 0, deleted: 0 });
  });
});
