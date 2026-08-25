# L9 — WhatsApp Business Calling API (permissions, settings, WebRTC)

**Leaf:** `09-calling.md` · Meta literacy (not a ship checklist)  
**Researched:** 2026-08-25 · Sources: Meta Cloud API Calling docs (see Official URLs)  
**Hinglish TL;DR:** WhatsApp pe business ko **call** karwana alag product hai messaging se. Signaling Meta ke Graph/webhooks (ya SIP) se; **media** WebRTC (ICE + DTLS + SRTP). SaaS usually **inbound AI voice + agent ring** ship karta hai; **live human transfer on same media path** aur full BIC permission UX alag Phase-2 kaam hai.

---

## 1. Kya hai Calling API?

WhatsApp Business **Calling API** = Cloud API number pe **VoIP voice** (aur docs mein video\* / screen-share\* roadmap) — user WhatsApp app se call karta/leti hai, business apna backend (WebRTC ya SIP PBX) se answer karta hai.

Do initiation paths:

| Path | Kaun start karta hai | Permission? | Meta fee (high level) |
|------|----------------------|-------------|------------------------|
| **User-initiated (UIC)** | WhatsApp user → business | Nahi (user khud call kar raha) | **Free** |
| **Business-initiated (BIC)** | Business → user | **Haan** — explicit call permission | **Paid** (6-sec pulses, country + volume tier) |

\*Video / rich features docs mein advertised; integration depth product-dependent. Treat voice as the production baseline.

---

## 2. Prerequisites (enable se pehle)

Official “get started” checklist (short):

1. Number **Cloud API** pe ho (WhatsApp Business *App* nahi).
2. App subscribe to webhook field **`calls`** (SIP path except — see §6).
3. Same app WABA pe subscribed + `whatsapp_business_messaging`.
4. Daily messaging limit **≥ 2,000** unique recipients.
5. Phone number pe Calling **`status: ENABLED`** (`POST /{PHONE_NUMBER_ID}/settings`).
6. BIC ke liye WABA pe **valid payment method**.

Test / sandbox: Calling default **off** on public test numbers — settings se enable karna padta hai; PTN pe kuch limits relaxed.

---

## 3. Call permissions (BIC ka dil)

**Rule:** Business user ko call kar sake **sirf** jab user ne call permission di ho. Business control nahi karta — user grant/revoke anytime (business profile pe bhi).

### 3.1 Temporary vs permanent

| Type | Expiry | Notes |
|------|--------|--------|
| **Temporary** | **7 calendar days** (168h) from approval | Same connected-call limits apply |
| **Permanent** | No auto-expiry until user revokes | Available since **2025-11-03**; request again → error `138017` |

Per business↔user pair (approx production):

- Max **100 connected BIC** / 24h (raised from 10 — Dec 2025 changelog).
- Permission **request** rate: **1 / 24h**, **2 / 7 days** (free-form *or* template). Connected call (UIC or BIC) resets request counters.
- **2** consecutive unanswered BIC → system nudge to reconsider permission.  
- **4** consecutive unanswered → permission **auto-revoked**.

### 3.2 Permission kaise milti hai

1. **Send request message** — interactive `type: call_permission_request` (CSW free-form) **ya** template with `call_permission_request` component (outside CSW). Messaging charges apply to the request message.
2. **Callback permission** — user business ko call kare; agar `callback_permission_status: ENABLED`, temporary permission auto-prompt / grant path.
3. **Business profile** — user manually allow calls.

API: `GET` current permission state per user (actions like `send_call_permission_request` / `start_call` + limits). Webhook: user accept/reject + `is_permanent` + expiry.

**Key errors:** `138006` / `403` no approved permission; `138009` request rate limit; `138012` BIC daily connected limit; `138013` BIC not available for this number’s country; `138017` permanent already exists.

---

## 4. Call settings (phone-number level)

Endpoint: **`POST /{PHONE_NUMBER_ID}/settings`** with `"calling": { ... }`.  
Client UI sync: users may take **up to ~7 days** to reflect icon changes; **server always honors** config.

| Setting | Meaning (product view) |
|---------|------------------------|
| `status` | `ENABLED` / `DISABLED` — master switch + call icon on chat/profile |
| `call_icon_visibility` | `DEFAULT` show icon; `DISABLE_ALL` hide unsolicited entry points (CTA / deep-link calls still possible) |
| `call_icons.restrict_to_user_countries` | Icon only for users whose **registered** country is in list |
| `call_hours` | Timezone + weekly hours + holidays → UIC blocked off-hours; chat / callback option if callback enabled |
| `callback_permission_status` | After miss/connect, prompt user for call permission |
| `sip` | Switch signaling to SIP (mutually exclusive with Graph call actions by default) |
| `audio.additional_codecs` | Opus default; optional **PCMA/PCMU** (G.711) for PBX interop (Mar 2026+) |
| `voicemail` | Missed/rejected UIC → announcement media + triggers `REJECT` / `TIMEOUT` |

**Quality / policy pauses (automatic ~7 days):**

- High negative feedback → `RESTRICTED_BUSINESS_INITIATED_CALLING` and/or `RESTRICTED_USER_INITIATED_CALLING`.
- Low pickup rates → call button hidden (`RESTRICTED_USER_INITIATED_CALLING_CALL_BUTTON_HIDDEN`).

GET settings returns `restrictions` / `restriction_info` when paused.

---

## 5. WebRTC notes (high level — no media cookbook)

Default stack after enabling Calling:

| Layer | Default |
|-------|---------|
| Signaling | HTTPS Graph API + **`calls` webhooks** |
| Media | **WebRTC**: ICE + DTLS + SRTP |
| Audio | **OPUS** (48 kHz media clock; DTMF 8 kHz; typical `ptime` 20ms) |
| Alt signaling | **SIP over TLS** → Meta domain `wa.meta.vc` |
| Alt media (SIP path) | WebRTC **or** SDES-SRTP (explicit enable) |

### 5.1 User-initiated (inbound) mental model

```
User taps call
  → Call Connect webhook (SDP offer + call_id)
  → Business WebRTC builds SDP answer
  → POST /calls action=pre_accept (recommended)  // ICE/DTLS warm-up, no media yet
  → Agent/AI ready → POST /calls action=accept
  → Wait 200 OK → then send media
  → Hangup → terminate webhook (duration, etc.)
```

- **pre_accept** = connection pehle; audio clipping kam. Media **sirf** after accept `200`.
- Agar IVR turant play karta hai aur timing control nahi → seedha `accept`.
- Timeout: business ~**60s** mein accept na kare → user side “Not Answered” + terminate webhook.
- Actions: `pre_accept` | `accept` | `reject` | `terminate`.

### 5.2 Business-initiated (outbound) mental model

```
Permission OK?
  → POST /calls action=connect + session { sdp_type: offer, sdp }
  → Connect webhook with SDP answer
  → Apply answer to WebRTC stack
  → Status webhooks: RINGING / ACCEPTED / REJECTED
  → terminate (either side)
```

### 5.3 SDP / media hygiene (remember, don’t invent)

- SDP **RFC 8866**; single audio stream / single SSRC (Meta rewrites business SSRC on relay).
- CRLF line endings inside SDP string; don’t double-JSON-encode.
- DTLS fingerprint required for DTLS-SRTP path.
- Optional G.711 only if enabled in call settings — still treat Opus as default for WhatsApp client.

**SaaS implication:** Browser agent desk = WebRTC peer in tab; AI bot = server-side WebRTC + STT/TTS bridge. “Live transfer” = moving **same** media session (or renegotiating) to a human peer — **hard**; many products stub to WhatsApp text handoff.

---

## 6. SIP path (optional)

- Enable `calling.sip.status: ENABLED` + one SIP server hostname/port.
- App must be **Live**; TLS mandatory; Meta challenges BIC INVITEs with digest auth.
- When SIP on: **Graph calling endpoints blocked**; call webhooks off unless SIP webhook delivery enabled.
- Use case: existing contact-center / Asterisk / Genesys — not typical early SaaS MVP.

---

## 7. Availability & pricing (Meta ledger — not SaaS price)

**UIC:** available wherever Cloud API is.  
**BIC business-number country exclusions** (docs list; re-check before ship): **United States, Canada, Egypt, Vietnam, Nigeria**. Consumer can be elsewhere; **business phone country code** must be supported.

**Pricing (Calling API, separate from messaging):**

- UIC → **₹0 / free** from Meta.
- BIC → duration in **6-second pulses** (fractional pulse rounds up), by callee country + monthly volume tier. Rate card effective **2026-04-01** in docs.
- Recording / transcription: currently **no extra** Meta fee on top of call rates (verify before promising customers).
- Call permission **messages** still bill as normal messaging.

**Never mix:** Meta Calling/WABA charges ≠ Samyoj plan price (two ledgers).

---

## 8. Future (Meta) vs what a SaaS actually ships

| Capability | Meta platform | Typical WhatsApp SaaS (honest) | Samyoj today (memory) |
|------------|---------------|--------------------------------|------------------------|
| UIC answer + AI voice | Full API | Often **core** ship (STT→LLM→TTS) | Core works (Sarvam); Chat vs Calling bots split |
| Agent ring in browser | WebRTC accept | Common | WebRTC bridge + ring modal |
| Call hours / icon / callback settings | Settings API | Settings UI or WhatsApp Manager | Org calling settings; product telephony on calling bot |
| BIC + permission UX | Full | Later / enterprise | Not the deferred headline; focus UIC |
| Live agent **same-call** transfer | Possible with careful WebRTC | Often **stub** / message handoff | **SAMYOJ-12 stub** — `message_only`; no promise “please hold” |
| SIP / G.711 PBX | Supported | Rare until contact-center SKU | Out of early scope |
| Video / screen share | Roadmap / limited | Don’t sell until proven | Don’t claim |
| Meta recording / transcription | Documented free add-on | Compliance + storage = SaaS cost | Product decision |
| Feedback / pickup restrictions | Automatic 7-day pauses | Ops playbooks | Monitor quality |

**Product rule of thumb:** Ship **reliable UIC + AI + honest handoff**. Treat BIC, SIP, and live media transfer as **Phase-2** unless customer explicitly needs them.

---

## 9. Hinglish cheat sheet

- Calling **alag feature** hai — messaging webhook se call nahi aati; **`calls`** field chahiye.
- Pehle number pe **Calling ENABLE** + messaging limit **2k+**.
- User ne call kiya = **UIC** (free). Tumne call kiya = **BIC** (permission + paisa).
- Permission **temporary 7 din** ya **permanent** — user boss hai.
- Settings se hours / icon / callback control; spam / miss pickups pe Meta **7 din band** kar sakta hai.
- Media = **WebRTC**; Graph sirf signaling. SIP = PBX walon ke liye.
- SaaS mein “live transfer” bolna easy, banana mushkil — pehle **message handoff** honest rakho.

---

## 10. Quiz / self-check

**Q1.** UIC ke liye user call permission zaroori hai?  
**A:** Nahi. Permission **BIC** ke liye zaroori hai.

**Q2.** Temporary permission kitne din? Permanent kab se?  
**A:** Temporary **7 days**. Permanent feature **2025-11-03** se; revoke user kare.

**Q3.** Calling enable karne ka messaging-limit floor?  
**A:** Daily unique recipients **≥ 2,000**.

**Q4.** Default media stack?  
**A:** WebRTC (ICE + DTLS + SRTP), Opus; signaling Graph + `calls` webhooks (unless SIP).

**Q5.** `pre_accept` kyun?  
**A:** UIC pe WebRTC pehle warm — accept ke baad media turant, clipping kam. Media tabhi jab accept **200** aaye.

**Q6.** BIC Meta fee ka unit?  
**A:** **6-second pulses**, country + volume tier; UIC free.

**Q7.** US/Canada business number pe BIC?  
**A:** Docs: **not available** (also Egypt, Vietnam, Nigeria on exclusion list — re-verify).

**Q8.** SaaS “live transfer” vs Meta Calling?  
**A:** Meta media path allow karta hai; **agent pe same call shift** SaaS engineering hai — Samyoj mein stub / text handoff until SAMYOJ-12.

**Q9.** `callback_permission_status: ENABLED` kya karta hai?  
**A:** User business ko call kare (miss/connect) → permission UI prompt path for future BIC.

**Q10.** SIP on hone pe Graph `/calls`?  
**A:** Calling Graph endpoints **blocked**; alag SIP lifecycle webhooks optional.

---

## Official URLs (bookmark)

Canonical Cloud API paths (also mirrored under `/documentation/business-messaging/whatsapp/calling/...`):

| Topic | URL |
|-------|-----|
| Calling overview | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/ |
| Call settings | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/call-settings/ |
| User call permissions | https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions |
| API + webhook reference | https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/reference |
| Calling pricing | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/pricing/ |
| Troubleshooting / errors | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/troubleshooting/ |
| SIP | https://developers.facebook.com/docs/whatsapp/cloud-api/calling/sip/ |
| Messaging pricing (separate) | https://developers.facebook.com/docs/whatsapp/pricing/ |
| Product blog (journeys) | https://developers.facebook.com/blog/post/2025/07/01/whatsapp-business-calling-api-end-to-end-journey/ |
| WhatsApp Manager (ops UI) | https://business.facebook.com/latest/whatsapp_manager/overview/ |

Related Samyoj memory (not Meta): `docs/memory/STATUS_AND_FUTURE.md` (live transfer stub / SAMYOJ-12), `docs/audit/FEATURE_MATRIX.md` (voice row).

---

## Sources freshness

Pulled from Meta developer docs + changelog notes as of research day **2026-08-25** (docs pages showed updates through mid-2026: G.711 Mar 2026, feedback restrictions Jan 2026, BIC limit 100/day Dec 2025, permanent permissions Nov 2025). Always re-open overview + pricing before a go-live claim — country lists and rate cards move.
