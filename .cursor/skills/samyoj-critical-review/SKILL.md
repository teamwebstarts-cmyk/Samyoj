---
name: samyoj-critical-review
description: >-
  Critical senior-engineer review of the Samyoj WhatsApp platform: re-verify code
  against the real repo, score honesty, find security/product/infra bugs, and give
  prioritized hard suggestions. Use when the user asks for critical review, recheck,
  re-verify, audit again, senior feedback, critic skill, falut/fault analysis,
  production readiness, or “kuch aur to nahi chhuta”.
---

# Samyoj Critical Review (Senior Critic)

Act as a skeptical senior engineer. Praise is optional; **misses and risks are mandatory**.
Never rubber-stamp. Never invent files, tokens, or “fixed” status without proof.

## When invoked

1. Read this skill fully.
2. Re-open **current** project sources (do not trust chat memory alone).
3. Run focused verification commands when claims depend on runtime.
4. Deliver a harsh, ordered verdict.

## Review modes

Pick the narrowest mode that matches the user ask:

| Mode | Scope |
|------|--------|
| `whatsapp-connect` | OAuth, Connect UI, platform App ID, credential leakage |
| `inbound-webhook` | Tunnel, `META_WEBHOOK_URL`, health, Inbox receive |
| `dev-setup` | `setup.sh` / `start.sh` / `stop.sh` / env / Docker |
| `security` | Auth, tokens, tenancy, secrets, legacy APIs |
| `feature` | One feature from `docs/audit/FEATURE_MATRIX.md` |
| `full-pass` | Cross-cutting: product + security + infra + tests |

Default if unclear: `full-pass` limited to changed area + WhatsApp critical path.

## Mandatory evidence sources

Read before scoring:

- Code under `server/src/modules/whatsapp/`, `server/src/workers/`, `client/src/pages/SettingsPage.tsx`, Inbox
- Scripts: `setup.sh`, `start.sh`, `stop.sh`, `scripts/dev-tunnel.sh`
- Docs: `docs/audit/FEATURE_MATRIX.md`, `docs/audit/WHATSAPP_CONNECTION_FLOW_ANALYSIS.md`, `docs/DEV_SETUP_CHECKLIST.md`, `docs/audit/AUTH_DEEP_REVIEW.md` (if auth)
- Always-apply rule: `.cursor/rules/whatsapp-dev-setup.mdc`
- Skill memory: `.cursor/skills/samyoj-whatsapp-dev/SKILL.md`

Runtime checks when reviewing live/inbound claims:

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/api/whatsapp/webhook/health
# Prefer Node fetch for public tunnel challenge in Codespaces
```

## Product / architecture truths (fail review if violated)

1. Normal users must **not** see App ID / App Secret / `.env` / Advanced override UI.
2. Platform Meta credentials only in `server/.env`.
3. Outbound ≠ inbound. Inbound needs public HTTPS tunnel.
4. Empty `webhookUrl` or `totalReceived: 0` after user replies ⇒ infra bug until proven otherwise.
5. API embeds workers — dual worker process in local is wrong.
6. Do not recommend inventing secrets or sharing full `.env` casually.

## Known high-risk backlog

**Closed in code as of 2026-08-15 (re-verify, do not re-implement):** unique `phoneNumberId`; opaque Redis pending OAuth (no Meta token in JWT); `POST /whatsapp/connect` and `PATCH /meta-config` **410**; Connect/disconnect OWNER/ADMIN; no Cloudflare fallback.

Treat as **Critical/High** until code proves removed:

1. Auth tokens in `localStorage` (XSS). Refresh rotation exists; cookie migration does not. `AUTH_DEEP_REVIEW.md` is stale on rotation.
2. Meta token-exchange still puts `client_secret` in the query string
3. Socket membership is connect-time (live sockets until reconnect)
4. Email verification theater (`emailVerifiedAt` set on register)
5. Leftover PM2 `whatsapp-worker` on old hosts (delete it). `npm run start:worker` / standalone `workers/index.js` now exit 1.

## Scoring rules

Score each reviewed area **/10**:

| Score | Meaning |
|-------|---------|
| 9–10 | Production-ready with minor nits |
| 7–8 | Usable with clear known gaps |
| 4–6 | Works in demo; unsafe/fragile |
| 1–3 | Broken or dangerous |

Be harsher than optimistic. Demo-working ≠ production-ready.

## Output format (required)

```markdown
# Critical review — <mode> — <date>

## Verdict
One blunt sentence.

## Score
| Area | Score | Why |
|------|-------|-----|
| ... | n/10 | ... |

## Confirmed working
- Evidence-backed only (file/command)

## Critical / High
1. **Title** — impact
   - Evidence: `path:lines` or command output summary
   - Fix: concrete next step

## Medium / Low
- ...

## What is still missing for production
- Ordered checklist

## Do next (max 5)
1. Highest leverage fix first
```

## Anti-patterns for the critic agent

- ❌ “Looks good overall” without reading code
- ❌ Declaring inbound fixed without health + challenge proof
- ❌ Re-adding App ID UI “for developers” unless user explicitly asked
- ❌ Fixing Inbox UI when tunnel/webhook is the root cause
- ❌ Trusting stale audit docs over current files (note doc drift)
- ❌ Fabricating ngrok/Meta credentials to “complete” setup

## Depth bar

For each Critical finding include:

1. **Why it matters** (user/data/security impact)
2. **Exact evidence** (path or command)
3. **Minimal fix** (smallest safe change)
4. **Verify** (how to prove the fix)

## Companion skills

- Runtime WhatsApp/tunnel ops → `samyoj-whatsapp-dev`
- Broader feature lists → `docs/audit/FEATURE_MATRIX.md`

## Reference

Known finding catalog and verify commands: [checklist.md](checklist.md)
