# Meta app configuration evidence — 24 Sep 2026

This is the saved configuration record from the Meta Developer screenshots shared during live testing. It is evidence of what is visible in the dashboard, not proof that every permission is granted to an OAuth token or that live events work.

## Use cases visible in the app

- Create and manage ads with Marketing API
- Capture and manage ad leads with Marketing API
- Create and manage app ads with Meta Ads Manager
- Connect with customers through WhatsApp
- Manage messaging and content on Instagram
- Engage with customers on Messenger from Meta

## Permission status visible in the screenshots

### Ready for testing / available

- `ads_management` — visible as Ready for testing
- `pages_manage_metadata` — visible as Ready for testing
- `pages_messaging` — visible as Ready for testing
- `pages_read_engagement` — visible as Ready for testing
- `pages_show_list` — visible as Ready for testing
- `email` — visible as Ready for testing

### Still shown as “Add to App”

- `instagram_basic`
- `instagram_manage_messages`

`instagram_manage_comments` is required by Samyoj's current Facebook OAuth scope list, but it is not visibly confirmed in the supplied screenshots. Treat it as unconfigured until it is shown in the dashboard.

### Not a Samyoj requirement

- `business_management` is shown as App Review rejected. Samyoj does not need this permission for the agreed Phase 0–5 read-only Ads/Page/Instagram scope.
- `ads_management` is not requested by Samyoj code. Phase 5 is read-only and must not gain ad create, edit, pause, or budget controls.

## Important distinction

The use-case cards being present does **not** mean all permissions are valid in the OAuth dialog. “Add to App” means the permission still needs to be added to the relevant use case. “Ready for testing” means the app configuration is available for test-role users; it is not customer-production approval.

The current OAuth failure naming `instagram_basic`, `instagram_manage_messages`, and `instagram_manage_comments` is consistent with the screenshot evidence. Page connect requests Facebook, Lead Ads, Instagram, and Ads scopes in one URL, so an unconfigured Instagram scope can block a reconnect even when the Page permission rows are ready.

## Recommended operating decision

Use a two-track rollout:

1. **Facebook now:** keep the existing connected Page. Test Messenger Inbox and read-only Ads without reconnecting if the saved Page token still works.
2. **Instagram next:** add/configure `instagram_basic`, `instagram_manage_messages`, and `instagram_manage_comments` in the Instagram use case, then reconnect the Page and connect the linked professional Instagram account.

Do not remove Instagram scopes from code merely to hide the Meta configuration gap if Instagram is the next agreed test. If Facebook-only testing must proceed immediately and the existing Page token cannot be reused, make a deliberate code change to split Facebook OAuth scopes from Instagram linking; record that as a product/integration decision rather than silently weakening the requested Phase 4 flow.

## Live-test checklist after dashboard changes

- Reopen the same Meta app in Development mode.
- Confirm the three Instagram permissions no longer show “Add to App”.
- Confirm the exact HTTPS callback remains registered:
  `https://reimagined-fortnight-4j5p7x95xqqgc6p5-3000.app.github.dev/settings/facebook/callback`
- Reconnect the Page from the Codespace HTTPS URL.
- Confirm the Page remains connected in Samyoj.
- Then connect the Page-linked professional Instagram account.
- Test real Messenger, Instagram, Lead Ads, and Ads Insights events separately.

Never record access tokens, App Secret, OAuth `state`, or `.env` contents in this document.
