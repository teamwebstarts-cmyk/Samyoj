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

if (mode === '--auth') {
  runVitest(['src/middleware/auth.test.ts', '-t', 'requireAdminOnMutation|api-key is not an org role'], 'packet-b-auth-ok');
} else if (mode === '--media') {
  runVitest(['src/modules/media/public.routes.test.ts', 'src/modules/media/storage-adapter.test.ts'], 'packet-b-media-ok');
} else if (mode === '--isolation') {
  runVitest(['src/modules/whatsapp/active-number.test.ts'], 'packet-b-isolation-ok');
} else if (mode === '--wired') {
  const studio = read('server/src/modules/content-studio/routes.ts');
  if (!studio.includes('requireAdminOnMutation')) {
    throw new Error('content-studio parent router missing requireAdminOnMutation');
  }
  const forms = read('server/src/modules/wa-forms/routes.ts');
  if (!forms.includes('requireAdminOnMutation')) {
    throw new Error('wa-forms missing requireAdminOnMutation');
  }
  const onboarding = read('server/src/modules/onboarding/routes.ts');
  if (!onboarding.includes('requireAdminOnMutation')) {
    throw new Error('onboarding missing requireAdminOnMutation');
  }
  if (!onboarding.includes('ALLOWED_ONBOARDING_STEPS')) {
    throw new Error('onboarding missing stepId allowlist');
  }
  const settings = read('server/src/modules/settings/routes.ts');
  const hours = settings.slice(settings.indexOf("'/business-hours'"), settings.indexOf("'/ai'"));
  if (!hours.includes('adminGuard') && !hours.includes('requireOrgRole')) {
    throw new Error('PATCH /business-hours still missing admin role guard');
  }
  const media = read('server/src/modules/media/public.routes.ts');
  if (media.includes("Cache-Control', 'public")) {
    throw new Error('public media still advertises Cache-Control public');
  }
  if (!media.includes('isValidPublicMediaSig')) {
    throw new Error('public media missing signature check');
  }
  const send = read('server/src/modules/messages/send.service.ts');
  if (!send.includes(".split('?')[0]")) {
    throw new Error('send.service must strip signed query before local media fetch');
  }
  console.log('packet-b-wired-ok');
} else {
  throw new Error('usage: --auth | --media | --wired | --isolation');
}
