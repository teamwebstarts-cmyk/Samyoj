# Phase 4 — Instagram inbox, comments, automations

**Ships:** IG DMs in their own inbox, a comments list, and Instagram as a channel on the **existing** Automations page.  
**Official:** [Private replies](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/private-replies) — one message, 7 days, then nothing until they reply. Live-comment private replies are only available during the broadcast. The current Page-linked example posts to `/<PAGE_ID>/messages`; do not hard-code an IG-ID path until the chosen login/API path is confirmed.

**Audit status (24 Sep 2026):** The HTTP admission, IG-only automation scope, ownership, timestamp, and private-reply claim boundaries are hardened and regression-tested. Treat live Instagram as unproven until a real signed Instagram event is observed.

## Do

- Connect the IG professional account **linked to the Page** (same Facebook Login). `Channel` platform `IG`.
- DMs: 24h window, text, human must stay available if a bot replies.
- Comments: list on the post. Action **Send private reply** once per comment.
- Confirm the required `instagram_manage_comments`, `pages_messaging`, Human Agent, Advanced Access, and Page-task gates before implementation; these are not inherited automatically from Phase 1.
- Automations stay on the main rail. Create asks **WhatsApp or Instagram**. IG trigger is comment keyword → one private reply. The WhatsApp keyword automation is not copied across.

## Don't

- Do not reuse a WhatsApp template, welcome, or away rule on Instagram.
- Do not treat the private reply as an open 24h chat.
- Do not make a blanket Meta claim about Ads Manager dark/unpublished posts. The current Meta private-reply documentation includes ads posts; the contrary restriction is vendor-specific/unverified here. Defer this case until the exact post type and vendor/API behavior are verified.
- Do not store story-mention media.
- Do not build Posts / Reels / stickers in this phase.
- Do not put Automations under the Instagram dropdown. The row lives outside; the channel is chosen inside.

## How it works

```text
DM     → instagram webhook messages → /instagram/inbox
Comment → comments webhook
        → agent or automation sends one private reply (comment_id)
        → if they reply in DM, 24h window starts, thread moves to Inbox
```

Message bot may answer that DM later, from **AI Bots → Message bot**, with a channel toggle. Calling bot never appears here.

## UI

| Screen | Pattern |
|--------|---------|
| Instagram → Inbox | Inbox clone. Pink 3px. No template button. Window pill = 24h. |
| Instagram → Comments | Same list pane, rows are comments: @name, text, **Reply in DM**, **Hide**. Not a chat bubble. |
| After one reply | Button becomes “Reply sent. Waiting for them.” |
| Automations | Existing card grid. New card **Instagram comment**. Badge on each card: WhatsApp or Instagram. |
| Composer on a comment-origin thread | “One private reply per comment. A 24h chat starts only after they reply.” |

## Test

- [ ] IG DM shows only in Instagram → Inbox.
- [ ] Comment “PRICE” sends one DM. Second click does not send.
- [ ] A WhatsApp keyword automation does not fire on that comment.
- [ ] User reply after the private DM opens a 24h thread.
- [ ] No WhatsApp template control on the IG composer.
- [ ] Ads/dark-post behavior is explicitly deferred until verified; no “Cannot automate this post” rule is shipped from the unverified vendor claim.
- [ ] A real Instagram webhook reaches `POST /api/whatsapp/webhook`, passes signature validation, and creates the expected IG-scoped event/thread.

## Competitors

Wati’s current official help describes an All Channels team inbox while keeping Instagram conversations identifiable/separate from WhatsApp. Samyoj’s separate inboxes remain a product decision, not a claim about Wati’s navigation. ManyChat’s channel-specific automation behavior should be treated as vendor-specific.
