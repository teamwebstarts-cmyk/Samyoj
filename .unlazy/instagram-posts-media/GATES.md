# Gates: Instagram Reels, Carousel, remote post automation

OWNS: server/prisma/schema.prisma, server/prisma/migrations/**, server/src/modules/instagram/posts.*, client/src/pages/InstagramPostsPage.tsx, client/src/pages/instagram-posts.css, client/src/services/api.ts, client/src/utils/metaMockData.ts, .unlazy/instagram-posts-media/**

Scope: Samyoj Instagram Posts support image, Reels (video), and carousel publishing; media upload for video; limits tests; connected-account media library for comment/DM automation on existing IG posts.

- [x] G1: Post limits and media payload validation tests pass
  CHECK: node verify-posts-media.mjs
  EXPECT: ig posts media verification passed
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/instagram-posts-media; path=903aa5ef58f2/38 entries; output=Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning. | ig posts media verification passed

- [x] G2: Server TypeScript compiles with new post fields and publish paths
  CHECK: node verify-server-tsc.mjs
  EXPECT: server tsc ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/instagram-posts-media; path=903aa5ef58f2/38 entries; output=server tsc ok

- [x] G3: Client TypeScript compiles for updated Posts page API types
  CHECK: node verify-client-tsc.mjs
  EXPECT: client tsc ok
  CWD: .
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy/instagram-posts-media; path=903aa5ef58f2/38 entries; output=client tsc ok
