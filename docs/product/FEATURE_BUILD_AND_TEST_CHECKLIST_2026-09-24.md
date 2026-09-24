# Feature build and test checklist

**Date:** 24 Sep 2026  
**Pair with:** [WEBSITE_FEATURE_CATALOG_2026-09-24.md](WEBSITE_FEATURE_CATALOG_2026-09-24.md)

Legend:

- **Done (code)** — implemented and covered by automated tests or a reviewed code path.
- **Works on test deploy** — `bash start.sh` stack is up; a human can click it. Not the same as a customer-host proof.
- **Blocked** — code exists; a real Meta or phone event has not completed the chain.
- **Not built** — still only in the plan.
- **Do not ship as a claim** — stub, hidden, or the wrong billing model.

Internal test deploy was restarted 24 Sep 2026: API `:8000`, UI `:3000`, Admin `:3001`, Postgres, Redis, ngrok webhook challenge passed. That restart does **not** prove a new phone reply.

---

## WhatsApp and CRM

| Feature | Build | Test | Why it is or is not closed |
|---|---|---|---|
| Connect number (OAuth, no App ID in UI) | Done (code) | Works on test deploy | Platform app credentials stay in server env. |
| Inbox: assign, notes, search, media, templates, 24h window | Done (code) | Works on test deploy for existing threads | **New inbound on the customer host is not proven** (SAMYOJ-2). Old webhooks are not replayed. Health counters can be from earlier days. |
| Campaigns + consent fail-closed | Done (code) | Automated tests exist; send needs a connected number and opted-in contacts | Includes schedule, repeat, retry, and no-reply follow-up. Do not treat a local send as production throughput. |
| Template submit to Meta | Done (code) | Library and wizard tested in code | Meta approval time is Meta’s, not ours. Live WABA submit still needs a real number. |
| Automations Phase B (keyword, welcome, away, delays, visual flows, test-send) | Done (code) | Server tests for conflict and skip reasons | Phase C (natural-language flows, wait-for-media) is **not built** (SAMYOJ-26). |
| WhatsApp Forms (Meta Flows) | Done (code) | Flow tests exist | A form inside WhatsApp. Not a public website builder. |
| AI chat bot vs AI calling bot | Done (code) | UI and call-path tests exist | A live barge-in call on a real phone is still an open check. |
| Calls list, recents, post-call summary | Done (code) | Works on test deploy | |
| Live call transfer | Stub | Not a real transfer | SAMYOJ-12. Do not mark done. |
| Contacts, tags, import, consent | Done (code) | Used by campaigns | |
| Tickets | Done (code) | No dedicated ticket test file | List, assign, status, link to a chat. Not a full SLA helpdesk. |
| Team roles | Done (code) | In the app | |
| HttpOnly session cookies + email verify gate | Done (code) | Landed 2026-08-25 | Production login blocks unverified email. |
| Manual plan billing + AI top-up | Done (code) | Ledger tests | Plan names and a cadence toggle render. **Recurring Razorpay checkout is not live.** Not GST tax invoices or dunning (SAMYOJ-35). |
| Business hours, away message, website button, data export | Done (code) | In Settings | Website button is a `wa.me` snippet for the connected number. Export is owner/admin. |
| In-app support assistant | Done (code) | Topbar board | Answers in the product. Not a second helpdesk. |
| Two-factor enroll / session list | Done (code) | Settings → Security | Password, authenticator setup, and session revoke use the existing `/team/me/2fa` and `/team/sessions` APIs. Login still asks for a code only after 2FA is enabled. |
| Official WhatsApp badge | Checklist + links only | Does not grant the badge | Meta decides. Do not sell a green tick. |
| Dashboard | Done (code) | Works on test deploy | |
| Commerce orders | Done (code), sidebar hidden | Not a primary flow | Leave off the public feature list. |
| Content Studio | Code exists, sidebar hidden | Not a shipped surface | Do not list on the website. Not Posts or Reels. |
| Backup restore | Script exists | Drilled locally, **not** on the customer host | SAMYOJ-6 customer-host drill still open. |

## Facebook

| Feature | Build | Test | Why it is or is not closed |
|---|---|---|---|
| Page connect UI and callback | Done (code) | Page can be stored when OAuth succeeds | Meta app still **Development**. Page scopes have been **rejected** on the WhatsApp app. Invalid Scopes can still appear on reconnect. |
| Messenger inbox (separate from WhatsApp) | Done (code) | Empty inbox renders; socket requires Facebook platform | **Real Messenger delivery blocked** until Page webhook is subscribed and the app can receive production events. Unpublished apps only get dashboard test webhooks. |
| Lead Ads → pipeline | Done (code) | Idempotency covered in tests | **Blocked:** `leads_retrieval` not granted; `page` webhook not the live subscription (only WhatsApp object was subscribed on the last app check). |
| Click-to-WhatsApp chip | Done (code) | Parser/tests | **Blocked:** no recorded real ad click on this host. |
| Ads read (7-day insights, no create/pause) | Done (code) | Unit tests for zero-day, no account, no `ads_management` | **Blocked:** `ads_read` rejected; this Page had no shared ad account, so the UI correctly shows steps instead of ₹0. Account picker is in code; a live number comparison with Ads Manager is not done. |
| Ads Manager inside Samyoj | Not built | — | On purpose. Open Ads Manager link only. |
| Analytics page (`/analytics`) | Done (code) | Page exists; left column needs a real Ads snapshot | Two columns. Revenue stays “—” until a Won lead has an amount. Not a single ROI. Live Ads proof is still blocked. |
| Settings → Channels | Done (code) | Renders WhatsApp, Facebook, and Instagram on one tab | Soft disconnect. Does not merge the three inboxes. |

## Instagram

| Feature | Build | Test | Why it is or is not closed |
|---|---|---|---|
| Connect via Page-linked professional account | Done (code) | Connect returns a clear error if no IG account is linked to the Page | Instagram scopes were **missing** on the Meta app privilege list. |
| DM inbox, 1000-character cap, 24h window, no WA templates | Done (code) | UI empty state and composer copy checked in browser | **Real DM blocked** by unpublished-app webhook rule. Native Instagram inbox receiving a DM does not prove Samyoj got the POST. |
| Comments, hide, one private reply, 7-day limit | Done (code) | Comment routes and debounce checked | **Real comment blocked** the same way. |
| Instagram-only keyword automation | Done (code) | Engine skips WhatsApp when `platform=IG` | Needs a real comment to prove end to end. |
| Posts / Reels | Not built | — | Out of scope. |
| Comment-origin banner on every DM | Not fully stored | — | Private reply does not open a thread until the person replies. Banner is not shown on every chat. |

## Planned, not started

| Feature | Build | Why |
|---|---|---|
| TARGET subscriptions, GST invoices | Not built | SAMYOJ-35. Do not mix Meta message fees into the plan price. |
| Platform admin impersonation and WhatsApp outreach | Not built | Left on SAMYOJ-57. |
| App publish + App Review | Not done | Required before real Facebook, Instagram, Lead Ads, and Ads events. See `docs/meta-ecosystem/META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md`. |

## Live test gate (none of these are checked off)

- [ ] New WhatsApp reply increments receive count **after** this restart, on the number you care about.
- [ ] Messenger: second Facebook user → Facebook Inbox only → reply inside 24h.
- [ ] Instagram: second account DM → Samyoj Instagram Inbox → reply.
- [ ] Instagram comment keyword → one private reply → no WhatsApp automation.
- [ ] Instant Form → one Meta Ads lead → same lead id does not duplicate.
- [ ] Ads tiles match Ads Manager for 7 days, attribution label shown, CPL is “—” when leads are 0.
- [ ] Customer-host backup restore.
- [ ] Live call transfer — still a stub; do not check this until SAMYOJ-12 is actually built.

Until those boxes are checked, the catalog’s **In the product** line means “built for internal testing,” not “proven for customers.”
