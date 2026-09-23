# Ab kya hai (24 Sep 2026)

Code plan ke hisaab se **0–4** tak hai. **Live Facebook Page / Instagram abhi customer host pe proven nahi.** Yeh Samyoj ka crash nahi hai.

## Facebook Page connect kyun fail ho sakta hai

Screenshot wala error Facebook ka hai:

`Invalid Scopes: pages_show_list, pages_manage_metadata, pages_read_engagement, pages_messaging, leads_retrieval`

Naam sahi hain. Hamara **WhatsApp wala Meta app** in permissions ko support nahi karta jab tak use-cases add na hon. Instagram ke liye extra: `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`.

**Fix (developers.facebook.com, wahi app jo WhatsApp connect karta hai):**

1. Use cases add karo:
   - Capture & manage ad leads
   - Engage with customers on Messenger
   - Instagram messaging / comments (Page-linked)
2. In permissions ko Standard access do (Development mode ke liye kaafi).
3. Facebook Login → Valid OAuth Redirect URIs:  
   `http://localhost:3000/settings/facebook/callback`
4. Jo Facebook account Connect pe click kare, woh app ka Admin/Dev/Tester ho, aur Page ka admin ho.
5. Samyoj → Settings → Facebook Page → **Connect Page**. Phir Settings → Instagram → **Connect Instagram**.

## Sidebar

**Dropdown rows.** Child selected ho to parent fill nahi hota — ek hi active pill. WhatsApp parent = brand glyph, Inbox = message icon.

Sidebar bottom card **and** Dashboard WhatsApp connection card (number ke neeche): **Facebook Connect Page** + **Instagram Connect IG** icons. Admin/Owner only. Connected chips open that inbox. No App ID. OAuth return stays on the same screen (`/` if you started from Dashboard).

| Sidebar | Route |
|---------|--------|
| WhatsApp → Inbox / Calls / Templates / Campaigns | `/inbox` … |
| Facebook → Inbox | `/facebook/inbox` |
| Instagram → Inbox / Comments | `/instagram/inbox`, `/instagram/comments` |
| AI Bots, Contacts, Automations, Tickets, Team, Billing, Settings | bahar |
| Leads | Contacts pipeline, sidebar nahi |
| Ads / Posts / Reels | nahi — Phase 5+ |

## Plan vs abhi

| Phase | Plan | Code | Live Meta |
|-------|------|------|-----------|
| 0 Foundation | Page webhook WhatsApp Inbox mein na gire | Done | — |
| 1 Lead Ads | Connect Page + Instant Form → Contacts | Done | Blocked: scopes |
| 2 CTWA | Ad click → WhatsApp thread pe pill | Done | Real ad click pending |
| 3 Messenger | Facebook → Inbox, 24h text | Done | Blocked: scopes + Page |
| 4 Instagram | Inbox + comments + comment-keyword | Done in code | Blocked: Page-linked IG + scopes |
| 5 Ads read | Facebook → Ads | Nahi — next | — |
| 6 Analytics | Do column, fake ROI nahi | Nahi | — |
| 7 Portfolio | Settings mein saari connections | Nahi | — |

## Phase 4 kya hai / kya nahi

Hain: Page-linked IG `Channel`, DMs `/instagram/inbox`, comments list + one private reply (7 days), Automations KEYWORD + `config.platform=IG`. WhatsApp keyword IG pe nahi chalta.

Nahi: Posts / Reels, Ads Manager, WA templates on IG, Instagram Login (IGSID-only), live transfer, TARGET billing.

## Abhi mat socho yeh done

- Real Page connect + linked IG professional account
- Test user IG DM + comment PRICE
- App Review + Business Verification (customers)
- Customer production
