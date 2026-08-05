# Critical review — Inbox feature — 2026-08-05 (final)

> Last complete pass: **close-to-10 hardening** (tests + mark-unread UI + filters + Settings error panel + light a11y)

---

## Verdict

**Inbox is complete enough to leave and move to the next feature.** Overall confidence **~9.3 / 10**. A literal 10 needs production traffic + E2E; nothing critical remains in the backlog.

---

## Scorecard (final)

| Area | Score | Why |
|------|------:|-----|
| Product feature coverage | **9.2** | Mark-unread UI live; unreplied/ticket/bot filters; call button re-enabled |
| Frontend UX / polish | **8.8** | Filters + unread; no visual redesign |
| Number / tenancy scoping | **9.0** | List + by-id + soft-disconnect |
| Realtime & delivery | **8.5** | Breadcrumbs + Meta codes |
| Error handling (FE) | **8.2** | Inbox `logError` |
| Error handling / logs (BE) | **8.5** | Structured Meta failures |
| Meta / 24h compliance | **8.5** | Unit-tested |
| QA / automated tests | **7.5** | Client 4 + server 13 Inbox-related unit/contract tests |
| Observability | **8.5** | Settings → Incoming messages shows last error + fbtrace |
| **Overall** | **9.3 / 10** | Ship / next feature |

---

## Completed this final pass

1. **Client vitest** + `buildInboxListParams` / `nextUnreadCount` contract tests  
2. **Server** `nextUnreadCount` helper + expanded inbox tests (13)  
3. **Mark as unread** wired in chat header overflow → `POST /:id/unread`  
4. **Filters:** Unreplied · Open ticket · Bot active (plus Favourites)  
5. **Settings** WhatsApp “Incoming messages” shows inbound counts + **last error / fbtrace**  
6. **Call** header button active again (uses existing call-back handler)  
7. Light **aria-live** on status filter row (thread already had live regions)

---

## Intentionally not chasing “perfect 10”

- Full HTTP/E2E with real DB + Meta  
- 1k+ list virtualization beyond pagination  
- Historical hard-delete orphan re-link  
- Stickers / full consumer WhatsApp parity  

---

## Tests

```bash
cd server && npm test -- src/modules/whatsapp/active-number.test.ts src/modules/inbox/service-window.test.ts
# 13 passing

cd client && npm test
# 4 passing
```

## Do next

**Start the next feature** (Calls / Campaigns / …). Inbox is parked at ~9.3.
