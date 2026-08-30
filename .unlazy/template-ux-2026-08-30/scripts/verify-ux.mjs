#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const unit = process.argv.includes('--unit');

function read(rel) {
  const path = resolve(root, rel);
  if (!existsSync(path)) throw new Error(`missing ${rel}`);
  return readFileSync(path, 'utf8');
}

if (unit) {
  const result = spawnSync(
    'npx',
    [
      'vitest',
      'run',
      'src/utils/templateForm.test.ts',
      'src/utils/templateIssueCopy.test.ts',
      'src/utils/templateLibrary.test.ts',
    ],
    { cwd: resolve(root, 'client'), encoding: 'utf8', env: { ...process.env, VITEST: 'true' } },
  );
  process.stdout.write(`${result.stdout || ''}${result.stderr || ''}`);
  if (result.status !== 0) process.exit(result.status || 1);
  console.log('template ux unit verification passed');
  process.exit(0);
}

const form = read('client/src/utils/templateForm.ts');
if (!form.includes('function clauseBeforeVariable')) {
  throw new Error('inferVariableDescription still uses the whole prefix (order_shipped {{3}} mislabeled)');
}

const mapper = read('client/src/components/templates/wizard/templateWizardModel.ts');
if (mapper.includes("lower.includes('media') || lower.includes('header')")) {
  throw new Error('mapTemplateApiError still hijacks any message containing header/media');
}
if (!mapper.includes('header_handle') && !mapper.includes('sample file for media headers')) {
  throw new Error('mapTemplateApiError lost a specific media-header match');
}

const alert = read('client/src/components/templates/TemplateIssueAlert.tsx');
if (!alert.includes('What to do:')) {
  throw new Error('TemplateIssueAlert has no What to do line');
}

const copy = read('client/src/utils/templateIssueCopy.ts');
if (!copy.includes('nextStep?:')) {
  throw new Error('FriendlyIssue missing nextStep');
}

const review = read('client/src/components/templates/library/TemplateLibraryReviewStep.tsx');
if (!review.includes('Both buttons open this same website')) {
  throw new Error('Review still hides that two URL buttons share one website');
}

const page = read('client/src/pages/TemplateLibraryPage.tsx');
if (!page.includes('uniqueLibraryTemplateName(selected.id')) {
  throw new Error('Library submit does not suggest a new name after a name collision');
}

console.log('template ux verification passed');
