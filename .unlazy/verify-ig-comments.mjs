import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const page = read('client/src/pages/InstagramCommentsPage.tsx');
const routes = read('server/src/modules/instagram/comments.routes.ts');
const ingest = read('server/src/modules/instagram/comment-ingest.ts');
const sync = read('server/src/modules/instagram/comment-sync.ts');
const pageClient = read('server/src/modules/facebook/page-client.ts');

if (!page.includes('const COMMENT_PAGE_SIZE = 25')) fail('comments page is not fixed at 25 per page');
if (!page.includes('Load older')) fail('Load older control is missing');
if (!page.includes('params.status')) fail('filters are not sent to the server');
if (page.includes('Showing 1 to {visible.length}')) fail('old single-page footer is still the list control');

const syncAt = routes.indexOf("'/sync'");
const idAt = routes.indexOf("'/:id/private-reply'");
if (syncAt < 0 || idAt < 0 || syncAt > idAt) fail('sync route is missing or registered after :id');
if (!routes.includes('skip: (page - 1) * pageSize')) fail('list query does not skip by page');
if (!routes.includes('COMMENT_PAGE_MAX')) fail('page size is not capped');

if (!ingest.includes('skipAutomation')) fail('history import can still auto-reply');
if (!ingest.includes("direction: 'OUTBOUND'")) fail('private reply is not written to Inbox');
if (!sync.includes('skipAutomation: true')) fail('sync does not disable auto-reply');
if (!pageClient.includes("subscribed_fields: 'messages,comments',")) {
  fail('comment subscribe is still tied to live_comments');
}

const container = spawnSync('docker', ['ps', '-q', '-f', 'name=postgres'], { encoding: 'utf8' });
const cid = (container.stdout || '').trim().split('\n').filter(Boolean)[0];
if (container.status !== 0 || !cid) fail('postgres container is not running');

const sql = spawnSync(
  'docker',
  [
    'exec',
    cid,
    'psql',
    '-U',
    'postgres',
    '-d',
    'whatsapp_platform',
    '-t',
    '-A',
    '-c',
    "SELECT count(*) FROM instagram_comments WHERE from_username IS NOT NULL AND lower(from_username) <> 'teamsamyoj';",
  ],
  { encoding: 'utf8' }
);
if (sql.status !== 0) fail(sql.stderr || 'comment count query failed');
const customerComments = Number((sql.stdout || '').trim());
if (!Number.isFinite(customerComments) || customerComments < 1) {
  fail('no customer comments stored');
}

const syncRoute = await fetch('http://localhost:8000/api/instagram/comments/sync', { method: 'POST' });
if (syncRoute.status === 404) fail('running API has no comment sync route');
if (syncRoute.status !== 401 && syncRoute.status !== 403) {
  fail('sync route returned ' + syncRoute.status + ' without a session');
}

console.log('customer comments ' + customerComments);
console.log('ig comment contract passed');
