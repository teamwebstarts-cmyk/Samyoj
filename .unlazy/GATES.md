# Gates: Instagram comments recheck

OWNS: .unlazy/**

Scope: Prove the comments list, history sync, and keyword reply paths that are in the repo, and record the Meta subscribe failure that code cannot clear.

- [x] G1: comments list pages at 25, filters on the server, history sync does not auto-reply, and stored customer comments exist
  CHECK: node verify-ig-comments.mjs
  EXPECT: ig comment contract passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy; path=903aa5ef58f2/38 entries; output=customer comments 18 | ig comment contract passed

- [x] G2: Instagram comment unit tests pass
  CHECK: node verify-ig-tests.mjs
  EXPECT: ig comment tests passed
  EVIDENCE: exit=0; shell=/bin/sh; cwd=/workspaces/Samyoj/.unlazy; path=903aa5ef58f2/38 entries; output=Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning. | ig comment tests passed

- [ ] G3: Instagram account webhook subscribe succeeds for this connected account
  EVIDENCE: pending

ABANDON: G3 Meta still returns (#3) Application does not have the capability on POST /{ig-user-id}/subscribed_apps for messages,comments. Comments already arrive because the app is Published. This is not fixable in the Samyoj repo.
