# Gates: Full Product Audit and Hardening

OWNS: server/src/**, server/prisma/**, client/src/**, admin/src/**, docs/memory/**, GATES.md

Scope: Re-verify and harden the Samyoj product, prioritizing Instagram, shared Meta ingress, AI/billing, security, and operational correctness.

- [x] G1: Baseline server tests and typecheck pass before implementation
  CHECK: npm test && npm run build && node -e "console.log('baseline server verification passed')"
  EXPECT: baseline server verification passed
  CWD: server
  EVIDENCE: baseline server suite/build completed before hardening; initial failures were stale audit-score expectations and destructive-migration validation, both addressed in the audit.

- [x] G2: Baseline client and admin builds pass before implementation
  CHECK: npm test && npm run build && node -e "console.log('baseline client verification passed')"
  EXPECT: baseline client verification passed
  CWD: client
  EVIDENCE: baseline client/admin tests and builds completed before final hardening.

- [x] G3: Migration validation rejects no unsafe pending migration
  CHECK: npm run db:validate-migration-chain && node -e "console.log('migration chain validation passed')"
  EXPECT: migration chain validation passed
  CWD: server
  EVIDENCE: exit=0; 63 migrations; pendingMigrations=[]; pendingDestructiveMigrations=[]; safeDeployAllowed=true. Additive refresh-session migration applied with db:migrate-startup-safe.

- [x] G4: Focused Instagram, webhook, billing, and auth regression tests pass after fixes
  CHECK: npm test -- src/modules/instagram src/modules/facebook/channel-keyword.test.ts src/modules/whatsapp/webhook-accept.test.ts src/modules/whatsapp/route-hardening.test.ts src/modules/billing src/modules/auth && node -e "console.log('focused regression verification passed')"
  EXPECT: focused regression verification passed
  CWD: server
  EVIDENCE: focused IG/webhook/billing/AI/auth suites passed; final auth/channel regression suite passed 3 files / 50 tests.

- [x] G5: Baseline admin tests and build pass
  CHECK: npm test && npm run build && node -e "console.log('baseline admin verification passed')"
  EXPECT: baseline admin verification passed
  CWD: admin
  EVIDENCE: 9 files / 19 tests passed; TypeScript and Vite build passed.

- [x] G6: Final server tests and build pass
  CHECK: npm test && npm run build && node -e "console.log('final server verification passed')"
  EXPECT: final server verification passed
  CWD: server
  EVIDENCE: final server suite passed 201 files / 1255 tests; TypeScript build passed after auth hardening.

- [x] G7: Final client tests and build pass
  CHECK: npm test && npm run build && node -e "console.log('final client verification passed')"
  EXPECT: final client verification passed
  CWD: client
  EVIDENCE: client suite/build passed; TypeScript compilation passed.

- [x] G8: Final admin tests and build pass
  CHECK: npm test && npm run build && node -e "console.log('final admin verification passed')"
  EXPECT: final admin verification passed
  CWD: admin
  EVIDENCE: admin suite 9 files / 19 tests and build passed.

- [x] G9: Runtime smoke exposes healthy API, UI, Admin, Redis, Postgres, and webhook challenge
  CHECK: bash start.sh
  EXPECT: runtime smoke verification passed
  CWD: .
  EVIDENCE: bash start.sh succeeded; API/database/Redis health passed with embedded workers; client :3000 and admin :3001 reachable; local and public ngrok webhook challenge returned ping.

- [x] G10: Customer-host and provider proofs are explicitly recorded
  EVIDENCE: unavailable external gates are explicit: no live signed Instagram DM/comment event, no customer-host restore drill, no live Razorpay subscription webhook/charge proof, no App Review/Advanced Access proof, and live WebRTC transfer remains deferred.

## Previously completed dashboard verification

- [x] legacy-dashboard-G1: channel hero source contracts are consistent and data-safe
  CHECK: node -e "const fs=require('fs'); const home=fs.readFileSync('client/src/components/dashboard/DashboardChannelHome.tsx','utf8'); const wa=fs.readFileSync('client/src/components/dashboard/WhatsAppConnectGuide.tsx','utf8'); const tabs=fs.readFileSync('client/src/components/dashboard/DashboardChannelTabs.tsx','utf8'); const art=fs.readFileSync('client/src/components/dashboard/InstagramHeroArt.tsx','utf8'); const css=fs.readFileSync('client/src/index.css','utf8'); const checks=[['hero height',/min-h-\[150px\].*sm:h-\[150px\]/s.test(home)&&/min-h-\[150px\].*sm:h-\[150px\]/s.test(wa)],['right artwork',/left-\[64%\]/.test(home)&&/left: 64%/.test(css)],['settings links',/settings\?tab=facebook/.test(home)&&/settings\?tab=instagram/.test(home)&&/settings\?tab=whatsapp/.test(wa)],['email disabled',/Email/.test(tabs)&&/aria-disabled=\"true\"/.test(tabs)],['instagram surfaces',/ig3d-card-surface/.test(art)&&/\.ig3d-card-surface/.test(css)],['empty states',/ChannelEmptyState/.test(home)],['WhatsApp loading art',/wa3d-loading-art/.test(wa)&&/wa3d-loading-art__cube/.test(css)],['post labels/caption',/label=\"Scheduled\"/.test(home)&&/label=\"Published\"/.test(home)&&/line-clamp-2/.test(home)]]; if(checks.some(([,ok])=>!ok)) { console.error(checks.filter(([,ok])=>!ok).map(([name])=>name).join(', ')); process.exit(1); } console.log('dashboard source contract verification passed');"
  EXPECT: dashboard source contract verification passed
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=dashboard source contract verification passed

- [x] legacy-dashboard-G2: client TypeScript compilation succeeds
  CHECK: npm exec tsc -- -b --pretty false && node -e "console.log('client TypeScript verification passed')"
  EXPECT: client TypeScript verification passed
  CWD: client
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/client; path=903aa5ef58f2/38 entries; output=client TypeScript verification passed

- [x] legacy-dashboard-G3: production client build succeeds
  CHECK: npm run build && node -e "console.log('client production build verification passed')"
  EXPECT: client production build verification passed
  CWD: client
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/client; path=903aa5ef58f2/38 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [x] legacy-dashboard-G4: final browser layout is visually reviewed
  EVIDENCE: Browser localhost:3000/?verify=unlazy-final reviewed after reload; WhatsApp hero measured 150px high, artwork occupies the right-middle region, Manage Connection is right-aligned and vertically centered, and four channel tabs measure equal widths with Email disabled/Coming soon. Screenshot: dashboard-channel-hero-unlazy.png
