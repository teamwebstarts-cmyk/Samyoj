import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');

function run(label, cwd, command, args) {
  const result = spawnSync(command, args, {
    cwd: path.join(root, cwd),
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    process.stderr.write(`${label} failed\n${result.stdout || ''}${result.stderr || ''}`);
    process.exit(result.status || 1);
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

run('prisma generate', 'server', 'npx', ['prisma', 'generate']);
run('server leftover tests', 'server', 'npx', [
  'vitest',
  'run',
  'src/modules/automation/inbound-pipeline.test.ts',
  'src/modules/ai/chat-completion.service.test.ts',
  'src/modules/whatsapp/provider-status.test.ts',
  'src/modules/integrations/dispatch.test.ts',
  'src/middleware/auth.membership.test.ts',
  'src/modules/chat/chat-settings.service.test.ts',
]);
run('server TypeScript', 'server', 'npx', ['tsc', '--noEmit']);
run('client TypeScript', 'client', 'npx', ['tsc', '--noEmit']);
run('client tests', 'client', 'npm', ['test']);

const report = fs.readFileSync(
  path.join(root, 'docs/audit/CRM_SURFACE_AUDIT_2026-09-12.md'),
  'utf8'
);
if (!report.includes('## Leftover recheck 2026-09-13')) {
  process.stderr.write('CRM audit report is missing the leftover recheck section\n');
  process.exit(1);
}

console.log('crm-leftover-recheck-ok');
