# Meta ecosystem

Existing plans, phases, UI notes, and the current audit for Meta work. Code is the source of truth; planning prose is not proof of implementation.

**Current audit:** [META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md](META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md)

**Final handoff/testing:** [PHASE_0_5_FINAL_HANDOFF_2026-09-24.md](PHASE_0_5_FINAL_HANDOFF_2026-09-24.md)

**App Review and live-test runbook:** [META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md](META_APP_REVIEW_AND_LIVE_TEST_RUNBOOK_2026-09-24.md)

**24 Sep live-testing session (senior summary):** [META_LIVE_TESTING_SESSION_SUMMARY_2026-09-24.md](META_LIVE_TESTING_SESSION_SUMMARY_2026-09-24.md)

**Verdict:** Phases 0–5 code paths are hardened and regression-tested; non-WhatsApp Meta live proof remains blocked by app review/configuration. Read [BLOCKERS.md](BLOCKERS.md) and the audit before changing code. Product boundaries and separate-inbox decisions remain unchanged.

1. [Blockers](BLOCKERS.md) — decisions required before Phase 0/1
2. [Architecture](ARCHITECTURE.md) — DB and API reuse, code that blocks us
3. [phases/](phases/01-lead-ads.md) — one file per phase: do, don’t, how, UI, test
4. [Sidebar](META_ECOSYSTEM_UI_BY_PHASE_2026-09-22.md) — menu order

| Phase | File | Visible result |
|-------|------|----------------|
| 0 | [phases/00-foundation.md](phases/00-foundation.md) | None. WhatsApp unchanged |
| 1 | [phases/01-lead-ads.md](phases/01-lead-ads.md) | Facebook → Leads |
| 2 | [phases/02-ctwa.md](phases/02-ctwa.md) | Chip on WhatsApp thread |
| 3 | [phases/03-messenger.md](phases/03-messenger.md) | Facebook → Inbox |
| 4 | [phases/04-instagram.md](phases/04-instagram.md) | Instagram inbox + comments |
| 5 | [phases/05-ads-read.md](phases/05-ads-read.md) | Facebook → Ads (read) |
| 6 | [phases/06-analytics.md](phases/06-analytics.md) | Two columns, no fake ROI |
| 7 | [phases/07-portfolio.md](phases/07-portfolio.md) | Settings list of connections |

Older research stays below. If it disagrees with `phases/`, **phases win**.

| File | What it is |
|------|------------|
| `META_ECOSYSTEM_UI_BY_PHASE_2026-09-22.md` | Sidebar, separate inboxes, ads placement |
| `META_ECOSYSTEM_V2_PLAN_2026-09-18.md` | Phase order (wins over older tickets) |
| `META_ECOSYSTEM_TEAM_BRIEF.md` | Short brief for seniors |
| `META_ECOSYSTEM_DOS_AND_DONTS_2026-09-18.md` | Daily do / don’t |
| `META_ECOSYSTEM_PHASE_2026-09-17.md` | Meta CAN / CANNOT research |
| `META_ECOSYSTEM_IMPLEMENTATION_ROADMAP_2026-09-17.md` | Ticket rows (order superseded by V2 §5) |
| `META_ECOSYSTEM_VENDOR_BENCHMARK_2026-09-18.md` | Competitor facts |
| `META_ECOSYSTEM_COST_MODEL_2026-09-18.md` | Cost truth (no invented ₹) |
| `META_LOOP_PRESENTATION_2026-09-18.md` | Slide diagrams |
| `Market_Driven_Requirements_Samyoj.pdf` | Senior brief that started this |
