import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const page = readFileSync(join(root, 'client/src/pages/DashboardPage.tsx'), 'utf8');
const tabs = readFileSync(join(root, 'client/src/components/dashboard/DashboardChannelTabs.tsx'), 'utf8');
const home = readFileSync(join(root, 'client/src/components/dashboard/DashboardAllChannels.tsx'), 'utf8');
const app = readFileSync(join(root, 'client/src/App.tsx'), 'utf8');

const need = [
  [page.includes("requestedChannel === 'all' || !requestedChannel"), 'default channel is all'],
  [page.includes('<DashboardAllChannels'), 'all channels view is mounted'],
  [tabs.includes('All Channels'), 'tab label exists'],
  [tabs.includes('Coming soon'), 'email stays coming soon'],
  [!home.includes("instagramApi") || !home.includes('mail'), 'mail api is absent'],
  [home.includes('Meta ads performance'), 'ads strip'],
  [home.includes('Live overview'), 'live overview'],
  [home.includes('Message status'), 'message status'],
  [home.includes('Recent activity'), 'recent activity'],
  [home.includes('Needs attention'), 'needs attention'],
  [home.includes('Quick actions'), 'quick actions'],
  [home.includes('Setup checklist'), 'setup checklist'],
  [!home.includes("completed: false, href: '/templates'"), 'checklist does not invent a template step'],
];

const hrefs = [...home.matchAll(/to="([^"]+)"/g)].map((m) => m[1].split('?')[0]);
const routes = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
for (const href of hrefs) {
  if (href === '/') continue;
  const ok = routes.some((route) => route === href || href.startsWith(`${route}/`));
  need.push([ok, `route ${href}`]);
}

const failed = need.filter(([ok]) => !ok);
if (failed.length) {
  console.error(failed.map(([, label]) => label).join('\n'));
  process.exit(1);
}
console.log('all channels recheck passed');
