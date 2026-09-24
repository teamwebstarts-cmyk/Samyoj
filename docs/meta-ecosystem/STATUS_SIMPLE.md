# Ab kya hai (24 Sep 2026)

Detailed audit: [META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md](META_ECOSYSTEM_AUDIT_REPORT_2026-09-24.md).
Saved Meta dashboard evidence: [META_APP_CONFIGURATION_2026-09-24.md](META_APP_CONFIGURATION_2026-09-24.md).

Code plan ke hisaab se **0–5** tak ka scope harden kiya gaya hai. Instagram `object` HTTP route, IG-only automation, channel ownership, comment timing/private-reply claim, Lead Ads attribution IDs, Ads account selection, and channel-specific inbox UI are now covered by code/tests. **Live Facebook Page / Instagram / Ads abhi proven nahi.** Meta app **Development** mode mein hai.

## Facebook Page connect kyun fail ho sakta hai

The 24 Sep dashboard screenshots show Page permissions/use cases configured for testing, but
`instagram_basic` and `instagram_manage_messages` still show **Add to App**; 
`instagram_manage_comments` is not visibly confirmed. The full OAuth request includes these
Instagram scopes, so reconnect can still fail with Invalid Scopes even when the existing Page
connection remains usable. See the saved configuration record for the exact evidence and the
recommended Facebook-now / Instagram-next decision.

Screenshot wala error Facebook ka hai:

`Invalid Scopes: pages_show_list, pages_manage_metadata, pages_read_engagement, pages_messaging, leads_retrieval`

Naam sahi hain. Live app (WhatsApp wala, `META_APP_ID`) pe yeh privileges **rejected** hain: `pages_show_list`, `pages_manage_metadata`, `pages_read_engagement`, `pages_messaging`, `leads_retrieval`, `ads_read`. `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments` app pe hain hi nahi. Webhook sirf `whatsapp_business_account` pe subscribed hai. App Review inko approve kiye bina OAuth dialog Invalid Scopes dikhata rahega — code se grant nahi hota.

**Fix (developers.facebook.com, wahi app):**

1. Use cases add karo, phir Standard access:
   - Capture & manage ad leads (`leads_retrieval`, `pages_show_list`, `pages_manage_metadata`)
   - Engage with customers on Messenger (`pages_messaging`, `pages_read_engagement`)
   - Instagram messaging / comments (`instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`)
   - Ads read only (`ads_read`). `ads_management` mat add karo — Samyoj ads create/pause nahi karta.
2. Facebook Login → Valid OAuth Redirect URIs mein yeh **HTTPS** URI add karo (aaj missing hai):
   `https://app.samyoj.com/settings/facebook/callback`
   Dev preview: `https://<codespace>-3000.app.github.dev/settings/facebook/callback`
   `http://localhost` Facebook finish nahi karta. Connect button us tab pe rok deta hai aur HTTPS preview batata hai.
3. Jo Facebook account Connect pe click kare, woh app ka Admin/Dev/Tester ho, aur Page ka admin ho.
4. Samyoj → Settings → Facebook Page → **Connect Page**. Phir Settings → Instagram → **Connect Instagram**.
5. App webhook objects `page` (`leadgen,messages`) aur `instagram` (`messages,comments,live_comments`) same callback pe subscribe karo. Aaj sirf WhatsApp object hai.

## Sidebar

**Dropdown rows.** Child selected ho to parent fill nahi hota — ek hi active pill. WhatsApp parent = brand glyph, Inbox = message icon.

Sidebar bottom card **and** Dashboard WhatsApp connection card (number ke neeche): **Facebook Connect Page** + **Instagram Connect IG** icons. Admin/Owner only. Connected chips open that inbox. No App ID. OAuth return stays on the same screen (`/` if you started from Dashboard).

| Sidebar | Route |
|---------|--------|
| WhatsApp → Inbox / Calls / Templates / Campaigns | `/inbox` … |
| Facebook → Inbox / Ads | `/facebook/inbox`, `/facebook/ads` |
| Instagram → Inbox / Comments | `/instagram/inbox`, `/instagram/comments` |
| AI Bots, Contacts, Automations, Tickets, Team, Billing, Settings | bahar |
| Leads | Contacts pipeline, sidebar nahi |
| Ads / Posts / Reels | Ads read-only under Facebook. Posts / Reels nahi |

## Plan vs abhi

| Phase | Plan | Code | Live Meta |
|-------|------|------|-----------|
| 0 Foundation | Page/Instagram webhook WhatsApp Inbox mein na gire | Code + regression coverage | Live signed delivery pending |
| 1 Lead Ads | Connect Page + Instant Form → Contacts | Done in code; form/ad/adset/campaign IDs retained | Blocked: scopes + Page webhook |
| 2 CTWA | Ad click → WhatsApp thread pe pill | Done in code | Real ad click pending |
| 3 Messenger | Facebook → Inbox, 24h text | Done in code | Blocked: scopes + Page |
| 4 Instagram | Inbox + comments + comment-keyword | Code + regression coverage; live delivery pending | Blocked: Page-linked IG + scopes |
| 5 Ads read | Facebook → Ads | Read-only snapshot + explicit account picker | Blocked: `ads_read` + ad account on the Page |
| 6 Analytics | Do column, fake ROI nahi | Nahi | — |
| 7 Portfolio | Settings mein saari connections | Nahi | — |

## Phase 4 kya hai / kya nahi

Hain: Page-linked IG `Channel`, DMs `/instagram/inbox`, comments list + one private reply (7 days), Automations KEYWORD + `config.platform=IG`. WhatsApp keyword IG pe nahi chalta.

Nahi: Posts / Reels, Ads Manager editor, WA templates on IG, Instagram Login (IGSID-only), live transfer, TARGET billing.

## Phase 5 kya hai / kya nahi

Hain: `GET /api/facebook/ads-summary` reads Meta Insights (last 7 days, **7-day click / 1-day view**), one snapshot per org, Facebook → Ads tiles, Dashboard recap from that same payload, **Open Ads Manager**.

Nahi: create / pause / budget, `ads_management`, spend inside the Samyoj plan price, CPL mixed with WhatsApp or Won. No ad account → message, not a ₹0 chart. Reconnect the Page once so `ads_read` is granted.

## Abhi mat socho yeh done

- Real Page connect + linked IG professional account
- Test user IG DM + comment PRICE
- App Review + Business Verification (customers)
- Real Lead Ads, Messenger, Ads Insights, and new WhatsApp inbound proof
- Customer production
