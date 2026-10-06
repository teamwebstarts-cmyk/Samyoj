import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.error(`missing ${rel}`);
    process.exit(1);
  }
  return fs.readFileSync(file, 'utf8');
}

const admin = read('admin/src/pages/BillingConfigPage.tsx');
const layout = read('client/src/components/Layout.tsx');
const modal = read('client/src/components/billing/SubscriptionLockModal.tsx');
const notes = read('client/src/components/layout/NotificationCenter.tsx');
const routes = read('server/src/modules/platform/routes.ts');
const credits = read('server/src/modules/billing/ai-credits/service.ts');
const guards = read('server/src/middleware/plan-guard.ts');

const checks = [
  [admin.includes("'/settings/subscription-enforcement'"), 'admin endpoint'],
  [admin.includes('aria-pressed={enforcement}'), 'admin switch'],
  [layout.includes('SubscriptionLockModal'), 'layout modal'],
  [layout.includes('subscriptionLocked'), 'layout lock'],
  [layout.includes('isLocked'), 'layout isLocked'],
  [modal.includes('role="dialog"'), 'dialog'],
  [modal.includes('to="/billing"'), 'billing link'],
  [notes.includes("id: 'plan-expired'"), 'notification id'],
  [notes.includes('entitlements?.isLocked'), 'notification lock'],
  [routes.includes("'/settings/subscription-enforcement'"), 'api route'],
  [credits.includes('meteringEnforced'), 'credit gate'],
  [guards.includes('subscriptionEnforcementOff'), 'plan guard'],
  [!admin.includes('enabled: true') || admin.includes('data.enabled === true'), 'admin does not force on'],
];

const failed = checks.filter((entry) => !entry[0]).map((entry) => entry[1]);
if (failed.length > 0) {
  console.error(failed.join('\n'));
  process.exit(1);
}

console.log('subscription switch ui passed');
