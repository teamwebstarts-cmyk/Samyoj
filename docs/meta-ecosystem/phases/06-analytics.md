# Phase 6 — Analytics (two columns)

**Ships:** one page. Meta ads numbers beside our pipeline.  
**First new main-rail page** since `/reports` currently redirects to Billing.

## Do

- Add `Lead.amount` (nullable money) and let the agent set it on Won. Until then the revenue cell is “—”, not ₹0.
- Left column: phase 5 snapshot (spend, Meta leads, CPL).
- Right column: our counts (qualified, won) and sum of `amount` where stage is WON and `metaLeadId` is set.
- Filters: date, and platform only if that inbox exists.

## Don't

- Do not show one “ROI” or “₹4.8L from Video 03” as if Meta calculated it.
- Do not join a Click-to-WhatsApp chat into the form-lead column.
- Do not revive the unused reports page by deleting the redirect without this layout.

## How it works

```text
Won lead with amount + metaLeadId  → right column
Insights snapshot                    → left column
No shared formula. The page is two columns.
```

## UI

Dashboard card grid, two headings: **Meta ads** | **Your pipeline**. Sidebar: **Analytics** under Dashboard, not inside Facebook. Platform mark is not used; this page is the join.

## Test

- [ ] Won lead with no amount shows “—”.
- [ ] Setting amount on a META_ADS lead changes only the right column.
- [ ] A WhatsApp-ad chip conversation does not increment “Your pipeline” unless a lead exists.
- [ ] Left column equals phase 5 for the same dates.

## Competitors

Respond.io and Kommo sell this join and still keep ads in Ads Manager. Chatwoot says they do not do revenue. We do not beat them with a fake single number.
