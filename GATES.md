# Gates: Campaign consent UX + subscribe-all

OWNS: client/src/components/campaigns/**, client/src/components/contacts/ContactConsentInfoTip.tsx, client/src/utils/plainLanguage.ts, client/src/utils/contactConsent.test.ts, client/src/services/api.ts, server/src/modules/contacts/**, scripts/verify-campaign-ux.mjs

Scope: Fix misleading campaign audience copy, show excluded subscriber counts, add subscribe-all for unsubscribed contacts, align contact badge language, and verify with automated checks.

- [x] G1: Campaign UX copy uses subscribed-audience language (not misleading "All contacts" for ALL_OPTED_IN)
  CHECK: node scripts/verify-campaign-ux.mjs
  EXPECT: campaign-ux-verification-passed
  EVIDENCE: exit 0 — campaign-ux-verification-passed

- [x] G2: New contacts default to auditable campaign consent when optedIn omitted
  CHECK: cd server && npm test -- consent.test.ts
  EXPECT: Tests  6 passed
  EVIDENCE: 6 passed consent.test.ts

- [x] G3: Client consent + campaign wizard unit tests pass
  CHECK: cd client && npm test -- contactConsent.test.ts campaignWizardModel.test.ts
  EXPECT: Tests  2 passed
  EVIDENCE: 2 files 11 passed

- [x] G4: Subscribe-all-unsubscribed contacts API returns updated count
  CHECK: cd server && npm test -- subscribe-unsubscribed.test.ts
  EXPECT: Tests  3 passed
  EVIDENCE: 3 passed subscribe-unsubscribed.test.ts
