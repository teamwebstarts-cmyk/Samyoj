# PLAN — One-Month Production Roadmap

Owner: Samyoj product/engineering
Mode: Solo document integration with sequential verification
Scope: Update one canonical roadmap document; do not implement product code or billing/Meta features in this phase.

## Contract

- Canonical output: `docs/EXECUTIVE_GAP_ANALYSIS_AND_ROADMAP_2026.md`
- The attached plan file is reference-only and is not an owned path.
- Current code and `docs/memory/` are authoritative for shipped status.
- Older audits are evidence only when explicitly marked with their date and caveat.
- External vendor capabilities and pricing are self-reported or official sources and must carry a source URL and access/research date.
- Status vocabulary is closed: `Implemented`, `Partially implemented`, `Blocked/external gate`, `Live-unverified`, `Stub/demo`, and `Deferred/not this month`.
- No customer-production claim may be made while inbound, restore, scale, and external approval gates remain unmet.

## Depth tree

### Root — integrated roadmap

Owns: `docs/EXECUTIVE_GAP_ANALYSIS_AND_ROADMAP_2026.md`, `.unlazy/one-month-production-roadmap/**`

#### Leaf A — contract and evidence

Owns: this `PLAN.md`, `GATES.md`, `verify-roadmap.mjs`, `STATUS.md`

Deliverable: operating envelope, evidence labels, source register, acceptance-gate conventions, dependencies, and non-goals.

#### Leaf B — production hardening

Input evidence: production-hardening audit, current backend/frontend/admin paths, session memory.

Deliverable: Week 1–2 backend, database, messaging, frontend, admin, scale, failure, backup, observability, and CI sequence with measurable gates.

#### Leaf C — billing and AI economics

Input evidence: current billing implementation plus official Razorpay/GST sources.

Deliverable: Week 3 subscription lifecycle, immutable ledgers, token/minute units, GST, dunning, refunds, reconciliation, and controlled payment-test boundaries.

#### Leaf D — Meta growth and competitive research

Input evidence: official Meta sources, current Meta surface map, competitor public sources.

Deliverable: Week 4 Tech Provider/Embedded Signup, Ads leadgen, Forms/Flows, catalog/orders, Content Studio containment, competitive quick wins, and explicit non-goals.

## Dependencies

1. Contract/evidence definitions precede all roadmap claims.
2. Week 1 reliability and test harness work precedes Week 2 load/failure proof.
3. Billing schema and event-journal design precede any real-money test.
4. Meta approval, business-token, customer-account, WABA payment-method, and live-device checks remain external/manual gates.
5. Competitive research informs prioritization but never proves Samyoj capability.

## Verification protocol

- Parse this scope's gates before execution.
- Run only the declared checks after reviewing their source.
- Reverify the full scope sequentially after the document is updated.
- A manual gate is never counted as met from prose alone; it must carry exact evidence or remain pending.
- Report qualified gate ids with met, unmet, and abandoned counts.
