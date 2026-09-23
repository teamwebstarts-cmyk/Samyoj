# Meta CRM vendors — sourced benchmark (2026-09-18)

**Rule:** Official vendor site / help / pricing only. Else **unverified**. Zapier is not native.  
**Samyoj today:** WhatsApp-only. None of the IG/FB/Ads cells below are in our code.  
**Companion plan:** [`META_ECOSYSTEM_V2_PLAN_2026-09-18.md`](META_ECOSYSTEM_V2_PLAN_2026-09-18.md)

Meta limits that apply to **everyone:** IG/Messenger ~24h window; IG private reply 1 DM / 7 days; App Review; ads still Meta-reviewed even if “launched in-product”; Instant Forms (`leadgen`) ≠ Click-to-WhatsApp.

---

## What actually ships (stakes)

| Stake | Documented yes | Missing / not native |
|-------|----------------|----------------------|
| WA + IG DM inbox | Respond.io, Wati, Interakt, SleekFlow, ManyChat, Zoko, Gallabox, Kommo, Chatwoot, Trengo | AiSensy = **WA inbox**; ads *on* IG, no official IG DM product page |
| IG comments in inbox / comment→DM | ManyChat, Wati, Respond.io, SleekFlow, Interakt Growth+, Gallabox, Kommo | Chatwoot: **explicitly no comments**. Trengo comments unverified |
| Native Instant Form (`leadgen`) ingest | Interakt, AiSensy, SleekFlow, Gallabox, Kommo | Respond.io **roadmap + Zapier**. Wati = Google Sheets. ManyChat/Trengo/Chatwoot = iPaaS or absent |
| In-product ads spend/CPL | AiSensy Ads Manager; Interakt CTWA launcher; Wati CTWA analytics (Business) | Most: click ID / Ad ID only. **Not** Ads Manager clones |
| Documented Ad→sale loop | Respond.io (click ID + Lifecycle + CAPI); Kommo (UTM + pipeline + CAPI); Wati (template CAPI + ROAS, with caveats) | Chatwoot **explicit no revenue** |
| Identity merge | Respond.io merge by phone/email; Wati IG↔WA **if phone matches**; Chatwoot merge API; ManyChat claims merge | Shared inbox ≠ 360. Zoko merge is Shopify |
| IG/FB **publishing** (posts/Reels/Stories) | **None of 11** | Trengo blog: use **Meta Business Suite** for publishing |

---

## Compact matrix

| Vendor | IG inbox | Lead Ads native | Ads spend UI | Merge | Comment→DM |
|--------|----------|-----------------|--------------|-------|------------|
| [Respond.io](https://respond.io/integrations/instagram) | yes | **no** ([roadmap](https://roadmap.respond.io/feature-request/p/integrate-with-facebook-lead-ads)) | attribution, ads in Meta | [yes](https://respond.io/help/contacts/contacts-overview) | yes |
| [Wati](https://support.wati.io/en/articles/11463166-instagram-in-wati-what-you-can-do) | yes (Pro for IG auto; Growth = **1 channel**) | **no** ([Sheets](https://www.wati.io/en/blog/facebook-lead-ads/)) | [CTWA Business](https://support.wati.io/en/articles/11463601-how-to-identify-and-track-click-to-whatsapp-ad-ctwa-conversations-in-wati) | [phone-link](https://support.wati.io/en/articles/11463002-how-to-use-the-multi-channel-team-inbox-in-wati) | yes |
| [Interakt](https://www.interakt.shop/resource-center/how-to-integrate-facebook-leads-form-with-interakt/) | WA+IG (Growth+) | **yes** | [CTWA launcher](https://www.interakt.shop/resource-center/click-to-whatsapp-ads-launcher/) | unverified | yes Growth+ |
| [AiSensy](https://aisensy.com/features/meta-lead-form-ads) | **no official IG inbox** | **yes** | in-product Ads Manager | unverified | unverified |
| [SleekFlow](https://sleekflow.io/en-us/blog/facebook-lead-ads) | yes | **yes** | no (funnel, not spend) | unverified | yes |
| [ManyChat](https://help.manychat.com/hc/en-us/articles/14281316989724-Instagram-Post-and-Reel-Comments-trigger) | yes | **no** Instant Forms | no | claimed | **deepest docs** |
| [Gallabox](https://docs.gallabox.com/integration/marketing-and-engagement-platforms/facebook-leads/send-automated-messages-on-whatsapp-to-facebook-leads) | [IG DMs](https://changelog.gallabox.com/august-2025/24-august-instagram-channel) | **yes** | CTWA + CAPI Essential+ | unverified | yes (AI credits) |
| [Kommo](https://support.kommo.com/docs/facebook-overview) | yes | **yes** | no (UTM+CAPI) | unverified | yes |
| [Chatwoot](https://www.chatwoot.com/features/instagram-integration) | DMs yes | **no** | **no** | yes | **no comments** |
| Zoko | IG $9.99 add-on | unverified | CTWA list | Shopify merge | paid flow |
| Trengo | DMs yes | **no** (iPaaS) | unverified | unverified | unverified |

Messenger as a first-class inbox: Respond.io, Wati, SleekFlow, ManyChat, Zoko, Kommo, Chatwoot, Trengo. Interakt/Gallabox/AiSensy: **unverified** as Messenger inbox.

---

## Hype vendors use (do not copy)

- Wati FAQ: Meta click/lead counts include people who **never message**; their CAPI is **template-tied**. ([CTWA FAQs](https://support.wati.io/en/articles/11865651-general-faqs-ctwa))
- ManyChat: comment private reply **does not** open 24h until the user taps; ManyChat documents an Ads Manager **dark-post selection limitation** for its own trigger, not a universal Meta prohibition.
- Interakt: if they create the ad account, metrics may live **only in Interakt**, not Ads Manager.
- AiSensy “Instagram CRM” = ads on Instagram + WA inbox, not an IG DM product page.
- Chatwoot “social inbox” = DMs. Comments: no.
- Wati Growth is **one channel**, not omnichannel.
- Respond.io Lead Ads is **planned**, not shipped.

**Complaints (thin HTML this session):** Wati Capterra — cost, annual lock, multi-number pain. AiSensy G2 — delivery + after-hours. Chatwoot GitHub [#14932](https://github.com/chatwoot/chatwoot/issues/14932) — IG Cloud `code 100` / Meta token failures. Many G2 pages Cloudflare-blocked → **unverified**.

---

## Per vendor — copy vs skip (important only)

| Vendor | Copy (documented) | Skip |
|--------|-------------------|------|
| **Respond.io** | Merge by phone/email; save click ID when the chat opens; Lifecycle + **Send CAPI Event** workflow; Paid Ads Attribution is *post-click funnel*, ads stay in Ads Manager | Native Lead Ads (still [roadmap](https://roadmap.respond.io/feature-request/p/integrate-with-facebook-lead-ads)); treating Lifecycle as a full deal-amount CRM |
| **Wati** | [Linked chats](https://support.wati.io/en/articles/11463002-how-to-use-the-multi-channel-team-inbox-in-wati) when IG collects a phone that matches WA; CTWA conversation tracking; help that admits Meta click inflation | Selling Growth as omnichannel (**1 channel**); Lead Ads via [Sheets](https://www.wati.io/en/blog/facebook-lead-ads/); CAPI only on **template send** as “purchase” |
| **Interakt** | Native [FB Lead Form → contacts + WA](https://www.interakt.shop/resource-center/how-to-integrate-facebook-leads-form-with-interakt/); IG comment keyword → card (Growth+) | In-app CTWA **create** as v1 (Meta still reviews; their-created ad accounts may not show in Ads Manager); CRM as a **second SKU** if we already have `Lead` |
| **AiSensy** | Native Lead Form Ads + CTWA Insights (spend/CPL) | “Instagram CRM” without an IG DM product page; Forever Free as “full WA API” (1 agent, credits extra) |
| **SleekFlow** | Native Lead Ads + Form ID column for ROI math the user does | Spend/CPL Ads Manager UI they don’t have |
| **ManyChat** | Comment→DM + story mention/reply **with written 24h rules**; public profiles for mentions | Instant Forms (iPaaS); WA CRM depth; publishing; its vendor-specific dark-ad trigger limitation |
| **Gallabox** | WA+IG on Basic; Source = CTWA, Source ID = **Ad ID**; native FB Leads → WA template | Gating CAPI as if it were the only “real analytics”; Messenger inbox unverified |
| **Kommo** | Messaging **on a pipeline card**; Lead Ads; UTM on CTWA; CAPI on stage change | Expecting BSP-style WA broadcasts from a CRM |
| **Chatwoot** | Merge contacts API; cheap omnichannel **DMs** | Comments, ads, revenue (they say no); GitHub IG `code 100` outages |
| **Zoko** | Shopify merge honesty; IG as add-on | In-Zoko identity graph; treating labels as a full CRM |
| **Trengo** | Inbox for DMs; **publishing stays in Meta Suite** | Native Lead Ads; conversation-meter surprise pricing |

---

## Failure modes we will hit (they already did)

1. **24h / 7-day window** — extra IG DMs without a user tap fail delivery + policy.  
2. **App Review / tokens** — Chatwoot Cloud IG died on Meta `code 100`. Same stack for us.  
3. **Attribution vanity** — last-click CTWA ≠ sale. Need CRM Won + optional CAPI Purchase.  
4. **Lead Ads vs CTWA on one screen** — Instant Form may have no valid phone; CTWA may have no form fields.  
5. **Dark / boosted-only creatives** — restrictions are vendor-specific and remain unverified here; current Meta private-reply documentation includes ads posts. Defer the product rule until the exact post type and vendor/API behavior are confirmed.  
6. **IGSID ≠ phone** — without merge UI, Customer 360 duplicates.  
7. **Plan-gate surprises** — don’t hide IG/CAPI behind a SKU name that sounds included.

---

## Samyoj implication

1. **Catch Respond.io/Wati on inbox** (WA+IG+Messenger + comment→DM + phone merge). That is table stakes.  
2. **Beat Respond.io/Wati on native Lead Ads** — they do not ship `leadgen`; Interakt/Gallabox/Kommo/SleekFlow/AiSensy do. Our Phase 1 is this gap.  
3. **Do not clone Ads Manager.** Even AiSensy/Interakt still pass Meta review. v1 = ingest + CTWA chip + Insights **read**.  
4. **Do not build a content studio to catch up.** Eleven inboxes skipped publishing. Defer to Later; Meta Business Suite already exists.  
5. **Keep Lead Ads and CTWA as two products** (Instant Form vs click-to-chat). Mixing them is how CPL lies.  
6. **Customer 360 = our merge** (phone/email/agent), same as Wati/Respond.io. Meta will not join IGSID to `wa_id`.
