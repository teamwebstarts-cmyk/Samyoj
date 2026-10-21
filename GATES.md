# Gates: AWS VPS audit findings — solution work

OWNS: server/src/**, server/scripts/**, server/prisma/**, scripts/**, docs/audit/**

Scope: Fix every finding in docs/audit/AWS_VPS_DEEP_AUDIT_2026-10-21.md in severity order, each with a runnable check, plus ops changes proven on the box.

- [x] G1: P0-1 backup script exists, is syntactically valid, refuses a wrong DB, and its systemd units pass verification
  CHECK: bash scripts/verify-backup-tooling.sh
  EXPECT: backup tooling verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b06644dca2ee/39 entries; output=backup tooling verification passed

- [x] G2: P1-1 graphGet throws a typed MetaApiError and the HTTP mapping table is correct (Graph 100/190/200/80008/5xx)
  CHECK: npx vitest run src/modules/whatsapp/graph-error-mapping.test.ts && echo 'Graph error mapping verification passed'
  EXPECT: Graph error mapping verification passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G3: P1-1 a dead WABA no longer 500s the templates route — per-number isolation returns the healthy number's templates
  CHECK: npx vitest run src/modules/templates/dead-waba-isolation.test.ts && echo 'dead WABA isolation verification passed'
  EXPECT: dead WABA isolation verification passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G4: P1-2 oversize webhook envelopes are recognised and ACKed instead of throwing, and the queue has retry/backoff/DLQ defaults
  CHECK: npx vitest run src/modules/whatsapp/webhook-oversize.test.ts src/modules/whatsapp/webhook-accept.test.ts src/workers/webhook.processor.test.ts && echo 'webhook overflow verification passed'
  EXPECT: webhook overflow verification passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G5: P1-2 stuck webhook rows are reclaimed by a bounded stale sweep so oldestWaitingMs cannot lie forever
  CHECK: npx vitest run src/modules/whatsapp/webhook-accept.test.ts && echo 'stale webhook sweep verification passed'
  EXPECT: stale webhook sweep verification passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G6: P2-2 nginx rate-limit configuration is syntactically valid and verified on the box without breaking health
  CHECK: bash scripts/verify-nginx-rate-limit.sh
  EXPECT: nginx rate limit verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b06644dca2ee/39 entries; output=nginx rate limit verification passed

- [x] G7: P3-1 malformed JSON returns 400 INVALID_JSON and oversize body returns 413, not 500
  CHECK: npx vitest run src/middleware/body-parser-errors.test.ts && echo 'body parser error verification passed'
  EXPECT: body parser error verification passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G8: P3-8 /health exposes the deployed commit from BUILD_INFO and never leaks env values
  CHECK: npx vitest run src/config/build-info.test.ts && echo 'build info verification passed'
  EXPECT: build info verification passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G9: full server, client and admin test suites pass after all changes
  CHECK: bash scripts/verify-full-suite.sh
  EXPECT: full suite verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G10: production deploy of the fixed server build answers health, webhook challenge, templates isolation and the new 400 path
  CHECK: bash scripts/verify-aws-deploy.sh
  EXPECT: aws deploy verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b06644dca2ee/39 entries; output=aws deploy verification passed

- [x] G11: final report written with per-finding changes, tests, results and self-score
  CHECK: bash scripts/verify-final-report.sh
  EXPECT: final report verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b06644dca2ee/39 entries; output=final report verification passed

- [x] G12: P2-1 pm2-samyoj unit state recorded and the reboot-safe fix applied or explicitly abandoned with reason
  CHECK: bash scripts/verify-pm2-unit.sh
  EXPECT: pm2 unit verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=b06644dca2ee/39 entries; output=pm2 unit verification passed
