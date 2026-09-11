# PLAN — Packet B tenancy / permissions

Owner: engineering
Mode: Solo
Scope: Agent/API-key cannot mutate Content Studio, wa-forms, onboarding, or settings hours. Unsigned public media is not guessable. Existing number isolation tests still pass. No ES, billing, webhook persist, or send idempotency.

## Out of this packet

- API-key scopes product / campaign send block (Zapier + public-api stay)
- Org-switcher UI
- Signed S3 CDN URLs
