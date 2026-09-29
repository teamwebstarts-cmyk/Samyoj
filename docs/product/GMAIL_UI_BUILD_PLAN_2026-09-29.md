# Email (Gmail) UI — Build plan & decoded design tokens

**Date:** 2026-09-29 · **Source of truth:** `mail ui ux /` images 1–8 + `desshboad3d svg md` SVG
**Scope (locked with user):** UI-first build of **Email Dashboard → Compose → Templates**, then backend wiring.
**Not in this pass:** Sent log page, multi-send wizard (gated Phase 2 per `GMAIL_SEND_CHANNEL_RECHECK_2026-09-29.md`).

---

## 1. Decoded design language (from pixel analysis of the 8 mockups)

### Color tokens

| Token | Value | Evidence |
|-------|-------|----------|
| `--email-primary` | **`#fd2058`** (vivid pink-red) | Send Email button (`image copy 3`), Connect Gmail (`image copy 7`), Save Template (`image copy 6`), wizard steps (`image copy 4`) — all mode `#fd2058`/`#fd225e` |
| `--email-primary-hover` | `#e91d50` (≈6% darker) | standard darken |
| `--email-blue` | **`#1a73e8`** (Gmail/Google blue family) | Gmail M glyph, "Connected via Google" links, info accents (`image copy 2`, compose) |
| `--email-green` | `#00c060` / emerald `#00c078` | Connected chips, "Accepted by Gmail" chips, "Valid email" checks |
| `--email-amber` | `#f08020` family | Send icon in some states, warnings |
| `--email-red` | `#f01818` family | Failed chips, errors |
| `--email-purple` | `#a55be6` family | SVG illustration accents, avatar gradients |
| Page background | `#f2f5fe` (cool gray-blue wash) | all mockups |
| Card background | `#fbfcfe` (near-white) | all mockups |
| Border | `#e5e9f4` light blue-gray | all mockups |

### Typography
- Same system stack as the app (Inter-family as used in `index.css`).
- Mockups show: bold section titles (~15–16px, 700–800), 9.5–11px secondary text, counters like `0/200` right-aligned muted.
- Icon style: Lucide outline icons (matches existing app).

### Components observed in mockups (shared vocabulary)
- **Status chips:** Connected (green dot + label), Accepted by Gmail (green), Failed (red), Not connected (gray/amber)
- **Checklist rows:** circled check icon + text ("Contact has a valid email address")
- **Counter chips:** `0/200`, `0/2000`, `0/50000`, `0/50`
- **Variable chips:** `{{name}}` `{{email}}` `{{phone}}` + "Copy all"
- **Limits notice:** amber/gray info card — "Google limits this mailbox — about 500 emails a day on free Gmail, about 2,000 a day on paid Workspace." + Learn more
- **Quick tip cards:** icon + title + one-line description grid

---

## 2. Route & navigation wiring (to implement)

```text
Routes:
  /email                    → EmailDashboardPage   (stats, recent sent, quick actions, SVG hero)
  /email/compose            → EmailComposePage     (one contact + send — the ONLY send surface in v1)
  /email/templates          → EmailTemplatesPage   (list + editor + preview)

Sidebar: new platform dropdown "Email" in CHANNEL_PLATFORMS (accent: email → #fd2058 family)
pageMeta: /email → "Email", subtitle "Send from your connected Gmail. Not an inbox."
sidebarChannelAccent: '/email' → 'email'
```

Settings → Channels gets a `GmailPagePanel` (image 8) — not in the first UI pass, but part of this plan.

**Recheck guardrails carried into UI copy:** "Accepted by Gmail" (never Delivered/Read), no inbox, no remaining-quota counter, limits copy exactly as mockups, admin/owner gating.

---

## 3. Build order (UI-first with mock data)

| Step | Screen | Source images | Deliverable |
|------|--------|--------------|-------------|
| 1 | **Email Dashboard** `/email` | `image.png` + SVG illustration | Stats row (Total sent 124, Accepted 118, Failed 6, Templates 8 — with trend chips), limits notice, Recent sent table (5 rows, status chips), Quick actions grid, "Before you send" checklist, 3D SVG hero artwork |
| 2 | **Compose** `/email/compose` | `image copy 2/3.png` (+2-col layout with right rail from `image copy.png`) | From (read-only mailbox + "Connected via Google"), To (contact picker), template selector, Subject 0/200, Message 0/2000, HTML optional 0/50000, right rail: Recipient details + eligibility checks + Message preview (Plain text/HTML tabs) + Quick tips + Sending limits. Send button disabled until eligible; toast "Accepted by Gmail" |
| 3 | **Templates** `/email/templates` | `image copy 6.png` | List + editor: name 0/50, subject 0/200, plain text 0/2000, HTML editor toolbar, variables chips + Copy all, live Preview panel (Plain/HTML tabs, From/To/Subject header), tips checklist, Save Template |

After user approves all three screens pixel-wise → **backend wiring** (GmailMailbox, EmailSend, OAuth gmail.send, EmailTemplate) per spec §8.

## 4. Component inventory (client)

```text
client/src/pages/email/
  EmailDashboardPage.tsx
  EmailComposePage.tsx
  EmailTemplatesPage.tsx
  email.css                    (scoped styles, tokens above)

client/src/components/email/
  EmailStatsRow.tsx
  EmailRecentSentTable.tsx     (mock rows now, real API later)
  EmailQuickActions.tsx
  EmailBeforeYouSend.tsx
  EmailLimitsNotice.tsx
  EmailSvgHero.tsx             (inline SVG from desshboad3d svg md, with motion)
  GmailGlyph.tsx               (Gmail "M" logo mark)
  ComposeForm.tsx
  ContactPicker.tsx
  RecipientPanel.tsx
  MessagePreview.tsx
  QuickTips.tsx
  TemplateList.tsx
  TemplateEditor.tsx
  TemplatePreview.tsx
  VariableChips.tsx
```

Mock data module: `client/src/pages/email/mockData.ts` (stats, recent sends, templates, sample contacts incl. Rohit Sharma / rohit.sharma@gmail.com).

## 5. Acceptance criteria (UI pass)

### Recheck audit (2026-09-29) — gaps found & fixed

| # | Gap | Fix |
|---|-----|-----|
| 1 | Contact picker: no Escape/outside-click close, no aria | Added `useEffect` doc listeners + `aria-expanded`/`aria-haspopup` |
| 2 | Dashboard "View all" wrongly pointed to Compose | Moved to table footer; "Manage connection" ghost button added to hero (mockup 1) |
| 3 | "Showing 5 of 124 emails" footer missing | Added footer with count + View all link |
| 4 | Compose header missing "Need help?" | Added link to /tickets |
| 5 | `ⓘ` as text glyph — inconsistent | Replaced with lucide `Info` + `aria-hidden` |
| 6 | Template delete had no confirmation | ConfirmDialog wired (brief §4.4 requires confirm) |
| 7 | Multi-send quick action was an active link | Replaced with locked `MultiSendLockedCard` (Phase 2 gate, recheck Correction 4) |
| 8 | Settings → Channels hint missing Gmail | 'WhatsApp, Facebook, Instagram, Gmail' |
| 9 | No keyboard focus visibility | `:focus-visible` outline + `prefers-reduced-motion` respected |

### Recheck audit — verified as correct (no change needed)

- Copy honesty: "Accepted by Gmail" (never Delivered/Read), "Not an inbox", no remaining-quota counter, exact Google limits copy — present on all three screens
- SVG hero ported 1:1 incl. animations + reduced-motion guard
- Dark mode tokens derived (light mockups only)
- Routes/nav/pageMeta/sidebar accent wired; Settings panel + backend deliberately deferred (UI-first decision)
- Responsive: rail stacks <1024px, hero art hides <640px, stats collapse to 2/1 col, buttons wrap

### Known deferred items (intentional, per locked decisions)

- Settings → Channels GmailPagePanel (mockup 8) — next UI pass
- Sent log page + multi-send wizard (mockups 5-6) — Phase 2 gated
- Backend: GmailMailbox, EmailSend, EmailTemplate models; OAuth `gmail.send` flow; send worker — after pixel approval (spec §8, §11 Phase 1)
- Contact `emailOptedIn` fields + Contacts "Can email this contact" toggle (brief §4.6) — backend pass

- [ ] Each screen visually matches its mockup: same copy, same chips, same icon set, same order of blocks
- [ ] Colors match decoded tokens (`#fd2058` primary actions, `#f2f5fe` page bg, `#1a73e8` Gmail blue)
- [ ] Responsive: mockups are desktop-first; at <lg the right rail stacks below the form; sidebar collapses to drawer (existing Layout behavior)
- [ ] Dark mode: derive dark tokens from existing app dark palette (page bg `#0b1020` family, cards `#111827` family) — mockups are light-only
- [ ] No "Delivered"/"Read" copy anywhere; no inbox UI; no remaining-quota counter
- [ ] Typecheck (`tsc --noEmit`) passes; routes appear in sidebar with Email accent
