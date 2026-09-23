# Ab kya hai (23 Sep 2026)

Code plan ke hisaab se 0–3 tak hai. **Live Facebook Page abhi connect nahi hua.** Yeh Samyoj ka crash nahi hai.

## Facebook Page connect kyun fail hua

Screenshot wala error Facebook ka hai:

`Invalid Scopes: pages_show_list, pages_manage_metadata, pages_read_engagement, pages_messaging, leads_retrieval`

Naam sahi hain. Hamara **WhatsApp wala Meta app** in permissions ko support nahi karta. App pe abhi WhatsApp permissions hain. Page / Messenger / Lead Ads use-case add nahi hai. Isliye Facebook developer ko login rok deta hai.

**Fix (developers.facebook.com, wahi app jo WhatsApp connect karta hai):**

1. Use cases add karo:
   - Capture & manage ad leads
   - Engage with customers on Messenger
2. In permissions ko Standard access do (Development mode ke liye kaafi):  
   `pages_show_list` · `pages_manage_metadata` · `pages_read_engagement` · `pages_messaging` · `leads_retrieval`
3. Facebook Login → Valid OAuth Redirect URIs:  
   `http://localhost:3000/settings/facebook/callback`  
   (agar Codespace URL se kholte ho to woh origin bhi)
4. Jo Facebook account Connect pe click kare, woh app ka Admin/Dev/Tester ho, aur Page ka admin ho.
5. Samyoj → Settings → Facebook Page → **Connect Page** dubara.

App Review customers ke liye baad mein. Local test ke liye use-case + role kaafi hai.

**Kaise connect hota hai (jab scopes lag jayein):**  
Settings → Facebook Page → Connect Page → Facebook login → Page choose → Connected. Instant Form ke liye `leadgen`, Messenger ke liye `messages`.

## Sidebar

**Bana hua hai.** Click-wale dropdown (▾) nahi — hamesha-khuli groups, rang ki 3px line.

| Sidebar | Route |
|---------|--------|
| WhatsApp → Inbox / Calls / Templates / Campaigns | `/inbox` … |
| Facebook → Leads | `/contacts?tab=pipeline&source=META_ADS` |
| Facebook → Inbox | `/facebook/inbox` |
| AI Bots, Contacts, Automations, Tickets, Team, Billing, Settings | bahar |
| Instagram | nahi — Phase 4 |

Collapsed sidebar mein **FB** dekho, ya expand karke scroll.

## UI khaali kyun lagti hai

Page connect nahi, isliye asli lead / Messenger thread nahi. **Koi sample row nahi.** Lists empty rahengi jab tak live data aaye.

WhatsApp ad pill tab dikhegi jab asli ad click se message aaye.

## Plan vs abhi

| Phase | Plan | Code | Live Meta |
|-------|------|------|-----------|
| 0 Foundation | Page webhook WhatsApp Inbox mein na gire | Done | — |
| 1 Lead Ads | Connect Page + Instant Form → Facebook → Leads | Done | Blocked: scopes |
| 2 CTWA | Ad click → WhatsApp thread pe pill | Done | Real ad click pending |
| 3 Messenger | Facebook → Inbox, 24h text | Done | Blocked: scopes + Page |
| 4 Instagram | Inbox + comments | Nahi | — |
| 5 Ads read | Facebook → Ads | Nahi | — |
| 6 Analytics | Do column, fake ROI nahi | Nahi | — |
| 7 Portfolio | Settings mein saari connections | Nahi | — |

Plan se missing nahi (0–3). UI group hai, dropdown chevron nahi. Instagram / Ads / Posts jaan-bujh kar baad mein.

## Abhi mat socho yeh done

- Real Page connect
- Meta Lead Ads test tool se ek asl lead
- Asli CTWA ad click
- Page pe test user ka DM
- App Review + Business Verification (customers)
- Customer production
