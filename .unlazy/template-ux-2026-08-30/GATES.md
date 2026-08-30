# Gates: Template Review error-clarity polish

OWNS: .unlazy/template-ux-2026-08-30/**, client/src/utils/templateForm.ts, client/src/utils/templateIssueCopy.ts, client/src/utils/templateIssueCopy.test.ts, client/src/components/templates/wizard/templateWizardModel.ts, client/src/components/templates/TemplateIssueAlert.tsx, client/src/components/templates/library/TemplateLibraryReviewStep.tsx, client/src/pages/TemplateLibraryPage.tsx, client/src/utils/templateLibrary.test.ts

Scope: Make library Review errors actionable and variable labels accurate; do not redo GitHub/trailing-body/connection work already gated.

- [x] G1: source proves nearest-clause variable labels, narrow media-error mapping, and a What-to-do line on template errors
  CHECK: node .unlazy/template-ux-2026-08-30/scripts/verify-ux.mjs
  EXPECT: template ux verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=template ux verification passed

- [x] G2: client tests cover order_shipped labels, mapped Meta errors, and issue-copy next steps
  CHECK: node .unlazy/template-ux-2026-08-30/scripts/verify-ux.mjs --unit
  EXPECT: template ux unit verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=6edb1355a1f7/42 entries; output=Duration  2.25s (transform 468ms, setup 0ms, import 1.56s, tests 44ms, environment 0ms) | template ux unit verification passed
