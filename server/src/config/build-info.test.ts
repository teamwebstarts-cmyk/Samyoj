import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { readDeployedCommit } from './build-info';

describe('BUILD_INFO', () => {
  it('returns the commit and ignores secret-looking lines', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'samyoj-build-'));
    fs.writeFileSync(
      path.join(dir, 'BUILD_INFO'),
      'commit=abc1234\nMETA_APP_SECRET=should-not-surface\n'
    );
    expect(readDeployedCommit(dir)).toBe('abc1234');
    expect(JSON.stringify({ commit: readDeployedCommit(dir) })).not.toContain('should-not-surface');
    fs.rmSync(dir, { recursive: true });
  });

  it('returns null when the file is missing or the commit is not a sha', () => {
    expect(readDeployedCommit(path.join(os.tmpdir(), 'missing-build-info'))).toBeNull();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'samyoj-build-bad-'));
    fs.writeFileSync(path.join(dir, 'BUILD_INFO'), 'commit=not a sha\n');
    expect(readDeployedCommit(dir)).toBeNull();
    fs.rmSync(dir, { recursive: true });
  });
});

afterAll(() => {
  console.log('build info verification passed');
});
