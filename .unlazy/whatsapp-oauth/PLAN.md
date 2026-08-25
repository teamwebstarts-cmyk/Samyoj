# WhatsApp OAuth popup plan

## Contract

The Connect WhatsApp action may start from Dashboard, Settings, or another authenticated
screen. The originating page must remain open. Meta may redirect the popup to the
callback route, and the callback must publish exactly one terminal result (`success`,
`error`, or `cancel`) to the opener, then close itself. The opener must refresh the
number context after success and must stop its waiting state after error/cancel.

Platform Meta App ID/Secret remain server-only. Customer Meta access tokens remain
server-side. Multiple numbers remain number-scoped and must not be weakened while fixing
the popup.

## Depth tree

### Root: OAuth connect reliability and honest readiness audit

- **Leaf 1 — popup lifecycle**
  - Owns: `client/src/utils/whatsappOAuth.ts`, `client/src/hooks/useWaOAuthPopupListener.ts`,
    `client/src/pages/WhatsappCallbackPage.tsx`, `client/src/components/dashboard/WhatsAppConnectGuide.tsx`,
    and any existing Settings connect trigger that must share the same lifecycle.
  - Needs: current callback/result behavior inspected.
  - State: READY
  - Gates: G1, G2, G3, G7

- **Leaf 2 — server OAuth contract review**
  - Owns: `server/src/modules/whatsapp/**`, `server/src/config/**`.
  - Needs: Leaf 1 contract; no server behavior change unless the audit finds a concrete
    callback or credential defect.
  - State: READY
  - Gates: G4, G5

- **Leaf 3 — production/development risk ledger**
  - Owns: `docs/audit/**`.
  - Needs: Leaf 2 findings and current Meta documentation.
  - State: READY
  - Gates: G6

## Integration

After each leaf is implemented, re-read the changed files, run its gates, and verify
the combined popup contract. Any live Meta, browser, credential, or webhook check
that cannot be performed in this environment remains a visible manual unmet gate.

## Status log

- 2026-08-25: Scope created before implementation. Existing unrelated user change in
  `.vscode/settings.json` is outside this work and must remain untouched.
- 2026-08-25: Popup callback route, marker cleanup, shared redirect helper, and
  Settings polling cleanup implemented. Consent omission was also corrected to
  fail closed, and stale webhook test mocks were updated.
- 2026-08-25: Client build, server build, full client tests, focused WhatsApp tests,
  and full server tests passed. Live Meta browser verification remains handed off.
