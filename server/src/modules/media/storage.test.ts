import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./storage-adapter', () => ({
  fetchMediaBuffer: vi.fn(),
  mediaExists: vi.fn(),
  persistMediaBuffer: vi.fn(),
}));

import { getMediaAbsolutePath } from './storage';
import path from 'path';

describe('getMediaAbsolutePath', () => {
  const uploadRoot = path.join(process.cwd(), 'uploads', 'media');

  it('resolves a simple orgId/filename path', () => {
    const result = getMediaAbsolutePath('org-1/file.jpg');
    expect(result).toBe(path.resolve(uploadRoot, 'org-1/file.jpg'));
  });

  it('resolves nested paths without traversal', () => {
    const result = getMediaAbsolutePath('org-1/sub/file.png');
    expect(result).toBe(path.resolve(uploadRoot, 'org-1/sub/file.png'));
  });

  it('throws on path traversal with ../', () => {
    expect(() => getMediaAbsolutePath('../../etc/passwd')).toThrow(/Invalid media path/);
  });

  it('throws on encoded traversal', () => {
    // path.resolve normalizes, so this still escapes
    expect(() => getMediaAbsolutePath('org-1/../../../etc/passwd')).toThrow(
      /Invalid media path/
    );
  });

  it('allows paths that resolve within upload root after normalization', () => {
    // org-1/../org-2/file.jpg normalizes to org-2/file.jpg which is still under upload root
    const result = getMediaAbsolutePath('org-1/../org-2/file.jpg');
    expect(result).toBe(path.resolve(uploadRoot, 'org-2/file.jpg'));
  });

  it('rejects absolute paths that escape root', () => {
    expect(() => getMediaAbsolutePath('/etc/passwd')).toThrow(/Invalid media path/);
  });
});
