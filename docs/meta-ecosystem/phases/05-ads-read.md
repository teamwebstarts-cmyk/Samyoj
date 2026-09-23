# Phase 5 — Ads numbers (read only)

**Ships:** `Facebook → Ads`. Spend, impressions, clicks, Meta lead count, CPL of that Meta lead.  
**Not** an ad builder. **Not** phase 1.

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
- Do not show this menu item before the API returns real rows.

## How it works

```text
Daily job → Insights for the connected ad account (read)
  → store snapshot (date, spend, impressions, clicks, actions.lead, cpl)
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
| Footer | **Open Ads Manager** |
| Sidebar | Facebook group, child **Ads**, blue mark |

## Test

- [ ] Tiles match Ads Manager for the same account and the labeled window (ballpark, same day).
- [ ] A day with no delivery shows zeros **and** the caption, not a crash.
- [ ] No button creates or pauses an ad.
- [ ] Billing plan price does not change when spend changes.

## Competitors

AiSensy and Interakt draw more of Ads Manager and still wait on Meta review. v1 is the Wati-style read: numbers in, creation out.
