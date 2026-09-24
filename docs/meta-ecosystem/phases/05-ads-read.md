# Phase 5 — Ads numbers (read only)

**Ships:** `Facebook → Ads`. Spend, impressions, clicks, Meta lead count, CPL of that Meta lead.  
**Not** an ad builder. **Not** phase 1.

**Audit status (24 Sep 2026):** The read-only snapshot, explicit account list/selection, and UI exist in code, but `ads_read`, Marketing API access, a shared active ad account, and a real Ads Manager comparison are still missing. The current navigation exposes Ads with an honest empty state.

## Do

- `ads_read` (and the ads permission already submitted in phase 1, if review granted it).
- Poll Insights. Default window **7-day click / 1-day view**. Label that on the page.
- Tiles + link **Open Ads Manager**.
- A one-line recap on Dashboard. Same numbers, not a second source of truth.

## Don't

- Do not create campaigns, ad sets, ads, or budgets.
- Do not mix this CPL with WhatsApp ad chips or with our Won count.
- Do not hardcode a remaining quota.
- Do not fold spend into the Samyoj plan price.
- Decide whether to keep the menu visible with the honest no-account/permission state or hide it until real rows. Current code keeps it visible so users can see the setup path.

## How it works

```text
Daily job → Insights for the connected ad account (read)
  → owner/admin may select one available account → store snapshot (date, spend, impressions, clicks, actions.lead, cpl)
  → Facebook → Ads reads the snapshot
```

If the business has no ad account shared to the Page token, the page says so and links to Ads Manager. No empty chart that looks like zero spend.

## UI

Match Dashboard metric cards (`LiveMetricsHero` density), not a new visual system.

| Element | Spec |
|---------|------|
| Title | Ads performance |
| Caption | “Meta’s numbers. Not Samyoj revenue.” |
| Cards | Spend, Impressions, Clicks, Leads, CPL |
| Account | Owner/admin can select among accounts shared with the connected Page |
| Footer | **Open Ads Manager** |
| Sidebar | Facebook group, child **Ads**, blue mark |

## Test

- [ ] Tiles match Ads Manager for the same account and the labeled window (ballpark, same day).
- [ ] A day with no delivery shows zeros **and** the caption, not a crash.
- [ ] No button creates or pauses an ad.
- [ ] With two available accounts, changing the picker refreshes the selected account’s snapshot and Ads Manager link.
- [ ] Billing plan price does not change when spend changes.

## Competitors

AiSensy and Interakt draw more of Ads Manager and still wait on Meta review. v1 is the Wati-style read: numbers in, creation out.
