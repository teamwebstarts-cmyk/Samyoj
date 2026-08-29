# Gates: Phase B — Product UX branch

OWNS: client/src/components/settings/WhatsAppChannelsPanel.tsx, client/src/components/inbox/MessageBubble.tsx, client/src/contexts/WhatsAppNumberContext.tsx

Scope: Coexistence badge, keep-alive reminder, Inbox echo badge.

- [ ] B-P:G1: Settings shows coexistence connect + badge copy
  CHECK: node -e "const s=require('fs').readFileSync('client/src/components/settings/WhatsAppChannelsPanel.tsx','utf8'); if(!/Connect existing Business app/.test(s)||!/keep coexistence active/.test(s)) process.exit(1); console.log('coex_ux_ok');"
  EXPECT: coex_ux_ok
  EVIDENCE: pending

- [ ] B-P:G2: Inbox echo badge
  CHECK: node -e "const s=require('fs').readFileSync('client/src/components/inbox/MessageBubble.tsx','utf8'); if(!/Sent from phone/.test(s)) process.exit(1); console.log('echo_badge_ok');"
  EXPECT: echo_badge_ok
  EVIDENCE: pending
