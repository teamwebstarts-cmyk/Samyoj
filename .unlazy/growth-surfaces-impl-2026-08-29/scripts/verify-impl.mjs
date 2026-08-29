#!/usr/bin/env node
/**
 * Source-contract checks for growth-surfaces implementation.
 * Reads files; does not copy expected counts from chat.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const leaf = process.argv.includes('--leaf')
  ? process.argv[process.argv.indexOf('--leaf') + 1]
  : 'all';

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function read(rel) {
  const path = resolve(root, rel);
  if (!existsSync(path)) fail(`missing ${rel}`);
  return readFileSync(path, 'utf8');
}

function mustInclude(rel, tokens) {
  const text = read(rel);
  const missing = tokens.filter((t) => !text.includes(t));
  if (missing.length) fail(`${rel} missing: ${missing.join(' | ')}`);
  console.log(`OK include ${rel}`);
}

function mustNotInclude(rel, tokens) {
  const text = read(rel);
  const found = tokens.filter((t) => text.includes(t));
  if (found.length) fail(`${rel} still contains forbidden: ${found.join(' | ')}`);
  console.log(`OK absent ${rel}`);
}

const LEAVES = {
  'root-honesty': () => {
    mustNotInclude('server/src/modules/analytics/routes.ts', [
      'readRate * 0.4',
      'overallReadRate * 0.35',
      'totalConversations * 0.52',
      'const tierLimit = 10000',
    ]);
    mustNotInclude('client/src/components/reports/tabs/ReportsCampaignsTab.tsx', [
      'Est. Button Click Rate',
    ]);
    mustNotInclude('client/src/components/reports/tables/UniversalTemplateTable.tsx', [
      'Est. CTR',
    ]);
  },
  '1.1.1': () => LEAVES['root-honesty'](),
  '1.1.2': () => {
    mustInclude('client/src/components/dashboard/LiveMetricsHero.tsx', [
      'Quality rating',
      'Meta daily limit',
      'unique users / 24h',
      'formatMessagingLimitTier',
      'InfoTip',
    ]);
    mustNotInclude('client/src/components/dashboard/LiveMetricsHero.tsx', [
      'label="Delivery"',
      'Promo vs service',
      'Samyoj daily send cap',
    ]);
    mustInclude('client/src/utils/messagingLimitTier.ts', [
      'TIER_250',
      'TIER_10K',
      'whatsapp_business_manager_messaging_limit',
    ]);
    mustInclude('server/src/modules/analytics/conversation-mix.ts', [
      'MARKETING',
      'UTILITY',
      'AUTHENTICATION',
      'SERVICE',
    ]);
    mustInclude('server/src/modules/analytics/routes.ts', [
      'promoConversations',
      'serviceConversations',
      'qualityRating',
    ]);
  },
  '1.1.3': () => {
    mustInclude('server/src/modules/campaigns/quota.ts', [
      'dailySendLimit',
      'remaining',
    ]);
    mustInclude('client/src/pages/CampaignsPage.tsx', ['CampaignQuotaBar']);
    mustInclude('client/src/components/campaigns/CampaignQuotaBar.tsx', [
      'Samyoj daily send cap',
      'sentToday',
      'campaignApi.quota',
    ]);
    mustInclude('client/src/pages/CampaignWizardPage.tsx', ['CampaignQuotaBar']);
  },
  '1.1.4': () => {
    mustInclude('client/src/components/inbox/InboxListHeader.tsx', [
      "'active'",
      "'inactive'",
      'Active',
      'Inactive',
    ]);
    mustNotInclude('client/src/components/inbox/InboxListHeader.tsx', [
      'Can reply',
      'Needs template',
    ]);
    mustInclude('client/src/utils/inboxListParams.ts', ["params.window = 'open'", "params.window = 'closed'"]);
    mustInclude('server/src/modules/inbox/routes.ts', ["windowFilter === 'open'", "windowFilter === 'closed'"]);
    mustInclude('server/src/modules/inbox/service-window.ts', ['conversationServiceWindowWhere']);
  },
  wave1: () => {
    LEAVES['1.1.1']();
    LEAVES['1.1.2']();
    LEAVES['1.1.3']();
    LEAVES['1.1.4']();
  },
  '1.2.1': () => {
    mustInclude('server/src/modules/campaigns/cohorts.ts', [
      'read',
      'delivered_unread',
      'replied',
      'window',
      'failed',
      'AMBIGUOUS',
      'getCampaignCohortAudience',
      'recipientRepliedAfterOwnSend',
    ]);
    mustNotInclude('client/src/components/campaigns/CampaignRetargetPanel.tsx', [
      'React tab',
      'retryAmbiguous',
      "params.set('phones'",
    ]);
    mustInclude('client/src/components/campaigns/CampaignRetargetPanel.tsx', [
      'cohortAudience',
    ]);
    mustInclude('client/src/pages/CampaignsPage.tsx', ['CampaignRetargetPanel']);
    mustInclude('server/src/modules/campaigns/routes.ts', ['/cohorts', '/audience']);
    mustInclude('client/src/pages/CampaignWizardPage.tsx', [
      'cohortAudience',
      'MARKETING',
    ]);
  },
  '1.2.2': () => {
    mustInclude('server/src/modules/templates/starters.ts', [
      'order_update',
      'appointment_reminder',
      'otp_login',
      'UTILITY',
      'AUTHENTICATION',
      'hi_IN',
      'en_US',
      'starterCreatePayload',
    ]);
    mustInclude('client/src/components/templates/library/TemplateStarterPack.tsx', [
      'Meta still reviews',
    ]);
    mustNotInclude('client/src/components/templates/library/TemplateStarterPack.tsx', [
      'already verified for everyone',
      'skip review',
    ]);
    mustInclude('client/src/pages/TemplateLibraryPage.tsx', [
      'TemplateStarterPack',
      'createFromLibrary',
      'pickStarterLibraryMatch',
      'statusFromTemplateCreate',
    ]);
    mustNotInclude('client/src/pages/TemplateLibraryPage.tsx', [
      "|| 'APPROVED'",
    ]);
  },
  wave2: () => {
    LEAVES['1.2.1']();
    LEAVES['1.2.2']();
  },
  '1.3.1': () => {
    mustInclude('client/src/utils/waMe.ts', ['https://wa.me/']);
    mustInclude('client/src/components/settings/WhatsAppButtonBuilder.tsx', ['wa.me', 'prefill']);
    mustNotInclude('client/src/components/settings/WhatsAppButtonBuilder.tsx', [
      'META_APP_ID',
      'App Secret',
    ]);
    mustInclude('client/src/components/settings/IntegrationsPanel.tsx', ['WhatsAppButtonBuilder']);
  },
  '1.3.2': () => {
    mustInclude('client/src/components/settings/OfficialCheckCard.tsx', [
      'Official check',
      'Meta decides',
      'Open WhatsApp Manager',
    ]);
    mustNotInclude('client/src/components/settings/OfficialCheckCard.tsx', [
      'Buy green tick',
      'we provide the tick',
      'guarantee approval',
    ]);
    mustInclude('client/src/components/settings/WhatsAppChannelsPanel.tsx', ['OfficialCheckCard']);
  },
  wave3: () => {
    LEAVES['1.3.1']();
    LEAVES['1.3.2']();
  },
  polish: () => {
    mustInclude('client/src/pages/CampaignWizardPage.tsx', [
      "selectedAudienceTypes: ['CONTACTS']",
      'cohortAudience',
    ]);
    mustInclude('client/src/components/inbox/useInboxDeepLink.ts', ['ready']);
    mustInclude('server/src/modules/inbox/service-window.ts', ['inboxListOrderBy']);
    mustInclude('server/src/modules/campaigns/cohorts.ts', ['isSamePhoneIdentity']);
    mustInclude('client/src/utils/templateLibrary.ts', ['return null']);
    mustInclude('client/src/components/dashboard/LiveMetricsHero.tsx', [
      'Meta daily limit',
      'Quality rating',
    ]);
    mustInclude('client/src/pages/TemplateLibraryPage.tsx', ['submitStarterCreate']);
    mustNotInclude('client/src/pages/TemplateLibraryPage.tsx', ["|| 'APPROVED'"]);
  },
};

const ids =
  leaf === 'all'
    ? ['root-honesty', 'wave1', 'wave2', 'wave3', 'polish']
    : [leaf];

for (const id of ids) {
  const run = LEAVES[id];
  if (!run) fail(`unknown leaf ${id}`);
  run();
}
console.log('growth-surfaces impl verification passed');
