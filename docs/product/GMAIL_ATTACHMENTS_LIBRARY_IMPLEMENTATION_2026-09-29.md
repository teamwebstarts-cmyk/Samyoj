# Gmail attachments and template library implementation

**Status:** Implemented in code; customer production remains gated  
**Date:** 2026-09-29

## Shipped behavior

- Gmail Connect is a separate OAuth flow from Google login.
- The connection requests only `openid`, `email`, and `https://www.googleapis.com/auth/gmail.send`.
- Mail is sent through Gmail `users.messages.send` using RFC 2822 MIME and base64url encoding.
- The server stores encrypted mailbox tokens and organization-scoped send/template records.
- Compose sends to one eligible contact at a time: a saved email address, explicit email consent source/version/time, and no email opt-out.
- Contact and send operations follow the active WhatsApp workspace; missing or ambiguous workspace scope fails closed.
- Compose supports private attachments only:
  - up to 5 files
  - up to 15 MB per file
  - up to 20 MB decoded MIME total, including message overhead
  - allowlisted MIME types with filename and magic-byte validation
  - upload progress, cancellation, removal, and upload errors
- Templates and the 12-entry library never contain attachments. Library entries are read-only until “Copy and edit” creates an organization-owned template.
- User-visible success wording is **Accepted by Gmail**. The product does not claim delivery, inbox placement, opens, reads, replies, or bounces.

## OAuth and release gates

Before external customer rollout:

1. Use separate Google Cloud testing and production projects.
2. Configure exact HTTPS redirect URIs and owned domains.
3. Complete Google's sensitive-scope verification for `gmail.send`; Google currently says this typically takes 3–5 business days, but approval is not guaranteed.
4. Add internal test users while the testing project is unpublished. Testing refresh tokens can expire after 7 days.
5. Provide privacy, support, and user-data disclosures covering stored subject/body/send logs, encrypted tokens, attachment retention, and deletion.
6. Tell Workspace customers that an administrator may need to allow the app in Admin Console → Security → API controls → App access control.
7. Test a real Gmail send, quota/rate-limit handling, revoked-token reconnect, attachment cleanup, and the accepted/failed sent-log states.

Google's mailbox limits are external and can change. The UI explains approximately 500 messages/day for free Gmail and 2,000/day for paid Workspace; it does not show a fabricated remaining quota.

## Verification commands

```text
cd server && npm test -- --run src/modules/gmail
cd server && npx prisma validate
cd server && npm run db:validate-migration-chain
cd client && npm test -- --run src/components/email/emailData.test.ts
npm run build
cd client && npm run build
```

No Gmail provider call is made by local tests. A real-mail test remains a release prerequisite.
