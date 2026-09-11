import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const server = path.join(root, 'server');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runVitest(args, token) {
  const result = spawnSync('npm', ['test', '--', ...args, '--reporter=dot'], {
    cwd: server,
    encoding: 'utf8',
    env: process.env,
  });
  const out = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    throw new Error(out.slice(-2000) || `vitest exited ${result.status}`);
  }
  if (!/Tests\s+\d+\s+passed/.test(out)) {
    throw new Error(`vitest passed without a Tests N passed line:\n${out.slice(-500)}`);
  }
  console.log(token);
}

const mode = process.argv[2];

if (mode === '--inbox') {
  runVitest(['src/modules/messages/outbound-idempotency.test.ts'], 'packet-d-inbox-ok');
} else if (mode === '--meta') {
  runVitest(['src/modules/whatsapp/meta.service.send.test.ts'], 'packet-d-meta-ok');
} else if (mode === '--campaign') {
  runVitest(
    ['src/modules/campaigns/safety.test.ts', 'src/modules/messages/send-lease.test.ts'],
    'packet-d-campaign-ok'
  );
} else if (mode === '--wired') {
  const inboxApi = read('client/src/services/api.ts');
  if (!inboxApi.includes("Idempotency-Key")) {
    throw new Error('client api missing Idempotency-Key');
  }
  if (!/send:\s*\(id: string, payload[\s\S]*Idempotency-Key/.test(inboxApi) && !inboxApi.includes('idempotencyHeaders')) {
    throw new Error('inbox/campaign send must attach Idempotency-Key');
  }
  const inbox = read('server/src/modules/inbox/routes.ts');
  if (!inbox.includes('readIdempotencyKey') || !inbox.includes('idempotencyKey')) {
    throw new Error('inbox send route missing idempotency');
  }
  const direct = read('server/src/modules/messages/routes.ts');
  if (!direct.includes('readIdempotencyKey')) {
    throw new Error('messages /send missing idempotency');
  }
  const campaigns = read('server/src/modules/campaigns/routes.ts');
  if (!campaigns.includes('readIdempotencyKey')) {
    throw new Error('campaign /send missing idempotency');
  }
  const meta = read('server/src/modules/whatsapp/meta.service.ts');
  if (!meta.includes('AbortSignal') && !meta.includes('signal:')) {
    throw new Error('sendMessage missing AbortSignal');
  }
  const schema = read('server/prisma/schema.prisma');
  if (!schema.includes('idempotencyKey')) {
    throw new Error('Message.idempotencyKey missing from schema');
  }
  console.log('packet-d-wired-ok');
} else {
  throw new Error('usage: --inbox | --meta | --wired | --campaign');
}
