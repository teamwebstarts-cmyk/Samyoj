import fs from 'fs';
import path from 'path';

export function readDeployedCommit(cwd = process.cwd()): string | null {
  try {
    const text = fs.readFileSync(path.join(cwd, 'BUILD_INFO'), 'utf8');
    const line = text.split('\n').find((row) => row.startsWith('commit='));
    const commit = line?.slice('commit='.length).trim() ?? '';
    if (!/^[0-9a-f]{7,64}$/i.test(commit)) return null;
    return commit;
  } catch {
    return null;
  }
}
