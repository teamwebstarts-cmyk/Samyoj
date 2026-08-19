# How to test what we shipped (2026-08-18)

**Test-deploy only** — not customer production. No Meta App ID / App Secret in Settings. Ever.

Start here, then work the numbered lists. Skip anything marked **needs live phone / ngrok / WABA**. Do not expect leftovers in §8 to “pass”.

---

## 0. Start the stack

1. In the repo root: `bash start.sh` (first time on a machine: `bash setup.sh`).
2. Wait until Docker (Postgres + Redis), API `:8000`, UI `:3000`, Admin `:3001`, and ngrok are up.
3. Open **http://localhost:3000** and sign in.

| Check | Pass | Fail |
|-------|------|------|
| UI loads | Login / workspace at `:3000` | Blank / connection refused |
| Settings → WhatsApp / Connect | Connect WhatsApp + Facebook OAuth only. **No** App ID, App Secret, `.env`, or “Advanced override” | Any Meta secret fields in the UI |
| Health (optional) | `curl -s http://localhost:8000/api/whatsapp/webhook/health` → `webhookConfigured: true` | API down, or health 5xx |

`totalReceived` on health can be `0` after a restart. That is **not** proof inbound is dead. Prove inbound only with a **new** phone reply (§7).

---

## 1. This session / Phase 1–2 (code)

### 1.1 Inbox call-permission card

**Claim:** If we request WhatsApp call permission, Inbox shows a card (phone icon + pending / granted / denied), not a blank bubble.

1. Open **Calls**. Pick a contact who has **not** approved calling yet.
2. Try **Call** / **Call back**.
3. Open **Inbox** → that same chat.

| Pass | Fail |
|------|------|
| Toast like “Call permission requested — try again after they approve.” Thread shows a card: phone icon, body text, **pending** badge | No toast, or thread has nothing / a raw JSON blob |
| After they tap Allow/Deny **on the phone**, badge becomes granted or denied *(needs phone)* | Card never updates after they reply on WhatsApp |

Grant/deny is **phone-only**. Pending card can be checked from the UI after a request.

### 1.2 Rate limiter (Redis down = optional)

**Claim:** Login still rate-limits if Redis is down (fail-closed). Limit: **20** attempts / 15 min on customer login.

**Easy (Redis up):** wrong password ~21 times on `/login`. After the cap: “Too many login attempts. Try again in 15 minutes.” Not endless retries.

**Optional Redis-down:**

1. Note you will lock yourself out of login for 15 min.
2. `docker compose stop redis`
3. Hit `/login` with a wrong password until blocked (or a small curl loop).
4. `docker compose start redis` when done.

| Pass | Fail |
|------|------|
| After the cap, login is blocked even with Redis stopped | Unlimited login attempts while Redis is down |

Skip this if you do not want to stop Redis. Unit tests already cover it.

### 1.3 Journeys pause (Inbox “Pause automations”)

**Claim:** Pausing the bot on a chat also stops **journeys / delayed flow sends**, not only the AI reply.

1. Use a chat that has a journey with a **delay** (or a keyword auto-reply you can trigger).
2. **Inbox** → open the chat → bot chip → **Pause automations**.
3. Trigger the journey (send the keyword from the phone, or wait out the delay).

| Pass | Fail |
|------|------|
| While paused: no journey / auto-reply / AI send on that chat | Message still goes out after pause |
| **Enable automations** again → next trigger can send | Pause does nothing |

Needs a live number + a real journey to be sure. Code path is verified; this is the human check.

### 1.4 Backup restore — **destructive**

**Claim:** `npm run db:restore` can restore a pg_dump. **`--yes` skips the type-RESTORE prompt and overwrites the whole DB.**

Do this only on **this** test database. It deletes current data and puts the backup back.

1. `cd server && npm run db:backup` → file under `.run/backups/whatsapp-platform-*.dump`
2. Optional: create a throwaway contact so you can see it vanish after restore.
3. `cd server && npm run db:restore -- --yes .run/backups/<that-file>.dump`
4. Restart if the API was running (`bash start.sh` again, or restart the API).
5. Inbox / Contacts: data matches the **backup**, not the throwaway row.

| Pass | Fail |
|------|------|
| Restore finishes; throwaway row is gone; old backup rows are back | Script errors, or live data unchanged |

Without `--yes` it asks you to type `RESTORE`. Same destroy-and-replace behaviour.

### 1.5 Socket membership (hard — skip OK)

**Claim:** If an admin removes you from the org, a live tab is kicked within ~60s (`session:revoked`), not only on next refresh.

1. User A logged in (leave the tab open).
2. From Team (or another owner): remove User A from the org.
3. Wait up to **60 seconds**. Do not refresh.

| Pass | Fail |
|------|------|
| Toast: session revoked by an administrator → `/login` | Tab stays fully live for many minutes with no kick |

Skip unless you have two users. Connect-time rooms are still a leftover until reconnect; this check is only the 60s membership guard.

### 1.6 Graph template clone — **needs live WABA**

**Claim:** Clone from Meta’s library (Account quick-pick) with stricter button validation. End-to-end needs a real WABA.

1. **Templates** → **Browse library**.
2. Quick-pick **Account** (e.g. account creation confirmation).
3. Clone with a real `https://…` URL (not `localhost`).

| Pass | Fail |
|------|------|
| Template submits to Meta / appears in the list | Graph rejects the suffix sample, or wizard crashes |

Cannot prove this on localhost-only. If Graph rejects the URL suffix, that is a known live leftover — do not treat as “clone is broken in the wizard.”

### 1.7 FEATURE_MATRIX docs

**Claim:** Matrix is honest: billing is demo, live transfer is a stub, TTS/STT is Sarvam.

Open `docs/audit/FEATURE_MATRIX.md` (top warning + Billing + Voice footer).

| Pass | Fail |
|------|------|
| Billing rows say **DONE (demo)**; voice says live transfer is a stub; Sarvam named; stale banner at top | Footer still “All DONE” / Google TTS as current |

### 1.8 Preconnect video button hidden

**Claim:** Play / Watch video is hidden when `VITE_PRECONNECT_VIDEO_URL` is unset (normal test-deploy).

1. Disconnect WhatsApp or use an org with no number → Dashboard preconnect hero.

| Pass | Fail |
|------|------|
| Connect CTA is there; **no** play/watch video button | Play button that opens nothing |

### 1.9 Automated tests (optional)

**Claim:** Tests exist (server ~832, client ~69, admin ~18). You do **not** need to re-run 832 unless you want to.

```bash
cd server && npm test          # long
cd client && npm test
cd admin && npm test
```

| Pass | Fail |
|------|------|
| Suites you ran are green | Failures in those packages |

---

## 2. AI Bots (16–17 Aug + Support bot)

**Claim:** Chat vs Calling are separate. Telephony lives on the calling bot. Four voices. Last/default/system bots cannot be deleted.

1. Sidebar **AI Bots**.
2. Switch **Chat** vs **Calling** tabs.
3. Open a **Calling** bot → tab **When they call** (ring, hours, missed-call WhatsApp). Greeting / voice stay on Setup.
4. **All-calls** switch on the calling list (same idea as All chats).
5. Setup: exactly **four** voices — Shubh, Ratan, Priya, Ishita — with preview.
6. Try delete: **Support / system** bot has no delete (or 403). Last remaining Chat bot and last remaining Calling bot cannot delete (always ≥1 each).

| Pass | Fail |
|------|------|
| Two channels; When they call on the calling bot; 4 voices + preview; system/last bot stays | Calls → Customize still has a full AI/telephony editor; you can delete down to zero bots |

**Calls → Customize:** should say pickup **moved** and link to AI Bots — not a second editor.

---

## 3. Calls

**Claim:** Empty Recents look like Inbox. Select / delete history. Details rail; notes not in the footer. Calling AI picker left of Call back. Call ID stripped from auto-notes.

1. **Calls** with no recents → empty state like Inbox (not a weird funnel).
2. With recents: chips + mouse-wheel; **no** old funnel filters.
3. Select one / select-all → delete. Right-click delete OK. **Does not hang up a live call.**
4. Open a past call: details on the **right rail**; notes there, not under the transcript footer; no big COMPLETED pill.
5. Calling AI chip **left of Call back**: On for this person vs Paused (Person only). Global calling Off still wins.
6. Open a call-summary note in Inbox: **no** `Call ID: …` line.

| Pass | Fail |
|------|------|
| Empty/select/delete/rail match the above | Notes stuck in footer; Call ID visible; Customize still owns AI |

---

## 4. Inbox

**Claim:** SLA chrome gone from Inbox. Chips scroll with the wheel. Note delete has no confirm. Call ID hidden on auto-notes.

1. **Inbox** list: readable chips; scroll sideways with the mouse wheel.
2. **No** Inbox SLA / overdue banner on this page (Tickets can still show Overdue).
3. Details → delete an internal note: **gone immediately**, no “are you sure?”.
4. Call summary / auto-note: no Call ID.

| Pass | Fail |
|------|------|
| Chips + wheel; no Inbox SLA; note vanishes with no modal | Confirm dialog; SLA on Inbox; Call ID in the note |

---

## 5. Dashboard, auth, nav, appearance

### 5.1 Dashboard donut

1. Connected number → **Dashboard**.
2. **Needs attention** top-left.
3. Message performance: **no extra** “Last 7 days” pill on that card.
4. Hover the donut: **% + small tooltip**, not a heavy overlay.

### 5.2 Auth Sign in link

1. Log out → `/register`.
2. **Already have an account? Sign in** → `/login`.

### 5.3 Orders hidden

1. Sidebar: **Orders** is not listed.
2. `/commerce` may still load if you type the URL — that is OK. Hidden from nav, not deleted.

### 5.4 Page gutter vs header

1. **Settings → Appearance → Page side space**.
2. Drag wider/narrower.

| Pass | Fail |
|------|------|
| Page content gutters change; **top header / sidebar stay put** | Header also slides / grows with the slider |

---

## 6. Extra 18 Aug smoke (optional)

These also landed the same day. Quick clicks, not a second audit.

| What | Where | Pass |
|------|--------|------|
| Template variables = select-or-type (name/phone/email) | Inbox → send template | Dropdown + you can still type |
| Support system bot | AI Bots | Always there; cannot delete |
| No tall AI Bot hero / sky banner | AI Bots Chat tab | List + cards only |
| Support drawer | Topbar **Support** | Assistant + suggested questions; no tickets tab |
| Call summary after hang-up | Inbox thread after a call | Summary **after** the call-end pill |
| Marketing opt-out still gets Support/AI | Opted-out contact texts in | Service/AI can still reply (not campaigns) |
| Admin UI | http://localhost:3001 | Login + denser tables (needs a platform operator) |

Call audio / barge-in / TTS quality still need a **live call** (§7).

---

## 7. Cannot prove without live phone + ngrok / WABA

Do **not** mark these solved from UI-only.

### P1-9 Inbound (SAMYOJ-2)

**Needs:** `bash start.sh` ngrok, `META_WEBHOOK_URL` matching the tunnel, WhatsApp connected, **new** reply from the phone.

1. Note current `totalReceived`:  
   `curl -s http://localhost:8000/api/whatsapp/webhook/health`
2. From **your phone**, send a **new** WhatsApp to the business number (not an old thread you only open in Inbox).
3. Health again: `totalReceived` **went up by 1**. Inbox shows the reply.

| Pass | Fail |
|------|------|
| Counter +1 and the bubble appears | Send from Samyoj works but replies never arrive; counter stuck |

`totalReceived: 0` right after restart is **not** a fail by itself.

### P1-10 Barge-in

**Needs:** one live AI WhatsApp call.

1. Calling bot **All-calls** on. Customer (or you) calls the business number.
2. While the bot is **speaking**, you talk over it.

| Pass | Fail |
|------|------|
| Bot **stops** mid-sentence and answers you | Bot talks over you the whole time, or hang-up/echo loop |

Code is in; this is the only real proof.

### Graph clone

See §1.6 — live WABA required.

---

## 8. Do **not** test as “solved”

| Leftover | What you will still see |
|----------|-------------------------|
| HttpOnly cookies (SAMYOJ-3) | Tokens in **tab** `sessionStorage`. DevTools → Application. XSS can still read them. Two tabs can be two accounts. |
| Inbound unproven | Until a **new** phone reply bumps `totalReceived` |
| Billing TARGET (SAMYOJ-35) | Old one-shot Razorpay / demo plans. Not subscriptions + GST. |
| Live transfer (SAMYOJ-12) | Settings stay **message_only**. No “please hold, connecting you”. |
| Phase C automations (SAMYOJ-26) | No tickets/SLA product, catalog, NL generate-flow, etc. |
| Email verify theater | Register can look “verified” immediately. No real verify-email gate. |
| Customer production | This checklist is **internal test-deploy** only |

---

## Suggested order (short)

1. `bash start.sh` → `:3000` → Settings has **no** App ID/Secret.  
2. AI Bots Chat/Calling, When they call, 4 voices, undelete.  
3. Calls empty / select / delete / rail.  
4. Inbox chips, no SLA, note delete, no Call ID.  
5. Dashboard donut + Appearance gutter.  
6. Register → Sign in. Sidebar no Orders.  
7. Call-permission card (then phone for grant/deny).  
8. Pause automations vs a journey (if you have one).  
9. Optional: restore drill, Redis-down limiter, tests.  
10. **Phone + ngrok:** inbound + barge-in. **WABA:** template clone.

If those UI items pass, the 16–18 Aug product work is confirmed on this machine. Phone items stay open until you actually text and call.
