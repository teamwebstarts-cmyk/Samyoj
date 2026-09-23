import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const phases = [
  '00-foundation.md',
  '01-lead-ads.md',
  '02-ctwa.md',
  '03-messenger.md',
  '04-instagram.md',
  '05-ads-read.md',
  '06-analytics.md',
  '07-portfolio.md',
];

for (const name of phases) {
  const path = join(root, 'docs/meta-ecosystem/phases', name);
  if (!existsSync(path)) {
    console.error('missing file ' + name);
    process.exit(1);
  }
  const text = readFileSync(path, 'utf8');
  for (const heading of ['## Do', "## Don't", '## Test']) {
    if (!text.includes(heading)) {
      console.error(name + ' missing ' + heading);
      process.exit(1);
    }
  }
}

const arch = readFileSync(join(root, 'docs/meta-ecosystem/ARCHITECTURE.md'), 'utf8');
for (const needle of ['webhook.processor.ts', 'leads/routes.ts', 'ContactSource', 'no Channel']) {
  if (!arch.includes(needle)) {
    console.error('ARCHITECTURE missing ' + needle);
    process.exit(1);
  }
}

const readme = readFileSync(join(root, 'docs/meta-ecosystem/README.md'), 'utf8');
if (!readme.includes('phases/01-lead-ads.md')) {
  console.error('README missing phase index');
  process.exit(1);
}

console.log('PHASE_PACK_OK');
