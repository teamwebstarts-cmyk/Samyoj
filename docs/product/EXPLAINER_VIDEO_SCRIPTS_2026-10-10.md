# Samyoj 2-minute explainer: Hindi + English scripts

**Date:** 10 Oct 2026
**Use:** homepage hero video (muted autoplay with captions, then click for sound).
**Length:** 2:00 exactly, 1920×1080, 30 fps = 3,600 frames.
**What this file is:** one shared production bible and scene-by-scene visual script, followed by two clean voice-over scripts (Hindi, English). Visuals are identical in both versions. Only the voice-over and on-screen words change.

Claims follow `docs/product/WEBSITE_FEATURE_CATALOG_2026-09-24.md` ("In the product" rows only). This is a testing-deploy product, not customer production. Nothing in this video promises production proof.

---

## 0. Decisions I made (change any of them)

| # | Decision | Why |
|---|---|---|
| D1 | **Hybrid build.** AI video makes only people, mood and illustrated loops. Every screen, number and word is built as real motion graphics from real app captures. | Every current model (Kling 3.0, Seedance, Veo 3.1) garbles UI and text. See §1. |
| D2 | **Illustrated 2.5D characters, not photoreal.** | Stays consistent across shots, avoids uncanny faces, and keeps the synthetic-person labelling question simple. The brand hero photo stays on the login page. |
| D3 | **One story, one hero: Meera**, a boutique owner. Other businesses appear only as faceless vignettes in S8. | One viewer, one problem, one outcome is the structure that converts. |
| D4 | **Story order = a customer's day:** pain → connect → Inbox → AI bot + automations → Campaigns → AI Calls → everything in one place → CTA. | Five features, one thread, no feature list. |
| D5 | **WhatsApp only.** No Facebook, Instagram, Email, Ads, Orders, Content Studio. | Facebook/Instagram live events are still blocked on Meta App Review. |
| D6 | **No prices, plans, trial, ROI, or "live transfer".** | TARGET billing is not shipped; transfer is a stub; ROI is not built. |
| D7 | **Hindi VO is fully Devanagari** (loanwords like कस्टमर, इनबॉक्स). Product nouns on screen stay in English because the app UI is English. | Sarvam Bulbul is best with native script; Hindi speakers say these words this way. |
| D8 | **Logo:** the in-app green + navy logo (`samyoj-logo.jpeg` / `samyoj-mark.png`). | The sidebar uses it. The login page uses the newer purple-blue one. See Doubt Q1. |

---

## 1. Research → what it changed

| Finding | Source | Change in this script |
|---|---|---|
| 60–90 s is the most common SaaS explainer length (34%); only 12% run past 2 min; completion drops sharply after 2 min. | [What a Story, 1,000+ videos](https://www.whatastory.agency/resources/saas-explainer-video-analysis), [Magic Motion guide](https://magicmotionstudio.com/explainer-videos-for-saas-companies/) | You asked for 2:00, so I kept it but: hook in 3 s, a new scene every ≤ 20 s, and §9 marks a 75 s cut for ads and WhatsApp. |
| Open on the viewer's pain, not the brand. 52% of high performers use Problem → Solution → CTA. | same | S1–S2 are pure pain. Brand appears at 0:15. |
| Show real UI within 10–15 s, one workflow, one CTA. | [Leadde](https://leadde.ai/blog/how-to-create-a-saas-explainer-video), [Videly](https://videly.io/blog/saas-explainer-video-examples) | UI at 0:19. One CTA only. |
| AI video models cannot render product UI or readable text. Best text score still has a 25% word error rate. Composite real UI + code-rendered type; use AI only for atmosphere. | [Kino](https://kinosites.com/guides/ai-video-vs-motion-graphics/), [CoreReflex](https://corereflex.com/blog/why-ai-video-text-looks-garbled-fix), [VTR-Bench](https://arxiv.science/abs/2610.01499) | D1. Every AI prompt ends with a "no text, no readable screens" lock. |
| Current models: Seedance 2.5 (multi-shot consistency, reference images), Kling 3.0 (15 s, character lock, 4K), Veo 3.1 (8 s clips, best text, native audio), Runway Gen-4.5 (camera control). | [Recut](https://recut.video/blog/ai-video-model-comparison-2026/), [DeepForge](https://deepforgehub.com/text-to-video-ai-scene-by-scene-model-comparison-2026/) | All AI shots ≤ 8 s so any tool works. Keyframe still first, then image-to-video, for character lock. Audio off. |
| Hindi VO runs about 100–115 WPM; English about 130 WPM. | [Speech Minutes](https://speechminutes.com/hindi-speech-reading-time-calculator/) | Hindi is the timing master (192 words). English fits inside the same scene windows. |
| Bulbul v3/v4-flash: Hindi + `en-IN`, pace 0.5–2.0, 2,500 characters per request. Independent listening tests prefer it for Indian languages. | [Sarvam docs](https://docs.sarvam.ai/api/getting-started/models/bulbul.mdx), [Josh Talks eval](https://evals.ai.joshtalks.com/blog/indic-tts-evaluation-bulbul-v3-vs-others) | Samyoj already uses Sarvam. Use it for both VOs. |
| 90% of non-metro consumers use WhatsApp as the primary digital platform; they value consistency over hype. 56% of MSMEs prefer an English UI, 25% Hindi. Hindi VO beats English by ~42% in tier-2/3 cities, but metros are equal. | [Business Standard / Rukam-YouGov](https://www.business-standard.com/finance/personal-finance/67-pay-via-upi-90-use-whatsapp-in-smaller-cities-for-purchases-report-126012000626_1.html), [PayNearby](https://mediabrief.com/paynearby-msme-digital-index-2025/), [WhatSender](https://whatsender.dev/blog/whatsapp-video-message-marketing-india-2026) | Calm, plain, no hype words. Real English UI under Hindi VO. Burned-in captions in both. |
| Captions lift watch volume; Roman Hinglish reads fastest for under-35 urban viewers, Devanagari for older / non-metro. | [Zoupyu](https://zoupyu.com/blog/live-subtitles-hinglish-creators-guide) | Hindi master captions in Devanagari. Export a Roman-Hinglish SRT too (free by transliteration). |
| ASCI released guidelines for labelling synthetic content in ads: no fabricated testimonials, no misleading synthetic results, label synthetic influencers/ambassadors. | [ASCI release via Medianama](https://www.medianama.com/wp-content/uploads/2026/10/Press-Release_Guidelines-for-Responsible-Labelling-of-Synthetically-Generated-Content-in-Advertising.pdf) | No fake testimonials or customer logos. Meera is an illustrated scenario, not an endorsement. A one-line "illustrations are AI-generated, screens show demo data" sits in the end card. |

---

## 2. The idea

**One line:** *A busy night, a hundred messages, one business number, and the same night with nothing missed.*

**Colour arc (the visual spine):**
1. **S1–S2: pain** = night navy + desaturated slate + one red accent (`#ef4444`).
2. **S3: the bubble wipe** = a brand-green circle expands from a chat bubble and clears the grey.
3. **S4–S9: solution** = Samyoj light theme, green accent, daylight.

**Callback:** the hook says "every message is a customer". The last line says "so no customer slips away".

**Timeline (30 fps):**

| Scene | Time | Frames | Job |
|---|---|---|---|
| S1 Hook | 0:00–0:06 | 0–179 | Pain, one image |
| S2 Cost | 0:06–0:15 | 180–449 | Three misses |
| S3 Reveal + Connect | 0:15–0:26 | 450–779 | Brand, how to start |
| S4 Shared Inbox | 0:26–0:46 | 780–1379 | Feature 1 |
| S5 AI bot + Automations | 0:46–1:06 | 1380–1979 | Feature 2 |
| S6 Campaigns | 1:06–1:26 | 1980–2579 | Feature 3 |
| S7 AI Calls | 1:26–1:43 | 2580–3089 | Feature 4 |
| S8 One place | 1:43–1:52 | 3090–3359 | Contacts, team, reports, who it's for |
| S9 CTA | 1:52–2:00 | 3360–3599 | One action |

---

## 3. Production bible (shared)

### 3.1 Format

| Item | Value |
|---|---|
| Master | 1920×1080, 30 fps, H.264 MP4, sRGB. Render at 2× (3840×2160) if the editor allows, then downscale. |
| Safe area | 96 px margin all sides. Captions live between y = 900 and y = 984. |
| Vertical cut | 1080×1920, from the same project. Keep text inside x 72–1008, y 220–1560. |
| Autoplay | Muted loop poster frame = frame 450 (logo on mint). |

### 3.2 Theme tokens (copied from `client/src/index.css` and `tailwind.config.js`)

| Token | Value | Use |
|---|---|---|
| Canvas | `#f8fafc` + `--gradient-platform`: radial green `rgba(37,211,102,0.08)` top-right, radial teal `rgba(18,140,126,0.05)` bottom-left | Every light scene |
| Surface | `#ffffff`, border `rgba(226,232,240,0.85)` | Cards, UI frames |
| Text | `#0f172a` / secondary `#475569` / muted `#64748b` | Titles / body / labels |
| WhatsApp green | `#25D366` | Accent, ticks, wipe circle |
| Samyoj dark green | `#087f5b` | Buttons, focus ring, accent words |
| Teal / forest | `#128C7E` / `#075E54` | Gradients, icon fills |
| Mint wash | `#f0fdf4`, `#dcfce7` | Icon backgrounds, chat sent bubble `#d1fae5` |
| Chat | bg `#f4f5f7`, received `#ffffff`, read tick `#53bdeb`, timestamp `#667781` | Inbox and phone previews |
| Logo navy / green | ≈ `#0B2A57` / ≈ `#12903F` (eyedrop the PNG to confirm) | Logo only |
| Night (S1 only) | `#0b1220` base, `#111827` mid | Pain scenes |
| Pain accent | `#ef4444` | Only in S1–S2, then never again |
| Card shadow | `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)` (`--shadow-panel`) | Small cards |
| UI window shadow | `0 40px 90px -30px rgba(15,23,42,.30), 0 2px 6px rgba(15,23,42,.06)` | Big app window |

### 3.3 Type

| Role | Font | Size / line | Weight | Notes |
|---|---|---|---|---|
| English / Latin | **Plus Jakarta Sans** (the app font) | | | |
| Hindi / Devanagari | **Noto Sans Devanagari** | | | Plus Jakarta has no Devanagari glyphs. Same weights, +4 px line height. |
| Title | | 72 / 84 | 800 | letter-spacing −0.02em; one accent word in `#087f5b` |
| Subtitle | | 32 / 44 | 500 | `#475569` |
| Chip label | | 24 / 32 | 600 | |
| Caption | | 40 / 52 | 700 | white on `rgba(15,23,42,.72)` pill, radius 14, padding 10×22, centered, bottom y = 984 |
| Footer note | | 20 / 28 | 500 | `#64748b` |

Hindi text is always larger in rendered width. Build every title box 15% wider than the English one.

### 3.4 Layout for UI scenes (S4–S7)

- **Left column:** x 96–624 (528 wide). Title top at y = 300. Subtitle 24 px below. Callout chips stack under it, 16 px gap.
- **Right: app window card:** 1136×710 at (688, 185), corner radius 24. Content is a real capture of a 1440×900 viewport, shot at DPR 2 (2880×1800) and scaled down. No browser chrome, no fake traffic-light dots.
- **Zoom focus:** scale the window to 1.0 → 1.55 on the target region over 24 frames, `cubic-bezier(.2,.8,.2,1)`. Outside the focus, dim to 35% opacity (a `#f8fafc` overlay at 65%).
- **Callout chip:** height 56, radius 28, bg `#fff`, 1 px border `rgba(37,211,102,.35)`, shadow-panel. A 36 px circle `#dcfce7` on the left with a `#087f5b` 20 px icon, then the 24/600 label. It enters with fadeUp (12 px, 15 frames) and leaves after 2.5 s.
- **Cursor:** macOS-style arrow, 28 px, white fill with a 1.5 px `#0f172a` outline. Click = a 56 px `rgba(37,211,102,.35)` ring scaling 0.6 → 1.4 over 12 frames. Move along gentle Bezier arcs, 18–24 frames per hop. Never linear.

### 3.5 Motion language

- **Ease:** `cubic-bezier(.2,.8,.2,1)` for everything. It matches the app's `fadeUp` (12 px, 0.5 s).
- **Durations:** UI element in 12–18 frames. Card in 15–24. Scene change 10–14.
- **Stagger:** 6 frames between siblings.
- **Camera:** slow push-in of 3–5% per scene on the window card, no pans, no shake, no glitch, no whip.
- **Hero transition:** the **bubble wipe**, used once: S2 → S3 (frames 438–456). A `#25D366` circle grows out of a chat-bubble tail at (1520, 720) to fill the frame, then dissolves into mint `#f0fdf4`, then the next scene fades up. Every other scene change is a quick 12-frame crossfade with a 24 px slide on the window card.
- **Reduced noise rule:** at most 3 things moving at once.

### 3.6 Characters

| Name | Where | Look |
|---|---|---|
| **Meera** (hero) | A1, A5, A10 | Indian woman, mid-30s, warm brown skin, black hair in a loose low bun with a few loose strands, small gold studs, sage-green cotton kurta with a faint small print (echoes the brand hero), simple modern boutique owner |
| **Arjun** (teammate) | A10 only | Indian man, mid-20s, short black hair, light-blue half-sleeve shirt |
| **Customers** | UI only | Initials in circles (PS, RV, NK, AP). No faces. |

Meera never speaks on camera. The narrator is the voice.

### 3.7 Demo data (seed a demo organisation; never use real customer data)

- Business: **Meera Boutique**. Numbers masked in the UI: `+91 98••• ••210`.
- Contacts: Priya S., Rahul V., Neha K., Amit P., Sana M., Karan T.
- Inbox thread (Roman Hinglish, as people really type):
  - Priya: "Hi, kal wali blue saree available hai?"
  - Reply (quick reply): "Haan ji! Blue silk saree stock mein hai. Photos bhej dun?"
  - Priya: "Haan please 🙏"
- AI Train FAQs: "Store timings", "Alteration charges", "Delivery time".
- Try-it chat: customer "kal store khula hai kya?" → bot "Ji, kal hum subah 10 se raat 8 baje tak khule hain."
- Campaign template: "Diwali Sale" (Diwali is 8 Nov 2026, so this is timely). Body: "Namaste {{1}}, Diwali sale live hai — sabhi sarees par 20% off, Sunday tak."
- Campaign stats shown: Sent 1,248 · Delivered 1,236 · Read 794. Label every stats frame "Demo data".
- Call: Rahul V., 1:12 duration. Summary: "Asked about store timings and alteration charges. Follow up tomorrow."

### 3.8 Audio

| Layer | Spec |
|---|---|
| Voice | One warm, calm female narrator, "helpful friend, not announcer". Sarvam Bulbul (Hindi `hi-IN`, English `en-IN`). Pace 0.95–1.05; test-render and measure. Loudness −16 LUFS integrated, true peak −1 dBTP. |
| Music | Instrumental, about 96 BPM, soft piano/pluck, light percussion. A bansuri or tabla touch only in S8–S9, kept subtle. 8–10 dB under VO. Licensed library or generated music with a commercial licence. Keep the receipt. |
| SFX | Soft UI "pop" on each chip, light tick on message sent, a gentle rise at the bubble wipe. **Do not use WhatsApp's real notification sound or logo-sound.** Make your own buzz in S1. |
| Silence | 0.4 s of room tone before the first word. English VO enters 0.3 s after the scene start so visuals land first. |

### 3.9 Captions

Burned in (muted autoplay). Same text as the VO, split into lines of ≤ 42 characters, two lines max. Ship a separate `.srt` per language.

---

## 4. AI prompt kit

Use the same three blocks in every AI prompt. Paste them verbatim.

**STYLE-LOCK**
```
2.5D flat vector illustration, soft gradient shading, rounded geometric shapes, subtle paper-grain texture (4%), gentle layered parallax depth, clean minimal composition with generous negative space. Palette: off-white #f8fafc, mint #dcfce7, brand green #25D366 and deep green #087f5b, navy #0B2A57, warm natural Indian skin tones, soft amber lamp light for night. Calm, premium, friendly. 16:9, 1920x1080, 30 fps.
```

**CHARACTER-LOCK (Meera)**
```
Meera: Indian woman, mid-30s, warm brown skin, black hair in a loose low bun with a few loose strands, calm kind eyes, small gold stud earrings, sage-green cotton kurta with a faint small print. A modern small-business owner, not a stereotype. Identical face, hair and outfit in every shot.
```

**NEGATIVE-LOCK**
```
No text, no letters, no numbers, no logos, no watermarks, no signage, no readable phone or laptop screens, no WhatsApp or Facebook logo or UI replica, no subtitles, no audio, no talking or lip movement, no camera shake, no flicker, no lens flare, no morphing faces, no extra fingers, no close-up crowd faces, no cultural clichés (no marigold overload, no landmark postcards, no head-wobble), no photorealism.
```

**Workflow per AI shot**
1. Generate a **keyframe still** with an image model using STYLE-LOCK + CHARACTER-LOCK. Approve it.
2. Animate with **image-to-video** (Seedance 2.5 reference input, or Kling 3.0 character lock, or Runway Gen-4.5 for camera control). Generate 4 takes, pick 1.
3. Audio **off**. Length ≤ 8 s (fits Veo too).
4. Where a phone or laptop screen appears, it is a **plain glow or blank panel**. Post replaces it with motion graphics if needed.
5. Reject any take with melted hands, changed outfit, or any glyph-like shape.

---

## 5. Scene-by-scene script

Frame numbers are for the 30 fps master. "HI" = Hindi, "EN" = English.

### S1: HOOK · 0:00–0:06 · frames 0–179

**Goal:** name the pain in 3 seconds, in one image, before any brand.

**Visual**
- **L0:** night navy `#0b1220` full frame.
- **L1 (AI shot A1, 5 s, frames 12–162):** Meera at the boutique counter after closing, 11 PM, over-the-shoulder medium shot. Warm amber desk lamp, folded sarees and fabric rolls softly blurred behind. Her face is lit by a cool glow from the back of the phone. Very slow push-in of 4%.
- **L2 (motion graphics):** a **"99+" pill** over the top-right of the phone.
  - Pill 168×76, radius 38, fill `#ef4444`, text Plus Jakarta 800 40 px white.
  - Counter ticks 12 → 99+ between frames 30 and 120 (ease-out, last 3 steps slow).
  - Around the phone, 5 generic green rounded-rectangle "bubbles" (no text, grey placeholder lines) float up and fade, 24 frames each, staggered 10 frames. They are **not** a WhatsApp UI replica.
- **L3 (kinetic title, frames 96–179):** bottom-left at x = 144, y = 880, 64/76 800 white. HI: **"हर मैसेज, एक कस्टमर।"** EN: **"Every message is a customer."** Fade-up 12 px, 14 frames.
- **L4:** captions on.

**AI prompt A1**
```
[STYLE-LOCK] [CHARACTER-LOCK] Medium shot over Meera's shoulder at a small boutique counter after closing, 11 PM. Warm amber desk lamp, folded sarees and fabric rolls softly blurred behind. She looks tired, thumb scrolling her phone. The phone is seen from the back; a cool white-green glow lights her face; screen not visible. Camera: very slow push-in (4%), locked horizon. Motion: she exhales once, lamp glow stays steady. 5 seconds, single take. [NEGATIVE-LOCK]
```

**VO**
- HI: सौ से ज़्यादा मैसेज… और हर मैसेज, एक कस्टमर।
- EN: It's 11 PM. A hundred-plus WhatsApp messages. Every one, a customer.
- *Delivery:* low, tired but warm, slight smile in the voice. Pause 0.4 s after "मैसेज…" / after "messages."

**Sound:** room tone, a low lamp hum, two soft phone buzzes (own sound) at frames 36 and 78. Music starts at frame 60, one soft pad, no beat.
**Trim first if VO runs long:** HI drop "से ज़्यादा"; EN drop "It's 11 PM."
**Claims check:** none. This is the pain.

---

### S2: THE COST · 0:06–0:15 · frames 180–449

**Goal:** three recognisable misses, one per 3 seconds.

**Visual**
- **L0:** dissolve from night navy to light slate `#e2e8f0` → `#f1f5f9` over 20 frames (frames 180–200). The red accent stays.
- **Three cards**, each 512×640 at y = 220, radius 28, white, border, shadow-panel. Columns at x = 144, 704, 1264 (512 wide, 48 gap).
- **Inside each card:** a 360×360 illustrated loop (AI shot) centered at y = 260 from the card top. Beneath it at y = 440 from the card top, a label in 32/44 700 `#0f172a`. Below the label, a small red dot (12 px, `#ef4444`) with a 24/500 `#64748b` one-line cost note.
- **Entrance:** each card fades up 24 px in 18 frames, on its VO phrase (see timing).

| Card | AI loop | Label HI / EN | Cost note HI / EN |
|---|---|---|---|
| 1 | **A2** chat bubble with three typing dots pulsing beside a wall clock ticking forward | "देर से जवाब" / "Late reply" | "कस्टमर आगे बढ़ गया" / "Customer moved on" |
| 2 | **A3** a notebook page with a checkbox list; one note peels off and drifts away | "फ़ॉलो-अप भूल गए" / "Follow-up forgotten" | "बात अधूरी रह गई" / "Conversation left hanging" |
| 3 | **A4** a phone with a missed-call arrow icon (no text) pulsing at night, small moon icon | "रात की कॉल छूटी" / "Missed night call" | "कोई जवाब नहीं मिला" / "Nobody picked up" |

- **Timing (frames):** card 1 in at 200, card 2 in at 290, card 3 in at 380. At 420 all three desaturate and dim to 55% (preparing for the wipe).
- **Bubble wipe starts at frame 438** (see §3.5). It ends at 456.

**AI prompts A2–A4** (each: still first, then 3 s seamless loop)
```
A2: [STYLE-LOCK] Flat illustration, centered: a green chat bubble with three typing dots pulsing slowly, beside a round wall clock whose minute hand ticks forward. Soft slate-grey background, a small red dot in the corner. Subtle parallax. 3-second seamless loop. [NEGATIVE-LOCK]
A3: [STYLE-LOCK] Flat illustration, centered: a notebook page with a checkbox list drawn as plain bars (no writing). One sticky note peels off and drifts away slowly. Soft slate background. 3-second seamless loop. [NEGATIVE-LOCK]
A4: [STYLE-LOCK] Flat illustration, centered: a smartphone with a red missed-call arrow icon pulsing gently, a small crescent moon icon top-right, dark navy to slate gradient. 3-second seamless loop. [NEGATIVE-LOCK]
```

**VO**
- HI: कहीं जवाब देर से गया, कहीं फ़ॉलो-अप भूल गए, और रात की कॉल छूट गई।
- EN: A reply sent too late. A follow-up forgotten. A call missed at night.
- *Delivery:* three beats, slight lift on each item, falling on the last. Card entrances land on the first syllable of each phrase.

**Trim first:** HI drop "कहीं" (second); EN none.
**Claims check:** none.

---

### S3: REVEAL + CONNECT · 0:15–0:26 · frames 450–779

**Goal:** brand arrives, then the first action: connect your own number.

**Visual**
- **0:15.0–0:17.5 (frames 450–525):** **AI shot A5**. Meera opens a laptop at the counter. Light shifts from lamp amber to fresh daylight. Over it, a **logo lockup** fades up center (frames 462–486): `samyoj-logo.jpeg` or mark + wordmark, 520 px wide, on a mint `#f0fdf4` panel (radius 28, 640×240).
- **Title (frames 480–540):** below the logo, 72/84 800: HI **"एक नंबर। पूरा बिज़नेस।"** EN **"One number. Your whole business."** (accent word: "बिज़नेस" / "business" in `#087f5b`.)
- **0:17.5–0:26 (frames 525–779): app window card** (1136×710) rises to the right-centre while the logo and title shrink to the left column (x 96–624).
  - **Real UI:** Dashboard pre-connect state. Hero with the **Connect WhatsApp** button (`PreConnectHero`). Cursor moves along an arc to the button by frame 570 and clicks.
  - **3 step chips** appear one after another in the left column, stacked, 24/600, 56 tall:
    1. HI "फ़ेसबुक से लॉग-इन" / EN "Log in with Facebook" (frame 585)
    2. HI "अपना नंबर चुनें" / EN "Pick your number" (frame 630)
    3. HI "कनेक्टेड ✓" / EN "Connected ✓" (frame 675), the check in `#25D366`.
  - Do **not** show real Facebook login screens or credentials. The window crossfades from the hero to the connected Dashboard (green "Connected" pill, masked number `+91 98••• ••210`) at frame 690.
- **Sidebar visible in the window** with real labels: Dashboard, Channels > WhatsApp (Inbox, Campaigns, Calls, Templates), AI Studio (AI Bots, Automations), Contacts.

**AI prompt A5**
```
[STYLE-LOCK] [CHARACTER-LOCK] Medium shot of Meera at the boutique counter. She places her phone face-down, breathes out with a small relieved smile, and opens a silver laptop. Light shifts from warm amber lamp to soft fresh daylight through a shop window. Camera: slow push-in 3%. Laptop screen shows only a soft white glow. 2.5 seconds, single take. [NEGATIVE-LOCK]
```

**VO**
- HI: मिलिए सम्योज से — आपके अपने व्हाट्सएप नंबर पर, पूरा बिज़नेस एक जगह। फ़ेसबुक से लॉग-इन कीजिए, नंबर चुनिए, बस।
- EN: Meet Samyoj: your whole business, on your own WhatsApp number. Log in with Facebook, pick your number, and you're connected.
- *Delivery:* a smile enters the voice at "मिलिए / Meet". Slow down slightly on the product name. "बस / connected" is light and confident, not salesy.

**Sound:** a gentle rise 0.4 s into the bubble wipe, a soft "chime-pop" at logo landing, UI pops on each chip.
**Trim first:** HI drop "बस"; EN drop "and you're connected."
**Claims check:** Connect = Facebook OAuth + pick number (catalog row 1). **Do not say "in minutes."**

---

### S4: SHARED INBOX · 0:26–0:46 · frames 780–1379

**Goal:** one place for all messages, with a team.

**Visual**
- **Left column:** title HI **"शेयर्ड इनबॉक्स"** EN **"Shared Inbox"**, subtitle HI "पूरी टीम, एक जगह" / EN "Your whole team, one place".
- **Window card:** real **Inbox** with demo data. Three panes: conversation list left, thread centre, contact/detail right (use what the real app shows, do not invent panes).
- **Beats (frames from scene start = 780):**

| Frames | Beat | Detail |
|---|---|---|
| 780–840 | Inbox loads | 6 conversations, unread badges. Priya S. on top. |
| 840–930 | Priya's message arrives | Received bubble (white, `#e9edef` border) slides in: "Hi, kal wali blue saree available hai?" |
| 930–1020 | **Quick reply** | Cursor opens quick replies, picks "Stock check". Sent bubble (`#d1fae5`) appears. Ticks go grey → blue `#53bdeb` over 20 frames. Chip: HI "तैयार जवाब, एक टैप" / EN "Ready replies, one tap" |
| 1020–1110 | **Assign + note** | Assign control set to "Arjun" (initials circle AJ). Notes tab: "Customer wants photos." Chip: HI "चैट असाइन करें, नोट छोड़ें" / EN "Assign chats, leave notes" |
| 1110–1260 | **24-hour window** | Open a thread from 2 days ago. The composer shows the real "window closed → use a template" state. Cursor picks an approved template. Chip: HI "24 घंटे बाद भी: अप्रूव्ड टेम्पलेट" / EN "After 24 h: approved templates" |
| 1260–1379 | Hold on thread | Slow push-in 4%, then 12-frame crossfade out. |

- **Capture note:** match the app's real copy and control names at capture time; the labels above are placeholders where I could not verify exact strings.

**VO**
- HI: सारे कस्टमर मैसेज, एक शेयर्ड इनबॉक्स में। आपकी टीम चैट असाइन करे, नोट छोड़े, और तैयार जवाब एक टैप में भेजे। चौबीस घंटे बाद भी — अप्रूव्ड टेम्पलेट से बात चलती रहे।
- EN: Every customer message lands in one shared Inbox. Your team can assign chats, leave notes, and send ready replies in one tap. And after the 24-hour window? Approved templates keep the conversation going.
- *Delivery:* even, practical. Slightly brighter on "एक टैप / one tap". Question tone on "after the 24-hour window?"

**Trim first:** HI drop the last sentence's "भी —"; EN drop "And".
**Claims check:** assign, notes, canned replies, 24 h window + template (catalog §1). No "unlimited team".

---

### S5: AI BOT + AUTOMATIONS · 0:46–1:06 · frames 1380–1979

**Goal:** replies at 2 AM, in the customer's language, with a human override.

**Visual**
- **Left column:** HI **"एआई बॉट + ऑटोमेशन"** EN **"AI Bot + Automations"**, subtitle HI "आपकी एफ़एक्यू से सीखता है" / EN "Learns from your FAQs".
- **Window card beats:**

| Frames | Beat | Detail |
|---|---|---|
| 1380–1500 | **AI Bots → Train tab** | Real tabs: Setup / Train / Try it. Three FAQ cards fill in: Store timings, Alteration charges, Delivery time. A status pill switches Learning → Ready (`#dcfce7` / `#087f5b`). Chip: HI "आपके जवाब से सीखता है" / EN "Learns from your answers" |
| 1500–1650 | **Try it** | Customer: "kal store khula hai kya?" Bot reply types in, same Roman-Hinglish tone: "Ji, kal hum subah 10 se raat 8 baje tak khule hain." A small moon icon + chip HI "दिन हो या रात" / EN "Day or night" |
| 1650–1800 | **Automations** | Real Automations page. Toggle "Welcome message" and "Away message" on (`#25D366` track). Chip: HI "वेलकम और अवे मैसेज" / EN "Welcome and away messages" |
| 1800–1979 | **You take over** | Back in Inbox thread: the bot chip "Bot on" flips to "Bot paused" with one click. Chip: HI "जब चाहें, आप ख़ुद संभालें" / EN "Pause the bot, take over" |

- **Do not show:** plan gating, the Calling bot tab (that is S7), voice picker.

**VO**
- HI: एआई बॉट आपकी एफ़एक्यू सीखकर, कस्टमर की अपनी भाषा में जवाब देता है — दिन हो या रात। वेलकम और अवे मैसेज जैसे ऑटोमेशन साथ में। और जब चाहें, बॉट रोककर आप ख़ुद संभालें।
- EN: An AI bot learns your FAQs and answers customers in their language, day or night. Welcome and away automations run alongside. And whenever you want, pause the bot and take over yourself.
- *Delivery:* reassuring. Land "day or night" slowly. Final sentence is a handoff, slightly lower and warmer.

**Trim first:** HI drop "जैसे"; EN drop "yourself".
**Claims check:** verified in code: the bot is prompted to reply in the customer's language (incl. Hinglish), `botActive` pause is honoured by AI and flows. Chat bots are plan-gated, so do not say "included for everyone". No claim of accuracy %.

---

### S6: CAMPAIGNS · 1:06–1:26 · frames 1980–2579

**Goal:** send to the right people, only people who agreed.

**Visual**
- **Left column:** HI **"कैंपेन"** EN **"Campaigns"**, subtitle HI "सिर्फ़ opted-in कॉन्टैक्ट्स को" / EN "Only opted-in contacts".
- **Window card beats** (real wizard, steps: **Message → Audience → Review & Send**):

| Frames | Beat | Detail |
|---|---|---|
| 1980–2040 | Campaigns list | Status chips including Scheduled. Cursor to **New campaign**. |
| 2040–2190 | **Step 1 Message** | Pick approved template "Diwali Sale". Right: phone preview card (360×740, radius 44, bezel 10 `#0f172a`, chat bg `#f4f5f7`) shows the template bubble. Personalise {{1}} with "Priya". Chip: HI "अप्रूव्ड टेम्पलेट चुनें" / EN "Pick an approved template" |
| 2190–2310 | **Step 2 Audience** | Select the "Diwali list" group. A green "Opted-in only" style chip (match real copy). Chip: HI "सिर्फ़ जिन्होंने हाँ कहा" / EN "Only people who said yes" |
| 2310–2400 | **Step 3 Review & Send** | Schedule date/time picked (Saturday, 6:00 PM). Cursor clicks **Schedule**. |
| 2400–2579 | **Results** | Campaign detail with demo stats: Sent 1,248 · Delivered 1,236 · Read 794. Counters count up over 30 frames. A "Demo data" tag bottom-right of the window (20 px, `#64748b`). Chip: HI "कितनों को पहुँचा, कितनों ने पढ़ा" / EN "Delivered and read" |

**VO**
- HI: कैंपेन के लिए अप्रूव्ड टेम्पलेट चुनिए, ऑडियंस चुनिए, और भेजने का समय तय कीजिए। मैसेज सिर्फ़ उन्हीं तक जाता है जिन्होंने हाँ कहा है। फिर देखिए — कितनों को पहुँचा, कितनों ने पढ़ा।
- EN: For campaigns, pick an approved template, choose your audience, and set the time. It goes only to people who've said yes. Then see how many received it, and how many read it.
- *Delivery:* a clear three-step rhythm, then a quiet emphasis on "हाँ कहा है / said yes". Counters tick up as the voice says the result sentence.

**Trim first:** HI drop "फिर देखिए —"; EN drop "Then".
**Claims check:** consent fail-closed send; delivered/read analytics exist. **Do not** say "more sales", "higher open rates" or show a % uplift. Meta message fees are not mentioned.

---

### S7: AI CALLS · 1:26–1:43 · frames 2580–3089

**Goal:** the night call from S2 gets answered, and the result lands in the chat.

**Visual**
- **Left column:** HI **"एआई कॉल"** EN **"AI Calls"**, subtitle HI "कॉल के बाद, चैट में समरी" / EN "Summary lands in the chat".
- **Window card beats:**

| Frames | Beat | Detail |
|---|---|---|
| 2580–2700 | **Calls page, recents** | Real recents list. Incoming call from "Rahul V." slides in (card 360×120, radius 24, green accept dot). |
| 2700–2850 | **AI answers** | A **waveform bar** (motion graphic, 9 bars, 6 px wide, `#25D366`, gentle) animates on the call card. Label: HI "एआई ने फ़ोन उठाया" / EN "AI picked up". The timer runs 0:00 → 1:12 (sped up, ease-out). **No fake transcript** on screen. |
| 2850–3000 | **Call ends → thread** | Cut to the Inbox thread. A call-end pill "Call ended · 1:12" appears, then a **summary note** card slides in under it: 3 short lines (the demo summary from §3.7). Chip: HI "कॉल के बाद समरी" / EN "Summary after the call" |
| 3000–3089 | Hold + crossfade | |

**VO**
- HI: और जब कस्टमर व्हाट्सएप पर कॉल करे, तो एआई आपकी तरफ़ से फ़ोन उठा सकता है। कॉल ख़त्म होते ही, उसकी समरी उसी चैट में मिल जाती है।
- EN: And when a customer calls you on WhatsApp, AI can pick up for you. When the call ends, a summary appears right in that chat.
- *Delivery:* a small narrative lift: "this is the call you missed". Keep "can pick up" modest.

**Trim first:** HI drop "उसकी"; EN drop "right".
**Claims check:** AI voice on calls + post-call summary are built (internal test). **Do not** say "transfer to a human on the same call" (stub), "never miss a call", "understands every accent", or show live barge-in. The call is shown as a short demo, not a proof of quality.

---

### S8: ONE PLACE · 1:43–1:52 · frames 3090–3359

**Goal:** it is a whole workspace, and it fits any small business.

**Visual**
- **Frames 3090–3225 (0–4.5 s): three UI snaps**, each 1.5 s, in the app window at the S4 layout, cut with a 24 px slide:
  1. **Contacts:** real table with tag chips (VIP, Diwali, New).
  2. **Team:** role chips Owner / Admin / Agent.
  3. **Dashboard:** real KPI cards (messages, campaigns) with demo numbers.
  - Title line (centered, 72/84): HI **"कॉन्टैक्ट्स · टैग · टीम · रिपोर्ट"** EN **"Contacts · Tags · Team · Reports"**.
- **Frames 3225–3359 (4.5–9 s): four vignette tiles** slide in from the right, 320×440 each, gap 32, radius 28, centered row (total 1376, left x = 272). Each is an AI loop (A6–A9). Label under each in 28/36 700. HI/EN: बुटीक / Boutique · कोचिंग / Coaching · क्लिनिक / Clinic · सैलून / Salon.

**AI prompts A6–A9** (still first, then 2 s loop; no faces in close-up, no signage)
```
A6 Boutique: [STYLE-LOCK] Flat illustration: a small saree boutique interior, a mannequin in a green saree, folded fabric stacks, warm window light. Subtle parallax. 2s loop. [NEGATIVE-LOCK]
A7 Coaching: [STYLE-LOCK] Flat illustration: a small coaching classroom seen from behind, a blank whiteboard, students as simple silhouettes at desks, soft daylight. 2s loop. [NEGATIVE-LOCK]
A8 Clinic: [STYLE-LOCK] Flat illustration: a calm clinic reception desk, a green plant, a waiting chair, soft light, no staff faces. 2s loop. [NEGATIVE-LOCK]
A9 Salon: [STYLE-LOCK] Flat illustration: a salon chair facing a mirror, combs and a small plant on a shelf, warm light, no faces. 2s loop. [NEGATIVE-LOCK]
```

**VO**
- HI: कॉन्टैक्ट्स, टैग, टीम और रिपोर्ट — सब एक ही जगह। बुटीक हो, कोचिंग, क्लिनिक या सैलून।
- EN: Contacts, tags, team and reports, all in one place. Boutique, coaching, clinic, salon.
- *Delivery:* quick list rhythm, then a slow warm close on the four businesses.

**Trim first:** HI drop "ही"; EN drop "all".
**Claims check:** Contacts/tags, team roles, dashboard exist. Do not name "ROI". Do not claim any real business uses it.

---

### S9: CTA · 1:52–2:00 · frames 3360–3599

**Goal:** one action, and close the loop from the hook.

**Visual**
- **Frames 3360–3480 (4 s): AI shot A10.** Morning in the boutique. Meera at the laptop, relaxed, smiling. Arjun folds sarees behind her. A customer (seen from behind) walks in with the door light. Slow push-in 3%.
- **Frames 3480–3599 (4 s): end card** on `#f0fdf4` with the platform gradient.
  - Logo lockup centered at y = 380, 560 px wide.
  - Line (72/84 800, centered, y = 540): HI **"ताकि कोई कस्टमर छूटे नहीं।"** EN **"So no customer slips away."**
  - Button-style pill, 360×72, radius 16, fill `#087f5b`, text white 28/700, y = 660: **Connect WhatsApp**, with the `[SAMYOJ_URL]` below in 32/44 600 `#0f172a`.
  - Footer note, 20/28 `#64748b`, y = 1000: HI "चित्र एआई से बने हैं। ऐप स्क्रीन में डेमो डेटा है।" EN "Illustrations are AI-generated. App screens show demo data."
- Final 12 frames: music resolves, everything holds still.

**AI prompt A10**
```
[STYLE-LOCK] [CHARACTER-LOCK] Meera, relaxed and smiling, sits at a laptop in the boutique in bright morning light. Behind her, Arjun (Indian man, mid-20s, short black hair, light-blue half-sleeve shirt) folds sarees. A customer seen from behind walks in through the door. Camera: slow push-in 3%. Laptop screen shows only a soft white glow. 4 seconds, single take. [NEGATIVE-LOCK]
```

**VO**
- HI: सम्योज। अपना व्हाट्सएप नंबर जोड़िए — ताकि कोई कस्टमर छूटे नहीं।
- EN: Samyoj. Connect your WhatsApp number, so no customer slips away.
- *Delivery:* warm, certain, smaller than the rest. Let the last word breathe 0.5 s before the music resolves.

**Claims check:** one CTA, no price, no trial, no "free".

---

## 6. SCRIPT A: HINDI (voice-over only)

**Narrator:** warm, calm, friendly. Sarvam Bulbul, `hi-IN`, pace 1.0 (test 0.95–1.05). Write numbers and loanwords as shown (Devanagari). Pronounce **सम्योज** as *sam-yoj*; confirm with the founder (Doubt Q2).
**Word count:** 192. **Pace needed:** about 100 WPM including pauses.

| Scene | Time | VO (Devanagari) | Delivery |
|---|---|---|---|
| S1 | 0:00.4–0:05.5 | सौ से ज़्यादा मैसेज… और हर मैसेज, एक कस्टमर। | धीमा, थका पर गर्मजोशी भरा |
| S2 | 0:06.2–0:14.5 | कहीं जवाब देर से गया, कहीं फ़ॉलो-अप भूल गए, और रात की कॉल छूट गई। | तीन टुकड़े, आख़िरी पर उतार |
| S3 | 0:15.3–0:25.8 | मिलिए सम्योज से — आपके अपने व्हाट्सएप नंबर पर, पूरा बिज़नेस एक जगह। फ़ेसबुक से लॉग-इन कीजिए, नंबर चुनिए, बस। | मुस्कान, नाम पर थोड़ा ठहराव |
| S4 | 0:26.3–0:44.5 | सारे कस्टमर मैसेज, एक शेयर्ड इनबॉक्स में। आपकी टीम चैट असाइन करे, नोट छोड़े, और तैयार जवाब एक टैप में भेजे। चौबीस घंटे बाद भी — अप्रूव्ड टेम्पलेट से बात चलती रहे। | सधा हुआ, "एक टैप" पर चमक |
| S5 | 0:46.3–1:04.5 | एआई बॉट आपकी एफ़एक्यू सीखकर, कस्टमर की अपनी भाषा में जवाब देता है — दिन हो या रात। वेलकम और अवे मैसेज जैसे ऑटोमेशन साथ में। और जब चाहें, बॉट रोककर आप ख़ुद संभालें। | भरोसा दिलाने वाला, आख़िरी वाक्य नरम |
| S6 | 1:06.3–1:24.5 | कैंपेन के लिए अप्रूव्ड टेम्पलेट चुनिए, ऑडियंस चुनिए, और भेजने का समय तय कीजिए। मैसेज सिर्फ़ उन्हीं तक जाता है जिन्होंने हाँ कहा है। फिर देखिए — कितनों को पहुँचा, कितनों ने पढ़ा। | तीन-चरण की लय, "हाँ कहा है" पर ज़ोर |
| S7 | 1:26.3–1:41.8 | और जब कस्टमर व्हाट्सएप पर कॉल करे, तो एआई आपकी तरफ़ से फ़ोन उठा सकता है। कॉल ख़त्म होते ही, उसकी समरी उसी चैट में मिल जाती है। | हल्का उठाव, "उठा सकता है" विनम्र |
| S8 | 1:43.3–1:51.0 | कॉन्टैक्ट्स, टैग, टीम और रिपोर्ट — सब एक ही जगह। बुटीक हो, कोचिंग, क्लिनिक या सैलून। | सूची की तेज़ लय, अंत धीमा |
| S9 | 1:52.5–1:58.0 | सम्योज। अपना व्हाट्सएप नंबर जोड़िए — ताकि कोई कस्टमर छूटे नहीं। | गर्म, पक्का, अंतिम शब्द पर 0.5 सेकंड |

**On-screen Hindi text list (all scenes):** "हर मैसेज, एक कस्टमर।" · "देर से जवाब" · "फ़ॉलो-अप भूल गए" · "रात की कॉल छूटी" · "एक नंबर। पूरा बिज़नेस।" · "फ़ेसबुक से लॉग-इन" · "अपना नंबर चुनें" · "कनेक्टेड ✓" · "शेयर्ड इनबॉक्स" · "एआई बॉट + ऑटोमेशन" · "कैंपेन" · "एआई कॉल" · "कॉन्टैक्ट्स · टैग · टीम · रिपोर्ट" · "ताकि कोई कस्टमर छूटे नहीं।"

**If a take runs long:** apply the "Trim first" cut for that scene (§5). Then raise Bulbul pace to 1.05. Do not go above 1.1; Hindi gets hard to follow.

---

## 7. SCRIPT B: ENGLISH (voice-over only)

**Narrator:** same warm, calm voice. Sarvam Bulbul `en-IN` (or an Indian-English voice you prefer), pace 1.0. Target about 115 WPM, relaxed.
**Word count:** 191. English finishes each scene about 3–5 s early. That is intended: visuals land first, then the voice.

| Scene | Time | VO | Delivery |
|---|---|---|---|
| S1 | 0:00.4–0:05.0 | It's 11 PM. A hundred-plus WhatsApp messages. Every one, a customer. | Low, tired but warm. Pause after "messages." |
| S2 | 0:06.3–0:13.5 | A reply sent too late. A follow-up forgotten. A call missed at night. | Three beats, falling on the last |
| S3 | 0:15.3–0:24.5 | Meet Samyoj: your whole business, on your own WhatsApp number. Log in with Facebook, pick your number, and you're connected. | Smile at "Meet". Slow on the name |
| S4 | 0:26.3–0:41.5 | Every customer message lands in one shared Inbox. Your team can assign chats, leave notes, and send ready replies in one tap. And after the 24-hour window? Approved templates keep the conversation going. | Even, practical. Question tone on "window?" |
| S5 | 0:46.3–1:01.5 | An AI bot learns your FAQs and answers customers in their language, day or night. Welcome and away automations run alongside. And whenever you want, pause the bot and take over yourself. | Reassuring. Last line a warm hand-off |
| S6 | 1:06.3–1:21.5 | For campaigns, pick an approved template, choose your audience, and set the time. It goes only to people who've said yes. Then see how many received it, and how many read it. | Clear 3-step rhythm. Quiet on "said yes" |
| S7 | 1:26.3–1:38.5 | And when a customer calls you on WhatsApp, AI can pick up for you. When the call ends, a summary appears right in that chat. | Small narrative lift. Modest on "can" |
| S8 | 1:43.3–1:49.5 | Contacts, tags, team and reports, all in one place. Boutique, coaching, clinic, salon. | Quick list, slow close |
| S9 | 1:52.5–1:57.5 | Samyoj. Connect your WhatsApp number, so no customer slips away. | Warm, certain. Breathe on the last word |

**On-screen English text list:** "Every message is a customer." · "Late reply" · "Follow-up forgotten" · "Missed night call" · "One number. Your whole business." · "Log in with Facebook" · "Pick your number" · "Connected ✓" · "Shared Inbox" · "AI Bot + Automations" · "Campaigns" · "AI Calls" · "Contacts · Tags · Team · Reports" · "So no customer slips away."

---

## 8. What AI must NOT do (hard rules)

1. **No product UI, no app screens, no logos, no readable text** from any AI video model. Screens come from real captures. Words come from the type engine.
2. **No fake faces as customers or testimonials.** No quotes from "customers", no star ratings, no "trusted by" logos, no invented numbers about results.
3. **No WhatsApp / Facebook logo or UI replica.** Use the plain word "WhatsApp". If you use Meta's logo glyph anywhere, follow Meta's brand guidelines first. Do not use WhatsApp's own notification sound.
4. **No talking-head lip-sync.** The narrator is VO only. Turn model audio off.
5. **No photoreal people.** Illustrated 2.5D only (D2). Reject any take that drifts photoreal.
6. **No cultural clichés:** marigold overload, landmark postcards, head-wobble, exaggerated bindi/mangalsutra, "poverty" or "chaos" shorthand.
7. **No morphing:** reject takes where face, hair, outfit, or hands change mid-shot.
8. **No camera shake, glitch, flicker, lens flare, whip pans.**
9. **No claims beyond the catalog:** no live transfer, ROI, Facebook/Instagram, prices, free trial, plan names, "production-ready", "guaranteed", "never miss", "in minutes", or any % uplift.
10. **No Meta fee talk** and no mixing Meta message cost into any Samyoj price. Do not mention prices at all.

---

## 9. Deliverables, QC, and the 75 s cut

**Files**
- `samyoj-explainer-hi-2m.mp4`, `samyoj-explainer-en-2m.mp4` (1920×1080, 30 fps, burned-in captions)
- `.srt` per language, plus `hi-roman.srt` (Roman Hinglish)
- 9:16 versions of both (vertical safe area §3.1)
- Poster frame (frame 450, logo on mint) as `.jpg`

**75 s cut (ads, WhatsApp, Reels)**
Keep S1 (4 s), S2 (6 s), S3 (8 s), S4 (13 s), S5 (13 s), S7 (11 s), S9 (6 s) = 61 s. Add S6 (12 s) = 73 s. Drop S8. Re-trim VO with the "Trim first" cuts and re-time to 140 WPM English / 112 WPM Hindi.

**QC checklist (every item must pass)**
- [ ] First 3 s name the pain. Brand does not appear before 0:15.
- [ ] Real UI is on screen by 0:19.
- [ ] No AI-generated glyph, no melted text, no WhatsApp UI replica anywhere.
- [ ] All screen text is real or code-rendered. All numbers labelled "Demo data".
- [ ] Every claim in §5 "Claims check" respected. No price, trial, ROI, FB/IG, transfer.
- [ ] Hindi and English captions match the VO word for word.
- [ ] Hindi VO fits each scene window; English finishes 2+ s early.
- [ ] Loudness −16 LUFS, true peak −1 dBTP. Music 8–10 dB under VO.
- [ ] Works on mute and on a phone-width thumbnail (text still readable at 360 px wide).
- [ ] End card carries the AI-labelling line and one CTA.

**Build order (lazy path)**
1. Generate both VOs from §6/§7 → measure each scene → adjust scene frames if needed.
2. Seed the demo org (§3.7) and record each UI beat with a scripted browser capture at DPR 2 (repeatable, no hand-timing).
3. Build the motion-graphics animatic in code or After Effects using the §3 tokens (frame-exact; type rendered, not generated).
4. Generate AI keyframes → approve → image-to-video for A1–A10.
5. Composite, captions, audio mix, QC, export.

---

## 10. Open questions for the owner

| # | Question | My default if you don't answer |
|---|---|---|
| Q1 | **Which logo?** Sidebar = green + navy. Login page = newer purple-blue ("Business Automation & CRM"). | Green + navy (D8), matching the app UI the video shows. |
| Q2 | **How is "Samyoj" pronounced** and is it spelled सम्योज or संयोज in Hindi? | सम्योज (*sam-yoj*) |
| Q3 | **Final URL / CTA** for `[SAMYOJ_URL]`. | Placeholder stays; the button reads "Connect WhatsApp". |
| Q4 | **Illustrated or photoreal** people? | Illustrated (D2). |
| Q5 | **Narrator voice:** female or male? | Female, warm. |
| Q6 | **Real-capture environment:** can we run `bash start.sh` with a seeded demo org for the screen captures, or do you want mock screens built in Figma? | Real capture from a seeded demo org (needs `NGROK_AUTHTOKEN` only for inbound; outbound screens do not need it). |
| Q7 | **AI Bot and AI Calls are plan-gated.** Is it fine to show them with no plan mention? | Yes, no plan mention. |
