#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

function must(cond, msg) {
  if (!cond) {
    process.stderr.write(`${msg}\n`);
    process.exit(1);
  }
}

const nav = read('client/src/config/navigation.ts');
must(nav.includes("label: 'WhatsApp'"), 'WhatsApp group missing');
must(nav.includes("label: 'Facebook'"), 'Facebook group missing');
must(nav.includes('dropdown: true'), 'dropdown flag missing');
must(nav.includes("to: '/inbox'"), 'WhatsApp Inbox route missing');
must(nav.includes("to: '/calls'"), 'Calls missing');
must(nav.includes("to: '/templates'"), 'Templates missing');
must(nav.includes("to: '/campaigns'"), 'Campaigns missing');
must(nav.includes("to: '/facebook/inbox'"), 'Facebook Inbox route missing');
must(!/label:\s*'Leads'/.test(nav), 'Leads must not be a sidebar option');

const sidebar = read('client/src/components/layout/Sidebar.tsx');
must(sidebar.includes('ChevronDown'), 'dropdown chevron missing');
must(sidebar.includes('PlatformDropdown') || sidebar.includes('dropdown'), 'dropdown UI missing');

const fbInbox = read('client/src/pages/FacebookInboxPage.tsx');
must(fbInbox.includes('InboxListHeader'), 'Facebook inbox must reuse InboxListHeader');
must(fbInbox.includes('ConversationList'), 'Facebook inbox must reuse ConversationList');
must(fbInbox.includes('ChatComposer'), 'Facebook inbox must reuse ChatComposer');
must(!fbInbox.includes('onOpenTemplate'), 'Messenger must not wire WhatsApp templates');

const header = read('client/src/components/inbox/InboxListHeader.tsx');
must(header.includes("variant === 'messenger'") || header.includes("variant?: 'whatsapp' | 'messenger'"), 'messenger header variant missing');

const panel = read('client/src/components/settings/FacebookPagePanel.tsx');
must(panel.includes('/contacts?tab=pipeline&source=META_ADS'), 'leads stay on Contacts pipeline');
must(!panel.includes('Facebook → Leads'), 'do not advertise Leads as a Facebook nav child');

const routes = read('server/src/modules/facebook/messenger-inbox.routes.ts');
must(routes.includes('req.query.q') || routes.includes("query.q"), 'Messenger list search missing');

process.stdout.write('NAV_INBOX_OK\n');
