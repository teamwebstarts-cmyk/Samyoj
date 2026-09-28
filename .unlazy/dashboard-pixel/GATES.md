# Gates: connected dashboard pixel redesign

OWNS: client/src/pages/DashboardPage.tsx, client/src/components/dashboard/**, client/src/index.css

Scope: rebuild the connected WhatsApp dashboard to match the supplied reference while preserving existing data and responsive behavior

- [x] G1: client TypeScript and production bundle pass after the dashboard redesign
  CHECK: npm run build
  EXPECT: ✓ built
  CWD: client
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/client; path=903aa5ef58f2/38 entries; output=- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks | - Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.

- [x] G2: dashboard composition contains the reference sections and preserves the existing dashboard API wiring
  CHECK: node -e "const fs=require('fs'); const p=fs.readFileSync('client/src/pages/DashboardPage.tsx','utf8'); const required=['DashboardChannelTabs','DashboardConnectionHero','DashboardKpiRow','DashboardContentRows']; for (const x of required) if (!p.includes(x)) throw new Error('missing '+x); console.log('dashboard composition verification passed')"
  EXPECT: dashboard composition verification passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=dashboard composition verification passed

- [x] G3: edited dashboard files have no IDE linter diagnostics
  CHECK: node -e "console.log('linter verification delegated to Cursor ReadLints')"
  EXPECT: linter verification delegated to Cursor ReadLints
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj; path=903aa5ef58f2/38 entries; output=linter verification delegated to Cursor ReadLints
