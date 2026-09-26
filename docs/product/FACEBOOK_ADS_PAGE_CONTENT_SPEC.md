# Facebook → Ads — content & feature spec (for UI generation)

**Purpose:** Describe what the **Facebook Ads performance** screen is for, what content appears, how features behave, and how that maps to **code that exists today** — so a designer or UI generator can lay out screens without inventing product scope.

**Route:** `/facebook/ads`  
**Nav label:** Facebook section → **Ads** (mobile drawer: **Facebook Ads**)  
**Primary code:** `client/src/pages/FacebookAdsPage.tsx`  
**Dashboard teaser:** `client/src/components/dashboard/MetaAdsRecap.tsx` (same API payload)  
**API:** `GET /api/facebook/ads-summary`, `GET /api/facebook/ads-accounts`, `POST /api/facebook/ads-account`  
**Server:** `server/src/modules/facebook/ads-insights.ts`, Graph calls in `server/src/modules/facebook/page-client.ts`

**Not in scope for this page (do not show as if shipped):** create or edit campaigns, ad sets, ads, budgets, audiences, creatives; pause or boost; date-range picker; per-campaign or per-ad breakdown; charts; ROI that mixes Samyoj revenue with ad spend; WhatsApp Click-to-WhatsApp ad metrics as a separate product surface; billing plan changes when spend changes.

---

## 1. Product story (one paragraph)

Samyoj shows **read-only Meta Ads Manager numbers** for an ad account the connected Facebook **login** can read (`ads_read`). Agents and owners see **last 7 days** spend, impressions, clicks, **Meta-reported lead actions**, and **cost per lead** for that window — with attribution labeled **7-day click / 1-day view**. Money spent on Meta is **Meta’s invoice**, not Samyoj subscription revenue. To change ads, users leave Samyoj via **Open Ads Manager**. **Instant Form leads** that land in the CRM are a **separate** path (webhook → Contacts pipeline, source **Meta Ads**); this page does not list those individual leads.

---

## 2. Who sees what (access & roles)

| Topic | Behavior in code |
|--------|------------------|
| **Who can open Ads** | Any signed-in org member (`authenticate` + `requireOrg` on `GET /ads-summary` and `GET /ads-accounts`). |
| **Who can connect / reconnect Page** | **OWNER** or **ADMIN** (`useMetaChannelConnect` → `canConnect`). Empty-state CTAs show **Ask an admin** when the user cannot connect. |
| **Who can pick ad account** | **OWNER** or **ADMIN** only (`POST /ads-account` uses `requireOrgRole('OWNER', 'ADMIN')`). Agents see the dropdown **disabled** and copy: **“Ask an owner or admin to change this.”** |
| **Commercial plan** | Page **connect** OAuth (`GET /connect-url`) requires `requireActiveCommercial()`. **Viewing** ads summary does not re-check commercial on each read — but without a connected Page there is nothing to show. |
| **WhatsApp number** | Ads snapshot is **org-scoped** (`meta_ads_snapshots.organizationId` unique). No `whatsappNumberId` header on this page. |
| **OAuth scope** | Page connect requests `ads_read` among other scopes (`FACEBOOK_PAGE_LEADGEN_SCOPES` in `connect-oauth-state.ts`). **No** `ads_management` — cannot mutate ads from Samyoj. |

---

## 3. Connection / data states (what the page “means”)

The summary API returns `status` plus optional `snapshot`. The UI shows the **metric card** only when `status === 'ready'` and `snapshot` is non-null.

| Status | User-facing meaning | Content to show |
|--------|---------------------|-----------------|
| **`no_page`** | No active `Channel` with `platform: FB` (or no Page token) | Guide: **“Connect a Facebook Page first”** + numbered steps + **Connect Page** / **Ask an admin**. |
| **`needs_permission`** | Graph denied `ads_read` (or token/permission errors mapped as permission) | Guide: **“Ads read is not granted yet”** — add Ads read on Meta app, reconnect Page. Explicit: WhatsApp still works; page does not show fake ₹0. |
| **`no_account`** | Page connected but `/me/adaccounts` on the **user** Ads-read token returned nothing | Guide: **“No ad account on this Facebook login”** — reconnect Page with the Ads Manager login. Explicit: WhatsApp still works; page does not show fake ₹0. |
| **`error`** | Refresh failed and no usable cached snapshot | Guide: **“Could not read Ads Manager”** + **Try again** (reloads summary + accounts). |
| **`ready`** | Snapshot stored and returned | Spend hero + four fact tiles + footer (account picker if needed) + **Open Ads Manager**. |

**Important:** A day with **zero delivery** can still be `ready` with numeric zeros — that is real Meta data, not the same as `no_account`.

**Stale data:** On each `readAdsSummary`, if snapshot is missing, older than **20 hours**, or tied to a different FB channel, server calls `refreshOrgAdsSnapshot`. Background job also runs `pollMetaAdsSnapshots` on API worker boot and every **24 hours** for all orgs with an active FB channel.

---

## 4. Page information architecture (content blocks)

### 4.1 Page header (in-page; topbar is separate)

| Element | Copy in code today | Notes |
|---------|-------------------|--------|
| Eyebrow | **Facebook · read only** | Blue `#1877F2`, uppercase small label |
| Title | **Ads performance** | Matches `pageMeta` title |
| Subtitle | `{periodLabel} · {attributionLabel}. This spend is Meta’s. It is not added to your Samyoj plan, and this page cannot create or pause an ad.` | Defaults: **Last 7 days** · **7-day click / 1-day view** from server constants |

**Topbar** (`pageMeta`): title **Ads performance**, description **Meta's numbers. Not Samyoj revenue.**

### 4.2 Main content (mutually exclusive by state)

| Block | When |
|-------|------|
| Loading spinner | Initial fetch |
| **Guide** card (title, body, numbered steps, optional action) | Any non-ready status (see §3) |
| **Metrics card** | `ready` + snapshot |
| **Open Ads Manager** link below guides | When `adsManagerUrl` is set but snapshot is hidden (some error paths still expose URL) |

There is **no** second column, filters, tabs, or education strip on this page today (unlike Instagram Comments).

### 4.3 Metrics card (`ready`)

| Zone | Content |
|------|---------|
| **Spend block** | Label **Spend**; large formatted currency from `snapshot.spend` + `snapshot.currency` (`Intl.NumberFormat`; fallback `CURRENCY amount`) |
| **Fact grid (2×2 mobile, 1×4 desktop)** | **Impressions**, **Clicks**, **Leads**, **Cost per lead** — locale-formatted integers; CPL **—** when `cpl` is null |
| **Footer row** | Ad account selector **or** one-line “One ad account for this organization.” + **Open Ads Manager** |

---

## 5. Metrics — definitions (product truth)

All numbers come from **one** Graph Insights call per refresh:

`GET /{ad_account_id}/insights?fields=spend,impressions,clicks,actions,date_start,date_stop&date_preset=last_7d&level=account&action_attribution_windows=["7d_click","1d_view"]`

Parsed in `parseInsightsBody` / `leadCountFromActions`.

| UI label | Source | Rules |
|----------|--------|--------|
| **Spend** | `spend` field | String money, 2 decimal places in storage |
| **Impressions** | `impressions` | Rounded non-negative integer |
| **Clicks** | `clicks` | Rounded non-negative integer |
| **Leads** | `actions` | First match: `action_type` **`lead`**, else **`onsite_conversion.lead_grouped`**. Prefer `7d_click` + `1d_view` windows when present; else `value`. |
| **Cost per lead** | Derived | `spend / leads` when `leads > 0`; else null → UI **—** |

| Field stored but not prominently shown | Use |
|----------------------------------------|-----|
| `periodStart` / `periodEnd` | From Insights `date_start` / `date_stop` on snapshot row; not rendered on Ads page today |
| `fetchedAt` | Snapshot freshness; not shown in UI |
| `adAccountId` | Drives Ads Manager deep link |

**Do not equate “Leads” tile with:**

- Count of **Meta Ads** rows in Contacts pipeline (`Lead.source = META_ADS`) — different system, different timing.
- **Won** deals or WhatsApp conversation starts.
- Analytics page “pipeline” metrics (`/analytics` copy: *Meta ads beside your pipeline. No combined ROI.*).

---

## 6. Ad account selection

| Case | UI |
|------|-----|
| **0 accounts** | Status `no_account` guide (no picker) |
| **1 account** | Footer text: **“One ad account for this organization.”** Server picks first **ACTIVE** (`account_status === 1`) or first in list |
| **2+ accounts** | `<select>` **Ad account** — options: `{name \|\| id} · {currency \|\| 'currency unavailable'}` |

**On change:** `POST /facebook/ads-account` with `{ adAccountId }` → saves `organization.settings.meta.adsAccountId` → immediate `refreshOrgAdsSnapshot` → client reloads.

**Errors:** Toast **“Could not select ad account”** or server message (e.g. account not available to Page).

**Ads Manager URL:** `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act={id}` (strips `act_` prefix for query).

---

## 7. Dashboard recap (secondary surface)

`MetaAdsRecap` on Dashboard:

- Hidden until `ads-summary` returns `ready` + snapshot (failures are silent).
- One line: **Meta ads · {spend} spend · {leads} leads · CPL {cpl}**
- Subline: **Meta's numbers. Not Samyoj revenue.** + period/attribution + link **View** → `/facebook/ads`.

Same endpoint — not a second calculation.

---

## 8. End-to-end journey (for onboarding copy)

```text
Owner/admin connects Facebook Page (OAuth includes ads_read)
        ↓
Samyoj stores the encrypted user token and lists GET /me/adaccounts
        ↓
Picks preferred or saved adsAccountId
        ↓
Insights poll (on page load if stale, daily worker, after account change)
        ↓
Snapshot in DB → Facebook → Ads + optional Dashboard recap
        ↓
User edits campaigns in Ads Manager (outside Samyoj)
```

**Lead Ads (related, not this screen):** Instant Form submit → `leadgen` webhook → Contact/Lead in pipeline with source **Meta Ads**. Configure forms and ads in Meta; Samyoj only ingests leads after connect.

---

## 9. Meta / industry context (safe wording only)

| Industry pattern | Samyoj today | Safe UI wording |
|------------------|--------------|-----------------|
| Ads Manager performance summary | Shipped (account-level, 7d preset) | “Last 7 days” / “Meta’s numbers” |
| Create / pause / duplicate ad | **Not shipped** | “This page cannot create or pause an ad” (already on page) |
| Campaign breakdown table | **Not shipped** | Do not show |
| Custom date range | **Not shipped** | Do not show |
| Lead Ads CRM list | Shipped under **Contacts → Pipeline** filter | Cross-link only; not on Ads page |
| Combined ROAS with Samyoj billing | **Not shipped** | “Not added to your Samyoj plan” |

---

## 10. Errors & edge cases (user-visible)

| Situation | Message / behavior |
|-----------|-------------------|
| API load failure | Toast: **“Could not load Ads insights”** |
| Permission missing | Guide **Ads read is not granted yet** + reconnect CTA |
| Refresh fails, old snapshot exists | Server may still return `ready` with last good snapshot |
| Refresh fails, no snapshot | `error` guide + Try again |
| Agent changes account dropdown | Disabled; **Ask an owner or admin to change this.** |
| Invalid account POST | **That ad account is not available to the connected Page.** (400) |

---

## 11. Suggested UI generation brief (copy deck)

**Screen title:** Ads performance  
**Channel:** Facebook (Page-connected, read-only Ads Insights)

**Hero subtitle (always):**  
“Last 7 days · 7-day click / 1-day view. This spend is Meta’s. It is not added to your Samyoj plan, and this page cannot create or pause an ad.”

**Ready state — primary metric:** Spend (large)  
**Secondary metrics:** Impressions · Clicks · Leads · Cost per lead  

**Primary external action:** Open Ads Manager  
**Primary in-app setup actions:** Connect Page · Reconnect Page · Open Business Settings (no account)

**Cross-links (navigation only):**

- Settings → Facebook Page connect (`FacebookPagePanel`, `/settings` tab)
- Contacts → Pipeline → `source=META_ADS` (individual Instant Form leads)
- Dashboard → View (recap link)

---

## 12. Code reference map (for implementers)

| Concern | Location |
|---------|----------|
| Page UI | `client/src/pages/FacebookAdsPage.tsx` |
| Dashboard recap | `client/src/components/dashboard/MetaAdsRecap.tsx` |
| API client | `client/src/services/api.ts` → `facebookApi.adsSummary`, `adsAccounts`, `selectAdsAccount` |
| Routes | `server/src/modules/facebook/routes.ts` |
| Snapshot logic | `server/src/modules/facebook/ads-insights.ts` |
| Graph Insights + account list | `server/src/modules/facebook/page-client.ts` → `listAdAccounts` (`GET /me/adaccounts`), `fetchAdAccountInsights` |
| DB model | `MetaAdsSnapshot` in `server/prisma/schema.prisma` |
| Worker poll | `server/src/workers/index.ts` → `pollMetaAdsSnapshots` |
| Phase product rules | `docs/meta-ecosystem/phases/05-ads-read.md` |
| Lead Ads (separate) | `docs/meta-ecosystem/phases/01-lead-ads.md`, `leadgen-ingest.ts` |

---

## 13. Honest limits (FAQ / footer, not broken UI)

- **Account-level only** — no campaign/ad set/ad names in API or UI.  
- **Fixed window** — `last_7d` preset only; attribution windows fixed in Graph query.  
- **One snapshot row per org** — switching Page or org does not keep per-account history in DB.  
- **Token scope** — Meta App Review must grant **ads_read**; without it, guides explain reconnect — Samyoj does not fabricate zeros.  
- **Numbers vs Ads Manager** — should be ballpark same account/window; Samyoj does not guarantee real-time parity (cache up to ~20h on read path + 24h poll).  
- **Leads tile** — Meta Insights lead actions, not pipeline cardinality.

---

*Document version: aligned to codebase as of 2026-09-26. For UI mockups and AI layout generation; not a commitment to add features listed as “not shipped”.*
