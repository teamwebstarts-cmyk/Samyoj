import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const failures = [];

const plain = read('client/src/utils/plainLanguage.ts');
if (!plain.includes("allAudienceWizardLabel: 'All subscribed'")) {
  failures.push('plainLanguage missing allAudienceWizardLabel');
}
if (!plain.includes("badgeYes: 'Subscribed'")) {
  failures.push('plainLanguage missing Subscribed badge');
}

const audienceSection = read('client/src/components/campaigns/CampaignAudienceSection.tsx');
if (audienceSection.includes("wizardLabel: 'All contacts'")) {
  failures.push('CampaignAudienceSection still uses All contacts wizard label');
}
if (!audienceSection.includes('subscribeUnsubscribed')) {
  failures.push('CampaignAudienceSection missing subscribe-unsubscribed API hookup');
}

const summaryRail = read('client/src/components/campaigns/wizard/CampaignWizardSummaryRail.tsx');
if (summaryRail.includes("'All contacts'")) {
  failures.push('CampaignWizardSummaryRail still says All contacts');
}

const routes = read('server/src/modules/contacts/routes.ts');
if (!routes.includes('/subscribe-unsubscribed')) {
  failures.push('contacts routes missing subscribe-unsubscribed endpoint');
}

const service = read('server/src/modules/contacts/service.ts');
if (!service.includes('subscribeUnsubscribedContacts')) {
  failures.push('contacts service missing subscribeUnsubscribedContacts');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('campaign-ux-verification-passed');
