import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const server = resolve(root, 'server');
const schema = readFileSync(resolve(server, 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(server, 'prisma/migrations/20260912100000_recurring_billing/migration.sql'),
  'utf8'
);

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`billing gate failed: ${message}`);
    process.exit(1);
  }
}

const gate = process.argv[2];
switch (gate) {
  case 'catalog':
    assert(schema.includes('model BillingSubscription'), 'subscription model missing');
    assert(schema.includes('model Invoice'), 'invoice model missing');
    assert(migration.includes('CREATE TABLE IF NOT EXISTS "billing_subscriptions"'), 'migration missing');
    run('npx', ['prisma', 'validate', '--schema', 'prisma/schema.prisma'], server);
    run('npm', ['run', 'db:migrate-startup-safe'], server);
    console.log('billing-catalog-schema-ok');
    break;
  case 'provider':
    run('npm', ['test', '--', 'src/modules/billing'], server);
    console.log('billing-provider-safety-ok');
    break;
  case 'lifecycle':
    run('npm', ['test', '--', 'src/modules/billing/subscription.service.test.ts'], server);
    console.log('billing-lifecycle-ok');
    break;
  case 'invoices':
    run('npm', ['test', '--', 'src/modules/billing/production-billing.test.ts'], server);
    console.log('billing-invoices-ok');
    break;
  case 'entitlements':
    run('npm', ['test', '--', 'src/modules/billing/entitlements.service.test.ts'], server);
    console.log('billing-entitlements-ok');
    break;
  case 'surfaces':
    assert(existsSync(resolve(root, 'client/dist/index.html')), 'client build output missing');
    assert(existsSync(resolve(root, 'admin/dist/index.html')), 'admin build output missing');
    run('npm', ['run', 'build'], root);
    console.log('billing-surfaces-ok');
    break;
  case 'regression':
    run('npm', ['run', 'db:migrate-startup-safe'], server);
    run('npm', ['test', '--', 'src/modules/billing'], server);
    run('npm', ['run', 'build'], root);
    console.log('billing-regression-ok');
    break;
  default:
    console.error('usage: node scripts/verify-billing-gates.mjs <catalog|provider|lifecycle|entitlements|invoices|surfaces|regression>');
    process.exit(2);
}
