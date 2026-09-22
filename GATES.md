# Gates: stop WhatsApp busy stampede

OWNS: server/src/modules/whatsapp/context.ts, server/src/modules/whatsapp/context-sync.test.ts, server/src/modules/whatsapp/routes.ts, server/src/modules/whatsapp/meta.service.ts, server/src/modules/templates/routes.ts, server/src/modules/templates/cache.ts, server/src/modules/billing/usage.service.ts, GATES.md

Scope: Inbox template load and the busy banner stop calling Meta on every read when the number is already stored, and a rate limit serves the last template list instead of a 400.

- [x] G1: stored WhatsApp ids skip a live Meta sync
  CHECK: npx vitest run src/modules/whatsapp/context-sync.test.ts --reporter=dot
  EXPECT: Test Files  1 passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=609b55c48eed/43 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
