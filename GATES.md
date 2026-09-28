# Gates: dashboard channel hero completion

OWNS: client/src/components/dashboard/**, client/src/index.css

Scope: finish and verify the shared WhatsApp, Facebook, and Instagram dashboard hero, loading, empty-state, and channel-tab refinements.

- [x] G1: channel hero source contracts are consistent and data-safe
  CHECK: node -e "const fs=require('fs'); const home=fs.readFileSync('client/src/components/dashboard/DashboardChannelHome.tsx','utf8'); const wa=fs.readFileSync('client/src/components/dashboard/WhatsAppConnectGuide.tsx','utf8'); const tabs=fs.readFileSync('client/src/components/dashboard/DashboardChannelTabs.tsx','utf8'); const art=fs.readFileSync('client/src/components/dashboard/InstagramHeroArt.tsx','utf8'); const css=fs.readFileSync('client/src/index.css','utf8'); const checks=[['hero height',/min-h-\[150px\].*sm:h-\[150px\]/s.test(home)&&/min-h-\[150px\].*sm:h-\[150px\]/s.test(wa)],['right artwork',/left-\[64%\]/.test(home)&&/left: 64%/.test(css)],['settings links',/settings\?tab=facebook/.test(home)&&/settings\?tab=instagram/.test(home)&&/settings\?tab=whatsapp/.test(wa)],['email disabled',/Email/.test(tabs)&&/aria-disabled=\"true\"/.test(tabs)],['instagram surfaces',/ig3d-card-surface/.test(art)&&/\.ig3d-card-surface/.test(css)],['empty states',/ChannelEmptyState/.test(home)],['WhatsApp loading art',/wa3d-loading-art/.test(wa)&&/wa3d-loading-art__cube/.test(css)],['post labels/caption',/label=\"Scheduled\"/.test(home)&&/label=\"Published\"/.test(home)&&/line-clamp-2/.test(home)]]; if(checks.some(([,ok])=>!ok)) { console.error(checks.filter(([,ok])=>!ok).map(([name])=>name).join(', ')); process.exit(1); } console.log('dashboard source contract verification passed');"
  EXPECT: dashboard source contract verification passed
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=dashboard source contract verification passed

- [x] G2: client TypeScript compilation succeeds
  CHECK: npm exec tsc -- -b --pretty false && node -e "console.log('client TypeScript verification passed')"
  EXPECT: client TypeScript verification passed
  CWD: client
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/client; path=903aa5ef58f2/38 entries; output=client TypeScript verification passed

- [x] G3: production client build succeeds
  CHECK: npm run build && node -e "console.log('client production build verification passed')"
  EXPECT: client production build verification passed
  CWD: client
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/client; path=903aa5ef58f2/38 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [x] G4: final browser layout is visually reviewed
  EVIDENCE: Browser localhost:3000/?verify=unlazy-final reviewed after reload; WhatsApp hero measured 150px high, artwork occupies the right-middle region, Manage Connection is right-aligned and vertically centered, and four channel tabs measure equal widths with Email disabled/Coming soon. Screenshot: dashboard-channel-hero-unlazy.png
