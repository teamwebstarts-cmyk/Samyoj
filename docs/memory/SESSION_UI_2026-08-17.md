# Session UI 2026-08-17 — Before → After

Test-deploy only (`bash start.sh`). **Not customer production.** No git commit of secrets. Comparison of the UI pass mapped onto existing Jira (comments, not a ticket per chip). New Task only for Calls history delete: [SAMYOJ-70](https://teamwebstarts.atlassian.net/browse/SAMYOJ-70).

---

## AI Bots ([SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52), [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59), [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56), [SAMYOJ-69](https://teamwebstarts.atlassian.net/browse/SAMYOJ-69))

| Before | After |
|--------|--------|
| Toolbar wrapped; empty list was a tall poster | Desktop one row, mobile stack; compact empty state |
| Personality generate was thin | Write personality richer (hidden extras). Train **Write answers** |
| Setup toggles stacked | 2×2 toggles + **About the business** |
| Hero, master switch card, ANSWERS CALLS, All-calls explainer, “This number’s chats” | **Removed** |
| No All-calls switch on the calling list | All-calls switch (like All chats) |
| Few voices / no preview; Train/Try it chat-only | 4 voices + preview; Train/Try it on calling |
| Telephony on Calls → Customize | Calling-bot tab **When they call**. Calls Customize **editor gone**. Kebab + Settings rail **gone** (59) |
| Could delete down to zero bots on a channel | Last bot on a channel cannot delete (always ≥1 CHAT and ≥1 CALL). Support/system undeletable. Default-bot rule stays on 52 — no sibling |
| Calling Off could still fall through | Still fail-closed when calling is off |
| Generate / Write answers / Try-it not always on the ledger | Usage logged (`generate_personality`, `generate_training`, try-it) — already on 56 |
| Per-contact AI had no home | [SAMYOJ-69](https://teamwebstarts.atlassian.net/browse/SAMYOJ-69): AI answers / Person only (picker restyle). Global Off still wins |

---

## Calls ([SAMYOJ-54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54), [SAMYOJ-70](https://teamwebstarts.atlassian.net/browse/SAMYOJ-70), [SAMYOJ-55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55))

| Before | After |
|--------|--------|
| Empty Recents unlike Inbox | Empty like Inbox |
| Filters funnel | Funnel gone; chips + mouse-wheel |
| No select / delete history | Select, select-all, delete + right-click. **[SAMYOJ-70](https://teamwebstarts.atlassian.net/browse/SAMYOJ-70):** `DELETE /calling/:id`, `POST /calling/bulk` (does not hang up a live call) |
| Detail chrome unlike Inbox; Notes in footer; COMPLETED pill | Inbox-style details rail; Notes off footer; COMPLETED pill gone |
| AI answers picker unlike Inbox Support | Same pattern as Inbox Support, left of Call back (home still 69) |
| CallSummaryNote full-width / shadow / green bar | No shadow, no green bar, **half-width centered** (55) |

---

## Inbox ([SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53))

| Before | After |
|--------|--------|
| Chips hard to read / wrap | Readable chips + wheel scroll |
| Inbox SLA chrome on Inbox | **Gone** (Tickets Overdue kept on Tickets) |
| Sender ⋮ cramped | `right-1` |
| Note delete asked for confirm | No confirm |
| Auto-notes showed Call ID | Call ID hidden |

---

## Dashboard ([SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51))

| Before | After |
|--------|--------|
| Extra Last 7 days pill on Message performance | That extra pill off |
| Needs attention not pinned | Left-top |
| Donut hover heavy | Hover % + small tooltip |
| Preconnect marketing cards | **Gone**; hero play remains |
| Appearance “Page side space” also moved the header | **Does not affect header** (`PageShell` gutters only) |

---

## Auth ([SAMYOJ-68](https://teamwebstarts.atlassian.net/browse/SAMYOJ-68))

| Before | After |
|--------|--------|
| Split login/register existed; left icons not distinct | Distinct left icons (Mail / Lock / User / Building / ShieldCheck) |
| Register had no sign-in line | **Already have an account? Sign in** → `/login` |

Auth APIs unchanged. Cookies still [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3).

---

## Settings / nav

| Before | After |
|--------|--------|
| Orders in the sidebar | **Hidden** (`navigation.ts` `hidden: true`). `/commerce` still exists. Commented on [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8) — no new Task |

---

## Honest leftovers (not this UI pass)

Still open: [SAMYOJ-2](https://teamwebstarts.atlassian.net/browse/SAMYOJ-2) inbound, [SAMYOJ-3](https://teamwebstarts.atlassian.net/browse/SAMYOJ-3) cookies/tenancy, [SAMYOJ-5](https://teamwebstarts.atlassian.net/browse/SAMYOJ-5) automations send-when-it-should-not, [SAMYOJ-6](https://teamwebstarts.atlassian.net/browse/SAMYOJ-6) restore drill, [SAMYOJ-11](https://teamwebstarts.atlassian.net/browse/SAMYOJ-11) Graph template clone.

Deferred until asked: [SAMYOJ-12](https://teamwebstarts.atlassian.net/browse/SAMYOJ-12) live transfer, [SAMYOJ-26](https://teamwebstarts.atlassian.net/browse/SAMYOJ-26) Phase C, [SAMYOJ-35](https://teamwebstarts.atlassian.net/browse/SAMYOJ-35) billing TARGET. [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) remaining: TARGET ledger, STT/TTS honesty, impersonation, WhatsApp outreach.

Env leftover (not a Jira): preconnect hero play uses `VITE_PRECONNECT_VIDEO_URL`, which is **unset**.
