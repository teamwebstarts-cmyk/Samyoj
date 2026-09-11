# Gates: Existing-system 15-day implementation plan

OWNS: docs/IMPLEMENTATION_PLAN_EXISTING_15D.md, .unlazy/existing-harden-impl/**

Scope: Write a file-level implementation plan for hardening already-shipped Samyoj surfaces, excluding new products such as Embedded Signup, recurring billing, and Ads.

- [x] G1: implementation plan maps every 15-day major box to files, tests, and an explicit out-of-scope list
  CHECK: node .unlazy/existing-harden-impl/verify-plan.mjs
  EXPECT: existing-harden-plan-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=existing-harden-plan-ok

- [x] G2: plan forbids Embedded Signup, Razorpay Subscriptions, Ads, and real Content Studio providers
  CHECK: node .unlazy/existing-harden-impl/verify-plan.mjs --no-new-products
  EXPECT: existing-harden-no-new-products-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=existing-harden-no-new-products-ok

- [x] G3: plan names webhook-before-ack, send idempotency, campaign phone dedupe, honesty copy, and 1000-send proof
  CHECK: node .unlazy/existing-harden-impl/verify-plan.mjs --packets
  EXPECT: existing-harden-packets-ok
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=e3a870e24ba1/42 entries; output=existing-harden-packets-ok

- [x] G4: live inbound and customer-host restore remain manual gates, not claimed as code-complete
  EVIDENCE: reviewed docs/IMPLEMENTATION_PLAN_EXISTING_15D.md Manual gates table and 8 must-tick map; naya phone reply, other-host restore, and GO/NO-GO are listed as Manual, not Packet A–F code-complete.
