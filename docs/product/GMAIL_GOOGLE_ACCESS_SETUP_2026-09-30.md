# Gmail send access — Google Cloud & Samyoj setup (step-by-step)

**Date:** 2026-09-30  
**Audience:** Samyoj team, Google OAuth reviewers, customer IT / Google Workspace admins  
**Product:** Samyoj **Email (Gmail)** channel — **send only** (no inbox read)  
**Code reference:** `server/src/modules/gmail/oauth.ts`, `constants.ts` (`GMAIL_SCOPES`)

> **Honesty:** `https://www.googleapis.com/auth/gmail.send` is a **Sensitive** scope. Any **external** user (not on your Google Cloud “Test users” list) needs Google’s **OAuth verification** before Connect works reliably in production. Until then, only **test users** (max **100**) can complete consent.

---

## 0. Kya chahiye (summary)

| Layer | Kya karna hai |
|--------|----------------|
| **Google Cloud** | Project, Gmail API on, OAuth consent screen, OAuth client, scopes, test users **or** verification |
| **Samyoj server** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, production URLs, optional `GMAIL_REDIRECT_URI` |
| **Samyoj user (OWNER/ADMIN)** | Settings → Channels → **Connect Gmail** → Google consent → send from Compose |
| **Workspace admin (kabhi-kabhi)** | Untrusted app block ho to Samyoj OAuth app allow karna |

Samyoj **sirf ye scopes** maangta hai (connect flow):

- `openid`
- `email`
- `https://www.googleapis.com/auth/gmail.send`

Samyoj **kabhi nahi** maangta: `gmail.readonly`, `gmail.modify`, `mail.google.com`, inbox read, etc.

Official scope table: [Choose Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)

---

## 1. Pehle decide karo — Testing vs Production

Google **recommendation** (Samyoj spec se aligned):

| | **Testing project** | **Production project** |
|---|---------------------|-------------------------|
| Use | Internal QA, Codespaces, staging | **app.samyoj.com** customers |
| Users | OAuth consent → **Test users** list (≤100) | **Published** app + **Sensitive scope verification** |
| Refresh tokens | Non-test users blocked; test users par **7-day** refresh expiry risk on sensitive scopes in External Testing | Verified app — customer go-live |
| Separate client? | Strongly recommended: alag project **ya** alag OAuth client ID | Production client + production redirect URIs only |

Docs: [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)

---

## 2. Google Cloud Console — naya project (Step-by-step)

Har step **Google Cloud Console** mein: [https://console.cloud.google.com/](https://console.cloud.google.com/)

### Step 2.1 — Project create

1. Top bar → **Select a project** → **New Project**
2. Name: e.g. `Samyoj Gmail Production` (testing ke liye alag naam)
3. **Create** → us project ko select karo

### Step 2.2 — Gmail API enable

1. **APIs & Services** → **Library**
2. Search: **Gmail API**
3. **Gmail API** → **Enable**

(Google Sign-In login ke liye alag se **Google Identity** / People API ki zarurat nahi — `openid` + `email` + token endpoint kaafi hai.)

### Step 2.3 — OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**
2. **User type:**
   - **External** — agar koi bhi `@gmail.com` / customer Workspace user connect karega
   - **Internal** — **sirf** apni company ka Google Workspace org (Users type = Internal); bahar ke customers connect **nahi** kar sakte
3. **App information** (verification ke liye zaroori):
   - **App name:** `Samyoj` (ya registered brand)
   - **User support email:** monitored inbox
   - **App logo:** brand logo (verification mein help)
4. **App domain** (production):
   - **Application home page:** `https://app.samyoj.com` (ya public marketing site)
   - **Application privacy policy link:** public HTTPS privacy policy (DPDP-aligned; Gmail data use likho)
   - **Application terms of service link:** optional but recommended
5. **Authorized domains:** e.g. `samyoj.com` (jahan se home + policy host ho)
6. **Developer contact information:** team emails

**Save and Continue**

### Step 2.4 — Scopes add karo (exact list)

1. OAuth consent screen → **Edit app** → **Scopes** → **Add or remove scopes**
2. **Manually add** / filter karke add karo — **sirf ye:**

   | Scope | Type (Google) | Samyoj use |
   |-------|----------------|------------|
   | `openid` | Non-sensitive | Identity |
   | `.../auth/userinfo.email` **or** `email` | Non-sensitive | Verified mailbox email |
   | `https://www.googleapis.com/auth/gmail.send` | **Sensitive** | Send email as connected user |

3. **Update** → **Save**

**Mat add karo:** `gmail.readonly`, `gmail.compose`, `gmail.modify`, `gmail.metadata`, `gmail.settings.basic`, `mail.google.com`.

### Step 2.5 — OAuth 2.0 Client ID (Web)

1. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: e.g. `Samyoj Web (prod)`

**Authorized JavaScript origins** (exact):

| Environment | Origins |
|-------------|---------|
| Production | `https://app.samyoj.com` |
| Local dev | `http://localhost:3000` |
| Codespaces (optional) | `https://<codespace-name>-3000.app.github.dev` |

**Authorized redirect URIs** (exact — typo = `redirect_uri_mismatch`):

| Flow | Redirect URI |
|------|----------------|
| **Gmail Connect** (required) | `https://app.samyoj.com/api/gmail/oauth/callback` |
| Gmail Connect (local) | `http://localhost:8000/api/gmail/oauth/callback` |
| **Continue with Google** (login — same client use karoge to) | `https://app.samyoj.com/api/auth/oauth/google/callback` |
| Login (local) | `http://localhost:8000/api/auth/oauth/google/callback` |

> Samyoj default: Gmail callback = `{BASE_URL}/api/gmail/oauth/callback` unless `GMAIL_REDIRECT_URI` set hai (`server/src/modules/gmail/oauth.ts`).

4. **Create** → copy **Client ID** + **Client secret**

### Step 2.6 — Testing: Test users (verification se pehle)

Jab consent screen **Testing** mode mein ho:

1. OAuth consent screen → **Audience** (or **Test users**)
2. **Add users** — har email jo Connect try karega (max **100**)
3. Jo email list mein **nahi**, unko Google **403 / access blocked** dega

**Note:** External Testing + sensitive scopes → refresh tokens **7 din** ke baad expire ho sakte hain. Ye customer production **nahi** hai.

### Step 2.7 — Production: Sensitive scope verification submit

Jab real customers chahiye:

1. OAuth consent screen → **Publish app** (Testing → Production path)
2. **Google Cloud Console** → verification workflow (brand + sensitive scopes)
3. Submit:
   - **Privacy policy** URL
   - **YouTube / video demo** (English recommended):
     - Login as OWNER/ADMIN
     - **Settings → Channels → Connect Gmail**
     - Google permission screen (**Send email on your behalf** / `gmail.send`)
     - Return — connected mailbox email dikhe
     - **Email → Compose** — eligible contact — send
     - **Sent** log — status **Accepted by Gmail** (not “Delivered”)
     - Explicit: **no inbox**, no reading mail
   - **Written justification:** “Business sends one-to-one email to contacts who opted in, from **their own** Gmail/Workspace mailbox via Gmail API send-only scope.”

Timeline: Google often cites **~3–5 business days** — guarantee nahi; corrections par delay ho sakta hai.

Guide: [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)

---

## 3. Samyoj server configuration (Step-by-step)

File: **`/home/samyoj/Samyoj/server/.env`** (production VPS — secrets git mein nahi)

### Step 3.1 — Google OAuth credentials

```env
GOOGLE_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
```

(Ye **same keys** login + Gmail dono use karte hain jab ek hi OAuth client ho.)

### Step 3.2 — Public URLs (production)

```env
NODE_ENV=production
CLIENT_URL=https://app.samyoj.com
BASE_URL=https://app.samyoj.com
SERVER_URL=https://app.samyoj.com
```

Optional — redirect override (usually **not** needed agar `BASE_URL` sahi hai):

```env
GMAIL_REDIRECT_URI=https://app.samyoj.com/api/gmail/oauth/callback
```

### Step 3.3 — OAuth state secret (required in production)

```env
OAUTH_STATE_SECRET=<strong random string>
```

(Gmail connect JWT state is signed with this — `oauth.ts`.)

### Step 3.4 — Deploy / restart

```bash
# VPS (user samyoj)
cd /home/samyoj/Samyoj
DEPLOY_BRANCH=v8.5.0-phase0-ecosystem bash scripts/vps-deploy.sh
# ya PM2 restart after .env change:
pm2 restart whatsapp-api --update-env
```

### Step 3.5 — Sanity checks

```bash
curl -s https://app.samyoj.com/health
# Gmail status (authenticated API — browser session se):
# GET /api/gmail/status  → connected false until Connect
```

Agar Connect start karte waqt error: **“Google Gmail OAuth is not configured”** → `GOOGLE_CLIENT_ID` / `SECRET` missing.

---

## 4. Google Workspace admin (customer IT) — kab zaroori hai

Agar Connect par error aaye:

- `admin_policy_enforced`
- “This app is blocked” / “unverified app”

**Workspace admin steps:**

1. [Google Admin console](https://admin.google.com/) → **Security** → **Access and data control** → **API controls**
2. **Manage third-party app access** (wording version ke hisaab se thoda alag ho sakta hai)
3. Samyoj OAuth app ko **Trusted** / **Allow** karo  
   **OR** domain-wide: allowlisted OAuth client ID

Consumer `@gmail.com` accounts par ye step nahi — sirf personal Google security / unverified app warning.

Samyoj UI copy: “Agar Connect fail ho, apne Google Workspace admin se Samyoj allow karwain.”

---

## 5. End user — Samyoj mein Gmail connect (Step-by-step)

**Kaun kar sakta hai:** Organization **OWNER** ya **ADMIN** only (`gmail/routes.ts`).

1. Browser: **https://app.samyoj.com** → login
2. **Settings** → **Channels** tab
3. **Gmail** section → **Connect Gmail**
4. Google account choose karo (wohi mailbox jisse send karna hai — personal Gmail ya Workspace user)
5. Consent screen par permissions padho — **Send email** (`gmail.send`) — **Allow**
6. Redirect wapas Samyoj: `.../settings?gmail=1&status=...`
7. Connected mailbox email Settings par dikhe

**Disconnect:** same panel → **Disconnect Gmail**

**Send mail:**

1. **Email** channel → **Compose** (ya Dashboard quick action)
2. Contact jiska **email** saved ho + product email consent rules
3. Subject/body → **Send**
4. Status: **Accepted by Gmail** (Google ne MIME accept kiya — inbox delivery / open guarantee nahi)

---

## 6. Google OAuth reviewer checklist (copy-paste friendly)

Use this in the verification form:

| Item | Samyoj answer |
|------|----------------|
| **Why `gmail.send`?** | Send one-to-one business email from the user’s own mailbox; no inbox sync |
| **Why offline / refresh token?** | Send later without user present; token encrypted server-side (AES-GCM) |
| **Data accessed** | Verified email address + send via API; **no** message read/list |
| **Data stored** | Encrypted refresh token, mailbox email, sent log metadata (to, subject, Gmail message id, status) |
| **Min scopes** | `openid`, `email`, `gmail.send` only |
| **Demo URL** | `https://app.samyoj.com` |
| **Redirect URI** | `https://app.samyoj.com/api/gmail/oauth/callback` |

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `redirect_uri_mismatch` | Redirect URI Google client mein exact match nahi | Step 2.5 URIs copy-paste; `GMAIL_REDIRECT_URI` / `BASE_URL` check |
| `access_denied` / user cancelled | User ne Allow nahi kiya | Retry Connect |
| App “not verified” warning | External app, verification pending | Test user list **or** complete verification |
| “Google did not return a verified Gmail identity” | Email unverified on Google | Google account par email verify karo |
| `admin_policy_enforced` | Workspace blocked app | Section 4 — admin allow |
| Connect OK, send fails `403` | Daily Gmail send limit / policy | [Gmail sending limits](https://support.google.com/a/answer/166852); wait 24h |
| `invalid_grant` after ~7 days | Testing mode refresh expiry | Reconnect; move to verified production app |
| `Reconnect Gmail` in UI | Token revoked / refresh failed | Disconnect → Connect again |

---

## 8. Related Samyoj docs

| Doc | Purpose |
|-----|---------|
| `docs/product/GMAIL_SEND_CHANNEL_SPEC_2026-09-27.md` | Full product + API research |
| `docs/product/GMAIL_SEND_CHANNEL_RECHECK_2026-09-29.md` | Verification timeline + phase gates |
| `docs/AUTH_SETUP.md` | Google **login** OAuth (alag callback path) |
| `docs/deployment/DEPLOYMENT_GUIDE.md` | VPS + `app.samyoj.com` |

---

## 9. Official Google links (bookmark)

- [Gmail API — Sending email](https://developers.google.com/workspace/gmail/api/guides/sending)
- [OAuth 2.0 for Web Server apps](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [OAuth App Verification FAQ](https://support.google.com/cloud/answer/9110914)

---

**Last aligned with code:** 2026-09-30 (`GMAIL_SCOPES`, callback `/api/gmail/oauth/callback`, production host `app.samyoj.com`).
