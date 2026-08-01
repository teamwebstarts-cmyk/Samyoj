# WhatsApp Connection Flow — Complete Analysis

> Date: 2026-07-31  
> Purpose: Understand the exact WhatsApp connection flow for normal users, developers, and testing — then compare with competitors (Interakt, Wati, AiSensy) to identify gaps and production-readiness issues.

---

## Table of Contents

1. [Current Flow in Samyoj](#1-current-flow-in-samyoj)
2. [Competitor Flows](#2-competitor-flows)
3. [Side-by-Side Comparison](#3-side-by-side-comparison)
4. [Production Readiness Issues](#4-production-readiness-issues)
5. [What Needs to Change for Production](#5-what-needs-to-change-for-production)
6. [Env Variables & Secrets — Production POC](#6-env-variables--secrets)
7. [Recommended Flow for Samyoj](#7-recommended-flow-for-samyoj)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. CURRENT FLOW IN SAMYOJ (UPDATED)

### 1.1 Supported Connection Method

Samyoj exposes one user-facing way to connect a WhatsApp number:

| Method | Who Uses It | Flow |
|--------|-------------|------|
| **Connect WhatsApp** | All users | Uses Samyoj's platform Meta App — no App ID/Secret input |

### 1.2 Normal User Flow (Platform App ID) — UPDATED STATE

This is what a **normal user** (business owner) experiences:

```
Step 1: User signs up on Samyoj
  → Creates account + org (OWNER role)
  → Lands on Dashboard

Step 2: User goes to Settings → WhatsApp
  → Sees "Connect WhatsApp" button (NO App ID/Secret input needed)
  → Platform credentials are already configured by the operator
  → Clicks "Connect WhatsApp"

Step 3: Meta OAuth popup
  → Uses Samyoj's platform App ID (user doesn't see it)
  → User logs into Facebook Business Manager
  → Selects/creates WABA (WhatsApp Business Account)
  → Selects/enters phone number
  → Meta sends OTP to phone
  → User enters OTP
  → Meta redirects back to: /settings/whatsapp/callback?code=...&state=...

Step 4: Samyoj callback handler
  → Verifies state (signed JWT)
  → Exchanges code for access token (short-lived → long-lived)
  → Lists available phone numbers
  → If 1 number: auto-connects
  → If multiple: shows selection UI
  → Saves encrypted access token to DB (WhatsappNumber model)
  → Fires webhook auto-configuration (fire-and-forget)

Step 5: Webhook setup
  → Samyoj registers webhook URL with Meta
  → Subscribes WABA to app
  → Inbound messages now flow to Samyoj

Step 6: User can now send/receive messages
  → Outbound: works immediately (Graph API + token)
  → Inbound: needs public HTTPS webhook
```

### 1.3 Custom Meta Apps

Custom App ID/Secret entry is intentionally not exposed in the product UI.
Developers use the same **Connect WhatsApp** flow as every other user.

---

## 2. COMPETITOR FLOWS

### 2.1 Interakt (interakt.shop)

**Target user:** Small/medium businesses in India  
**Positioning:** "WhatsApp Business API made easy"

**Connection flow for normal user:**

```
Step 1: Sign up on Interakt
  → Google signup or email
  → Enter business details (name, industry, timezone)

Step 2: Click "Connect Number" in dashboard
  → Interakt's OWN Meta App handles OAuth (user never sees App ID/Secret)
  → User clicks "Continue with Facebook"
  → Meta OAuth popup opens (Interakt's App ID is pre-configured)

Step 3: Meta OAuth
  → Log into Facebook Business Manager
  → Create/select WABA
  → Enter phone number
  → Verify via OTP (SMS/voice call)
  → Meta approves within 2-24 hours

Step 4: Coexistence option (unique to Interakt)
  → Can keep using WhatsApp Business App on same number
  → Scan QR code from Business App to link
  → Both Interakt and Business App work simultaneously

Step 5: Go live
  → Number connected
  → Can send/receive immediately (limited until business verification)
  → Full access after Meta business verification (3 days - 4 weeks)
```

**Key differentiators:**
- User NEVER deals with App ID/Secret
- Interakt's platform IS the Meta App
- Coexistence feature (use Business App + API simultaneously)
- Business verification guidance
- Clear OTP-based phone verification

### 2.2 Wati (wati.io)

**Target user:** SMBs, agencies  
**Positioning:** "WhatsApp Team Inbox + Automation"

**Connection flow for normal user:**

```
Step 1: Sign up on Wati
  → Business email + phone verification
  → Enter company details

Step 2: Dashboard → "Connect WhatsApp"
  → Wati's OWN Meta App handles OAuth
  → Two options:
    a. Embedded Signup (new number)
    b. Coexistence (existing Business App number)

Step 3a: Embedded Signup
  → "Continue with Facebook"
  → Create/select WABA
  → Enter phone number (not active on any WhatsApp account)
  → OTP verification
  → Instant connection

Step 3b: Coexistence (CoEx)
  → Select "Connect existing Business App"
  → Enter phone number (same as Business App)
  → Scan QR code from Business App
  → Both platforms synced

Step 4: Go live
  → Number active immediately
  → Wati inbox ready
  → Full access after business verification
```

**Key differentiators:**
- Two clear paths: new number vs coexistence
- Clear prerequisite: number must not be on WhatsApp already
- Coexistence via QR code (elegant)
- Guided business verification process

### 2.3 AiSensy (aisensy.com)

**Target user:** Indian SMBs, Hindi-speaking market  
**Positioning:** "WhatsApp Marketing + API in Hindi"

**Connection flow for normal user:**

```
Step 1: Sign up on AiSensy
  → Google signup OR form
  → Mobile OTP verification
  → Business details (name, industry)

Step 2: Dashboard → "Apply for WhatsApp API"
  → AiSensy's OWN Meta App handles OAuth
  → "Continue with Facebook" button
  → Meta redirects to OAuth

Step 3: Meta OAuth
  → Select Facebook Business Manager
  → Create WhatsApp Business Profile (display name, category)
  → Enter phone number (fresh number — not on WhatsApp)
  → OTP via SMS/voice call
  → Submit application

Step 4: Approval
  → Meta reviews (typically 10 minutes)
  → Status changes to "LIVE" in dashboard
  → Can send/receive immediately

Step 5: Start using features
  → Broadcasting, automations, chatbots available immediately
  → Business verification for unlimited access
```

**Key differentiators:**
- Hindi language support in docs
- 10-minute Meta approval (claimed)
- Clear prerequisite: "fresh number" or delete existing account
- Mobile app for on-the-go management

---

## 3. SIDE-BY-SIDE COMPARISON

| Aspect | Samyoj (Current) | Interakt | Wati | AiSensy |
|--------|-----------------|---------|------|---------|
| **User sees App ID/Secret?** | ✅ YES (problem) | ❌ NO | ❌ NO | ❌ NO |
| **Who owns Meta App?** | User (complex) | Interakt | Wati | AiSensy |
| **Embedded Signup?** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Coexistence (same number)?** | ❌ No | ✅ Yes | ✅ Yes | ❌ No (ask support) |
| **OTP phone verification?** | ✅ Yes (via Meta) | ✅ Yes | ✅ Yes | ✅ Yes |
| **Business verification guidance?** | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Number selection UI?** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Webhook auto-setup?** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Multi-number support?** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Normal user can connect?** | ❌ NO | ✅ YES | ✅ YES | ✅ YES |

### 3.1 The Core Issue

| | Samyoj | Competitors |
|---|--------|-------------|
| **Meta App** | Each org needs their own App ID/Secret | Platform's single App ID |
| **User experience** | "Enter App ID" (confusing) | "Click Continue with Facebook" |
| **Target user** | Developers only (currently) | Non-technical business owners |
| **Production ready?** | ❌ No | ✅ Yes |

---

## 4. PRODUCTION READINESS ISSUES

### 4.1 Critical: Normal Users Cannot Connect

**Problem:** The current flow requires `META_APP_ID` and `META_APP_SECRET` to be configured per-org (via Settings UI) or in `server/.env` (global).

**Impact:** A normal business owner signing up to Samyoj cannot connect WhatsApp because:
1. They don't know what a Meta App ID is
2. They don't have a Meta App
3. Creating a Meta App requires developer.facebook.com access + business verification

**Competitors solve this by:** Being a Meta Business Solution Provider (BSP) — their platform's App ID is pre-configured for all users.

### 4.2 Critical: Webhook URL Configuration

**Problem:** `META_WEBHOOK_URL` is in `server/.env` (global config). For production:
- Each org may have different webhook URLs
- Webhook URL must be HTTPS and publicly accessible
- Currently requires ngrok/cloudflare in dev

**Competitors solve this by:** Auto-generating webhook URLs OR using a single webhook URL with `phone_number_id` routing.

### 4.3 High: Embedded Signup v2/v3 Deprecation

**Problem:** The OAuth URL uses `/dialog/oauth` which is v2/v3. Meta is deprecating this on **October 15, 2026**.

```typescript
// meta.service.ts line 176
return `https://www.facebook.com/${config.meta.apiVersion}/dialog/oauth?${params}`;
```

**Competitors:** Already migrated to v4 (JavaScript SDK).

### 4.4 High: Token Storage & Security

**Problem:**
- Access tokens are encrypted with AES but stored in DB
- Tokens are exposed in frontend JWT during OAuth (`pendingToken`)
- No token refresh mechanism implemented

**Competitors:** Store tokens server-side only, never expose to client.

### 4.5 Medium: No Coexistence Support

**Problem:** Samyoj doesn't support WhatsApp Coexistence (using Business App + API on same number).

**Impact:** Users who want to keep using WhatsApp Business App on their number cannot use Samyoj.

**Competitors:** Interakt and Wati offer coexistence as a first-class feature.

### 4.6 Medium: No Business Verification Guidance

**Problem:** After connecting, users need Meta business verification for full access. Samyoj provides no guidance.

**Competitors:** Interakt and AiSensy guide users through business verification with checklists.

---

## 5. WHAT WAS CHANGED (Implementation Complete)

### 5.1 Backend Changes

| File | Change |
|------|--------|
| `org-meta.service.ts` | `resolveMetaCredentials()` now uses platform App ID (`.env`) as default when org has none |
| `org-meta.service.ts` | `saveOrgMetaSettings()` now makes App ID optional (uses platform default) |
| `routes.ts` | `metaConfigSchema` now has optional `appId` and `appSecret` |

### 5.2 Frontend Changes

| File | Change |
|------|--------|
| `MetaAppConfigModal.tsx` | Removed; credential configuration is not exposed in the product UI |
| `SettingsPage.tsx` | `handleConnect()` no longer requires `metaConfig.configured` |
| `SettingsPage.tsx` | No platform credential or developer-app details are rendered |
| `SettingsPage.tsx` | "Connect WhatsApp" button always visible (no App ID required) |

### 5.3 New User Flow (After Changes)

```
User → Settings → WhatsApp → "Connect WhatsApp" button
     ↓
Facebook popup opens (uses platform App ID automatically)
     ↓
User logs in → selects WABA → enters phone number → OTP
     ↓
CONNECTED ✅ (no App ID/Secret input needed)
```

---

## 6. ENV VARIABLES & SECRETS — PRODUCTION POC

### 6.1 What Stays in `.env` (Global Config)

These are **platform-level** secrets that apply to ALL organizations:

| Variable | Purpose | Who Sets It | Example |
|----------|---------|-------------|---------|
| `META_APP_ID` | Samyoj's Meta App ID | Platform admin | `123456789` |
| `META_APP_SECRET` | Samyoj's Meta App Secret | Platform admin | `abc...` (encrypted at rest) |
| `META_VERIFY_TOKEN` | Webhook verification token | Platform admin | `whatsapp_verify_token` |
| `META_WEBHOOK_URL` | Production webhook URL | Platform admin | `https://api.samyoj.com/...` |
| `META_REDIRECT_URI` | OAuth redirect URI | Platform admin | `https://app.samyoj.com/...` |
| `META_API_VERSION` | Meta API version | Platform admin | `v21.0` |
| `ENCRYPTION_KEY` | AES encryption for tokens | Platform admin | 32-byte hex |
| `JWT_SECRET` | OAuth state signing | Platform admin | 32-byte hex |

### 6.2 What Moves to Database (Per-Org)

These are **per-organization** settings:

| Setting | Model | Purpose |
|----------|-------|---------|
| Override App ID | `Organization.settings.meta.appId` | Advanced users |
| Override App Secret | `Organization.settings.meta.appSecretEncrypted` | Advanced users |
| Access Token | `WhatsappNumber.accessToken` (encrypted) | Per-number token |
| WABA ID | `WhatsappNumber.wabaId` | Per-number WABA |
| Phone Number ID | `WhatsappNumber.phoneNumberId` | Per-number ID |

### 6.3 Production Deployment Checklist

```bash
# 1. Generate secure secrets
openssl rand -hex 32  # for ENCRYPTION_KEY
openssl rand -hex 32  # for JWT_SECRET

# 2. Register Meta App
# - Go to developers.facebook.com
# - Create App
# - Add "WhatsApp" product
# - Get App ID + App Secret
# - Add redirect URI: https://app.samyoj.com/settings/whatsapp/callback
# - Add webhook URL: https://api.samyoj.com/api/whatsapp/webhook
# - Subscribe to "messages" and "calls" webhook fields

# 3. Set environment variables
# - Add all META_* vars to production .env
# - Add ENCRYPTION_KEY and JWT_SECRET

# 4. Deploy
# - Start server
# - Verify webhook: GET https://api.samyoj.com/api/whatsapp/webhook
# - Test OAuth: https://app.samyoj.com/settings/whatsapp

# 5. Test with real phone number
# - Use Meta "Test Number" feature (add number in Meta dashboard)
# - Or use real number (delete WhatsApp account first)
```

---

## 7. RECOMMENDED FLOW FOR SAMYOJ

### 7.1 Normal User Flow (Target State)

```
Step 1: User signs up on Samyoj
  → Enters business email + phone
  → Verifies email
  → Lands on Dashboard

Step 2: User goes to Settings → WhatsApp
  → Sees "Connect WhatsApp" button (NO App ID field)
  → Button text: "Connect with Facebook"

Step 3: Click "Connect with Facebook"
  → Opens Meta OAuth popup
  → Meta App ID is Samyoj's platform App ID (user doesn't know/care)
  → User logs into Facebook Business Manager
  → Selects/creates WABA
  → Enters phone number
  → Verifies via OTP

Step 4: Number connected
  → Samyoj saves encrypted token
  → Auto-configures webhook
  → Shows "Connected" status

Step 5: User can send/receive messages
  → Outbound: works immediately
  → Inbound: works immediately (webhook is live)
  → Shows "Limited access" banner until business verification
```

### 7.2 Developer Flow (Advanced)

```
Step 1: Developer signs up
  → Goes to Settings → WhatsApp → "Advanced Settings"
  → Sees option to use OWN Meta App ID/Secret
  → Enters App ID + Secret (optional override)

Step 2: Connects via OAuth
  → Uses their own App ID (if provided) OR Samyoj's App ID
  → Same flow as normal user

Step 3: Tests
  → Same as normal user
```

### 7.3 Visual Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    SAMYOJ PRODUCTION FLOW                        │
│                                                                  │
│  ┌─────────────┐     ┌──────────────────┐     ┌──────────────┐  │
│  │  Sign Up    │────▶│  Dashboard      │────▶│  Settings    │  │
│  │  (email+ph) │     │  (onboarding)   │     │  WhatsApp    │  │
│  └─────────────┘     └──────────────────┘     └──────┬───────┘  │
│                                                  │          │
│                    ┌─────────────────────────────────▼───────┐  │
│                    │  "Connect with Facebook" button         │  │
│                    │  (uses Samyoj's platform App ID)        │  │
│                    └─────────────────────────────────┬───────┘  │
│                                                  │          │
│                    ┌─────────────────────────────────▼───────┐  │
│                    │  Meta OAuth Popup                      │  │
│                    │  (login to Facebook Business Manager)  │  │
│                    │  → Select/Create WABA                  │  │
│                    │  → Enter phone number                  │  │
│                    │  → OTP verification                    │  │
│                    └─────────────────────────────────┬───────┘  │
│                                                  │          │
│                    ┌─────────────────────────────────▼───────┐  │
│                    │  Callback: /settings/whatsapp/callback  │  │
│                    │  → Verify state (signed JWT)           │  │
│                    │  → Exchange code for token             │  │
│                    │  → Save encrypted token to DB          │  │
│                    │  → Auto-configure webhook              │  │
│                    └─────────────────────────────────┬───────┘  │
│                                                  │          │
│                    ┌─────────────────────────────────▼───────┐  │
│                    │  ✅ Connected!                          │  │
│                    │  → Inbox shows messages                 │  │
│                    │  → Can send broadcasts                  │  │
│                    │  → Limited until business verification  │  │
│                    └──────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1: Fix Current Flow (2-3 days)

| Task | Effort | Priority |
|------|--------|----------|
| Remove App ID/Secret from normal user UI | 2h | P0 |
| Use platform App ID by default | 1h | P0 |
| Add "Advanced" toggle for developers | 2h | P1 |
| Fix webhook URL handling (support production URL) | 3h | P0 |
| Update `META_WEBHOOK_URL` to production URL | 1h | P0 |

### Phase 2: Production Hardening (1 week)

| Task | Effort | Priority |
|------|--------|----------|
| Migrate to Embedded Signup v4 (JS SDK) | 2 days | P0 |
| Add token refresh logic | 1 day | P1 |
| Add webhook signature verification fix | 1 day | P1 |
| Add business verification guidance UI | 2 days | P2 |
| Add coexistence support (CoEx) | 3 days | P2 |

### Phase 3: Competitor Parity (2 weeks)

| Task | Effort | Priority |
|------|--------|----------|
| Add phone number OTP verification UI | 2 days | P1 |
| Add multi-number management UI | 2 days | P1 |
| Add WhatsApp Coexistence flow | 3 days | P2 |
| Add quality rating monitoring | 2 days | P2 |
| Add business verification checklist | 2 days | P2 |

---

## 9. SUMMARY (Updated)

### What's Working Now (After Changes)
- ✅ Platform App ID used by default (normal users don't need to enter App ID/Secret)
- ✅ Embedded Signup OAuth flow works with platform App ID
- ✅ Token encryption (AES-256-GCM)
- ✅ Webhook processing (BullMQ queue)
- ✅ Multi-number support
- ✅ No App ID, App Secret, environment, or advanced-override UI is exposed

### What's Still Needed for Production
- ❌ Webhook URL depends on ngrok (needs production URL)
- ❌ No business verification guidance
- ❌ No coexistence support
- ❌ Embedded Signup v2/v3 (deprecated Oct 2026)

### Env Variables for Production
- `META_APP_ID` / `META_APP_SECRET` → platform-level (in `.env`)
- `META_WEBHOOK_URL` → production URL (in `.env`)
- `ENCRYPTION_KEY` → secure 32-byte hex (in `.env`)
- Per-org tokens → encrypted in DB (`WhatsappNumber.accessToken`)

---

## 10. REFERENCES

| Source | URL |
|--------|-----|
| Meta Embedded Signup Docs | https://developers.facebook.com/docs/whatsapp/embedded-signup |
| Meta Webhooks Docs | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks |
| Interakt Connection Guide | https://www.interakt.shop/resource-center/whatsapp-business-api-link-number-with-interakt/ |
| Wati Connection Guide | https://support.wati.io/en/articles/11462961-how-to-connect-your-whatsapp-number-to-wati-via-embedded-signup-cloud-api |
| AiSensy Connection Guide | https://aisensy.com/tutorials/how-to-apply-for-whatsapp-business-api |
| Meta Coexistence Docs | https://developers.facebook.com/docs/whatsapp/cloud-api/guides/coexistence |
| Samyoj Developer Guide | `docs/WHATSAPP_CONNECT_DEVELOPER_GUIDE.md` |
| Samyoj Auth Deep Review | `docs/audit/AUTH_DEEP_REVIEW.md` |
| Samyoj Features 6-10 Review | `docs/audit/FEATURES_6-10_DEEP_REVIEW.md` |
