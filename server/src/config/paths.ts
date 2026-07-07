import path from 'path';
import fs from 'fs';

/** Paths to the Vite client package (build output: client/dist). */
export function getClientPaths() {
  const serverRoot = path.resolve(__dirname, '../..');
  const repoRoot = path.resolve(serverRoot, '..');
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
