import path from 'path';
import fs from 'fs';

/** Walk up from `start` to the repo root (dir containing both `server` and `client`). */
function findRepoRoot(start: string): string {
  let dir = start;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fs.existsSync(path.join(dir, 'client')) && fs.existsSync(path.join(dir, 'server'))) {
      return dir;
    }
    const parent = path.resolve(dir, '..');
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  return path.resolve(start, '../../..');
}

/** Paths to the Vite client package (build output: client/dist). */
export function getClientPaths() {
  const repoRoot = findRepoRoot(__dirname);
  const clientRoot = path.join(repoRoot, 'client');
  return {
    clientRoot,
    clientDist: path.join(clientRoot, 'dist'),
    clientPublic: path.join(clientRoot, 'public'),
  };
}

export function clientBuildExists(): boolean {
  const { clientDist } = getClientPaths();
  return fs.existsSync(path.join(clientDist, 'index.html'));
}

/** Paths to the operator admin Vite package (build output: admin/dist). */
export function getAdminPaths() {
  const repoRoot = findRepoRoot(__dirname);
  const adminRoot = path.join(repoRoot, 'admin');
  return {
    adminRoot,
    adminDist: path.join(adminRoot, 'dist'),
    adminPublic: path.join(adminRoot, 'public'),
  };
}

export function adminBuildExists(): boolean {
  const { adminDist } = getAdminPaths();
  return fs.existsSync(path.join(adminDist, 'index.html'));
}
