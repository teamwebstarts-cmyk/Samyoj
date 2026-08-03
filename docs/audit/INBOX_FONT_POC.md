# Inbox Font POC — Competitive Comparison & Recommendation

> **Date:** 2026-08-03  
> **Scope:** Typography for Samyoj Inbox (list names, filters, thread chrome).  
> **Constraint:** Do not ship a global font swap unless the design system already owns it. Prefer a scoped `.inbox-shell` preview.

---

## 1. Competitive snapshot

| Product | Body / UI | Display / titles | Inbox density feel |
|---|---|---|---|
| **WhatsApp Web** | System stack (Segoe / Helvetica Neue / SF) | Same family, heavier weight | Extremely dense, neutral, “OS native” |
| **Intercom** | **Inter** | Inter (semibold/bold) | Productive SaaS; highly legible at 13–14px |
| **Front** | Inter / Inter-like neo-grotesque | Same + slightly tighter tracking on titles | Clean shared-inbox; soft geometric |
| **Linear** | Inter Variable (customized) | Same family, optical sizing | Sharp, high-contrast, engineer-forward |
| **respond.io / Wati-style B2B WA** | Inter or system sans | Brand sans at 600–700 | Practical CRM density; little display flair |

**Pattern:** Serious inbox products converge on a **single neo-grotesque** (Inter or system) for body *and* titles. Display faces are rare in the conversation list itself.

---

## 2. Why the current Inbox type feels weak

1. **Plus Jakarta Sans is already the design-system sans** (`index.html` + Tailwind `fontFamily.sans` → applied on `html` via preflight). The weakness is not “missing font file” — it is **optical**: Jakarta’s wide geometric glyphs read softer than Inter at 12–13px list density.
2. Weight hierarchy is under-used in places (medium where semibold would separate unread names from preview).
3. No Inbox-scoped tuning (`-webkit-font-smoothing`, CSS variable for easy A/B) — hard to preview an alternate without touching the whole app.
4. Competitor inboxes (Intercom / Linear / Front) train the eye on **Inter’s taller x-height**; Jakarta next to mint UI can feel “marketing-page” rather than “ops console” until weights are dialed.

---

## 3. Recommendation (1–2 fonts)

### Primary (ship for Inbox preview): **Plus Jakarta Sans**

| Role | Font | Weights |
|---|---|---|
| **UI body / list names / filters** | Plus Jakarta Sans | 500 / 600 / 700 |
| **Titles** (“Inbox”, contact name in header) | Same family | 700 / 800 |

**Why this wins for Samyoj**

- Already in the stack (`index.html` + `tailwind.config.js`) — **zero new dependency**.
- Friendlier geometric shapes than Inter → fits WhatsApp-adjacent B2B without looking like every Intercom clone.
- Strong bold weights for unread names and the Inbox title.
- One family keeps the 3-pane shell calm (matches competitor “single face” pattern).

### Optional denser alternate (A/B later): **Inter**

Use only if agents complain that Plus Jakarta feels “wide” in long agent-name filters or 1k+ lists. Inter’s taller x-height packs slightly better at 12.5px. Load via Google Fonts only if an A/B decides against Jakarta.

**Do not** introduce a second display face (serif / decorative) in the Inbox list — it fights the mock’s clean CRM look.

---

## 4. How to wire

### Already done (scoped preview)

`client/src/index.css` on `.inbox-shell`:

```css
.inbox-shell {
  --inbox-font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-family: var(--inbox-font-sans);
  -webkit-font-smoothing: antialiased;
}
```

Google Fonts link (existing) in `client/index.html`:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
  rel="stylesheet"
/>
```

Tailwind (existing):

```js
fontFamily: {
  sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
},
```

### Promote to whole app (later, explicit decision)

```css
/* index.css @layer base */
body {
  font-family: theme('fontFamily.sans');
}
```

or `className="font-sans"` on the root layout shell. **Not applied globally in this POC.**

### Try Inter as Inbox-only A/B

1. Add Inter to the Google Fonts link.  
2. Override:

```css
.inbox-shell {
  --inbox-font-sans: 'Inter', system-ui, sans-serif;
}
```

---

## 5. Decision

| Choice | Action |
|---|---|
| **Recommended now** | Plus Jakarta Sans on `.inbox-shell` only (preview) |
| **Global later** | Apply `font-sans` on `body` once product agrees |
| **Reject for Inbox** | Decorative display fonts; purple/cream “AI default” stacks |

---

## 6. Acceptance checklist

- [x] Competitive table documented  
- [x] Root cause of “weak” type called out (font linked but not applied)  
- [x] Pairing = Plus Jakarta (body + titles); Inter optional  
- [x] Scoped `.inbox-shell` CSS variable preview  
- [ ] Global `body` font — **deferred** until explicit product sign-off  
