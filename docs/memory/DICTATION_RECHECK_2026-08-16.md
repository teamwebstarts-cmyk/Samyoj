# Critical review — dictation completeness — 2026-08-16

Mode: product dictation vs Jira/docs (not a WhatsApp-connect or production-infra audit). **No implementation.**

## Verdict

Every **major** item you actually dictated in this session is in Jira under [SAMYOJ-8](https://teamwebstarts.atlassian.net/browse/SAMYOJ-8). Nothing extra was invented as a sibling ticket. A few **details** lived only in the long spec; those are now locked as comments on the existing tickets. You said **30+** tasks — only **14** product items were spoken so far; the rest are still unshared, not lost.

## Score

| Area | Score | Why |
|------|-------|-----|
| Set 1 capture (46–51) | 8/10 | All six themes filed; in-org number isolation correctly **not** re-ticketed; card-spacing “dashboard first” could have under-delivered “universal” |
| Set 2 capture (52–53) | 8/10 | Split brain, strip console, generate personality, Train, default, global calling on/off all in 52/53; “little knowledge” / Sarvam split were in spec, weak on the Jira body until the recheck comment |
| Set 3 capture (54–57) | 7/10 | Tickets exist and match the durable spec; **raw voice transcript for set 3 is not in the session jsonl** after summarization — if you said extra Calls/Reports details, resend them |
| Set 4 capture (58–59) | 8/10 | Inbox fields + strip AI from Customize filed; “in the AI” false start correctly **not** added to AI Bot |
| Process (major-only, merge related) | 9/10 | Dashboard 4 items → 51; AI Bot one redesign → 52; 59 Relates 52 instead of duplicating |
| Confluence | 3/10 | Wiki API still 404; durable copy is repo `docs/product/` only |

## Confirmed mapped (your words → ticket)

| You asked | Jira | Not a miss because |
|-----------|------|--------------------|
| Apply / unapply bot for all chats; skip personal Inbox picks; new button next to Pause/Activate on AI Bot cards | [SAMYOJ-46](https://teamwebstarts.atlassian.net/browse/SAMYOJ-46) | |
| Card margin on dashboard; control from Appearance; universal for new screens | [SAMYOJ-47](https://teamwebstarts.atlassian.net/browse/SAMYOJ-47) | Recheck comment: all dashboard widgets + CSS vars for in-dev screens |
| Skeleton loaders wherever DB/custom data loads | [SAMYOJ-48](https://teamwebstarts.atlassian.net/browse/SAMYOJ-48) | |
| Tab-only session; other tab can log into another account | [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) 4a | Conflicts with SAMYOJ-3 cookies — pick required |
| Same Meta number, other Samyoj account → fresh data, never my inbox | [SAMYOJ-49](https://teamwebstarts.atlassian.net/browse/SAMYOJ-49) 4b | Two **live** orgs on one Meta id is not viable; after A disconnects, B gets a **new empty** workspace |
| In-org: multiple numbers, separate data | **Already built** | Not a new ticket. Recheck comment on 49. |
| Disconnect visible on dashboard (not ~3 clicks) | [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5a | Merged with related dashboard chrome |
| Message performance: donut only, hover tooltip in segment color | [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5b | |
| Remove Health score | [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5c | Dashboard only; Reports Health left unless same pass |
| Alerts: no Open Inbox buttons; hover + click goes there | [SAMYOJ-51](https://teamwebstarts.atlassian.net/browse/SAMYOJ-51) 5d | |
| Campaign reschedule + repeat every N days, same people | [SAMYOJ-50](https://teamwebstarts.atlassian.net/browse/SAMYOJ-50) | Recheck comment: keep **time of day** too |
| Inbox: disable Auto · default; Pause/Activate already exists; default stays important on AI Bot | [SAMYOJ-53](https://teamwebstarts.atlassian.net/browse/SAMYOJ-53) | |
| Separate AI Chat vs AI Calling; few clicks; do not rebuild algorithms; generate personality; simple Train; remove templates/Connect/More/analytics/versions/activity/theory; global calling on/off; priority calling fields on the calling bot; full Customize later | [SAMYOJ-52](https://teamwebstarts.atlassian.net/browse/SAMYOJ-52) | Recheck comment: little Train, Sarvam split, no Connect tab |
| Calls Recents: no Help; Incoming/Outgoing; name + glyphs; hide number when named | [SAMYOJ-54](https://teamwebstarts.atlassian.net/browse/SAMYOJ-54) | |
| After AI call: summary on Calls **and** Inbox (system card, not fake inbound) | [SAMYOJ-55](https://teamwebstarts.atlassian.net/browse/SAMYOJ-55) | |
| Reports: own AI usage section, every AI surface, units not Meta fees | [SAMYOJ-56](https://teamwebstarts.atlassian.net/browse/SAMYOJ-56) | |
| Future platform admin (logins, features, APIs, AI) | [SAMYOJ-57](https://teamwebstarts.atlassian.net/browse/SAMYOJ-57) | Spec: `docs/product/PLATFORM_ADMIN_2026-08-16.md`. Not built. |
| Inbox New chat = same optional Contacts fields; same Contact row | [SAMYOJ-58](https://teamwebstarts.atlassian.net/browse/SAMYOJ-58) | Recheck: not on AI Bot form |
| Remove AI calling from Calls Customize | [SAMYOJ-59](https://teamwebstarts.atlassian.net/browse/SAMYOJ-59) | Relates 52; land with/after 52 |

Canonical leftover tickets from earlier sessions were **not** recreated: 2, 3, 5, 6, 11. Deferred: 12, 26, 35.

## Critical / High (capture, not production)

1. **Set 3 raw dictation is thinner than sets 1–2**
   - Why it matters: if you named extra Calls/Reports/admin fields, they are not in the jsonl to re-hear.
   - Evidence: session transcript `ffda91a4…jsonl` ends at the 2:37 PM AI Bot prompt; set 3/4 exist as specs + Jira after summarization.
   - Fix: if anything in 54–57 feels short, paste that batch again.
   - Verify: compare your notes to `docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md`.

2. **“30+ tasks” vs 14 filed**
   - Why it matters: looking complete would hide unshared work.
   - Evidence: you said more than 30, then “I have much more… next set” four times.
   - Fix: keep dictating. Do not invent the remaining ~16.
   - Verify: this file’s table vs your notebook.

## Medium / Low

- **SAMYOJ-47** “dashboard first” could be read as DashboardPage only — comment now says all dashboard widgets + universal vars.
- **SAMYOJ-50** “how much time” could have been dropped — comment now requires wall-clock send time.
- **SAMYOJ-52** Connect: you said not important *and* “we can add it” — resolved as no tab, optional one-line handoff.
- **Health score on Reports** — you said dashboard; Reports copy left unless you want it stripped too.
- **Try-it** on AI Bot — you did not mention it; spec kept a simple test. Say if it should go.
- Confluence still not connected; repo docs are the wiki.

## Intentionally not filed (not escapes)

| You said | Why no new Jira |
|----------|-----------------|
| Only major tasks; merge related | Process rule, already in `.cursor/rules/jira-task-backlog.mdc` |
| Research + document before coding | Done this session |
| Do not git push | Process |
| In-org number isolation | Already in code (`whatsapp-number-isolation.mdc`) |
| “Ask those details in the AI” then corrected | SAMYOJ-58 only |
| Full calling-settings replacement | Later; 59 is AI chrome only |
| Live call transfer | SAMYOJ-12 already deferred |

## What is still missing for production

Unchanged: customer production **no**. This recheck does not make the product production-ready. Auth cookies, inbound proof, backup drill, billing, live transfer still sit on 3 / 2 / 6 / 35 / 12.

## Do next (max 5)

1. Keep dictating the remaining notebook items the same way (research → spec → Jira, no code until you ask).
2. If set 3 (Calls Recents / summary / Reports AI / admin) is missing a detail from your notes, resend that batch.
3. When you want build: start from 46–59 in the order you pick; 59 must not ship before 52 has calling on/off + greeting/speaker/which-bot.
4. Do not re-open in-org number isolation as a new ticket.
5. Do not implement until you say so.

Specs: `docs/memory/PRODUCT_TASKS_2026-08-16.md`. Durable: `docs/product/CALLS_AI_USAGE_ADMIN_2026-08-16.md`, `docs/product/INBOX_CONTACT_AND_CALLING_AI_2026-08-16.md`.
