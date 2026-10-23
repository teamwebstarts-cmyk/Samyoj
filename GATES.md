# Gates: Inbox template reality

OWNS: GATES.md, server/src/modules/campaigns/template-params.ts, server/src/modules/campaigns/template-params.test.ts, server/src/modules/inbox/routes.ts, server/src/modules/whatsapp/send-failure-explain.ts, server/src/modules/whatsapp/send-failure-explain.test.ts, client/src/components/inbox/inboxUtils.ts, client/src/components/inbox/inboxUtils.fillTemplate.test.ts, client/src/components/inbox/MessageBubble.tsx, client/src/components/inbox/ChatThread.tsx, client/src/components/inbox/TemplateComposer.tsx, client/src/components/templates/TemplateHeaderMediaField.tsx, client/src/types/index.ts, client/src/utils/whatsappSendFailure.ts

Scope: Inbox template bubbles show the sent name, header image, and buttons, and the send form previews the image only in the phone panel.

- [x] G1: Stored template preview uses the recipient name, and ecosystem delivery failures are not treated as a retryable template bug
  CHECK: npm test -- --run src/modules/campaigns/template-params.test.ts src/modules/whatsapp/send-failure-explain.test.ts
  EXPECT: Test Files  2 passed
  CWD: server
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/server; path=b06644dca2ee/39 entries; output=- ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json | Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

- [x] G2: Inbox bubble text replaces the sample name with the value that was actually sent
  CHECK: npm test -- --run src/components/inbox/inboxUtils.fillTemplate.test.ts
  EXPECT: Test Files  1 passed
  CWD: client
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/client; path=b06644dca2ee/39 entries; output=Start at  19:23:00 | Duration  588ms (transform 88ms, setup 0ms, import 105ms, tests 6ms, environment 0ms)
