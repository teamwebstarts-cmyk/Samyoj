# L7 — Test vs Live / Dev Mode / App Review / Roles

Leaf for: Development Mode vs Live Mode, App Roles, App Review, Business Verification, Advanced Access, “App not active”, WhatsApp test numbers vs Meta App modes.

Audience: Sonu / PM literacy (Hinglish + English). Not a coding task.

---

## TL;DR (one screen)

| Layer | What it controls | Who can use the app / API |
|-------|------------------|---------------------------|
| **App Mode** (Dev ↔ Live) | Who may **login / grant permissions** to a Consumer/Gaming app | Dev = **role users only**; Live = general public (for **approved** perms) |
| **Access Levels** (Standard ↔ Advanced) | Who may grant a **specific permission/feature** | Standard = role users; Advanced = anyone (needs BV + often App Review) |
| **App Roles** | Who counts as a “role user” + who can edit App Dashboard | Admin / Developer / Tester / Analytics (+ invitations) |
| **WhatsApp test number** | A **Meta-issued sandbox phone + test WABA** for API practice | Separate from App Mode — messaging sandbox, not Facebook Login sandbox |

**Samyoj rule of thumb:** “App Dev Mode” ≠ “WhatsApp test number.” Confusing them causes wrong debugging (“second FB account App not active” vs “can’t message random customers from test From-number”).

---

## 1. Development Mode vs Live Mode

### Official idea

An app’s **mode** answers: *who is allowed to use this app?*

- **Role users** = people with an App Role (Admin, Developer, Tester, Analytics, etc.)
- **Non-role users** = everyone else (real customers, second personal FB accounts, client staff without a role)

Sources: [App Modes](https://developers.facebook.com/docs/development/build-and-test/app-modes/), [App Dashboard](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/), [Live Mode for production (2019 blog)](https://developers.facebook.com/blog/post/2019/09/23/live-mode-for-production-use/).

### Development Mode

- **Default** for newly created apps that use modes.
- App can request permissions / activate features **only for role users**.
- Data created in Dev Mode (e.g. test posts) is visible mainly to role users; it can become visible more broadly after you switch to Live.
- **No App Review required** just to stay in Dev and test with role users — that’s the point of Dev Mode.
- Production use of non-role user data / assets you don’t own is **not** what Dev Mode is for (Meta’s 2019 Live Mode requirement).

### Live Mode

- Non-role users can use the app **only for permissions/features approved via App Review** (and subject to access levels).
- App may become searchable / App Center–eligible where applicable.
- Admins toggle mode in App Dashboard toolbar.
- **Don’t flip Live early:** if you go Live before approvals + required Business Verification, unapproved permissions stay inactive for the public and login/flows look “broken.”

### Business app type nuance (critical)

- If app type = **Business**, Meta docs say you often **won’t see a Dev/Live mode toggle** — Business apps lean on **access levels** instead of modes.
- Consumer / Gaming apps use the mode toggle **and** access levels.

Sources: [App Types](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/app-types/), [App Dashboard — mode toggle note](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/).

### Hinglish

> Naya app zyada tar **Development Mode** me start hota hai. Is mode me sirf woh log app use kar sakte hain jinko tumne **Admin / Developer / Tester** (ya Analytics) role diya ho. Customer / dost ka doosra Facebook account **role ke bina** login try karega to aksar **“App not active”** type error aayega — ye bug nahi, **whitelist missing** hai. Jab development + App Review + zaruri Business Verification complete ho, tab **Live** on karo taaki real users approved permissions de sakein. **Business-type** apps par kabhi-kabhi mode toggle dikhta hi nahi — wahan **Standard vs Advanced Access** hi asli gate hai.

---

## 2. App Roles (Admin / Developer / Tester / …)

Official: [App Roles](https://developers.facebook.com/docs/development/build-and-test/app-roles/).

Invite from App Dashboard → **Roles**. If the app is connected to a Business portfolio, role management may move to **Business Manager** (Meta links from that doc).

| Role | Can grant perms / use features in Dev | Edit App Dashboard / secret | Assign roles | Insights |
|------|----------------------------------------|-----------------------------|--------------|----------|
| **Administrator** | Yes (any while in Dev) | Full (incl. reset secret, delete app) | Yes | Yes |
| **Developer** | Yes | Technical settings needed to run/edit/test | No (not full admin) | Yes |
| **Tester** | Yes | **No** settings edits | No | No |
| **Analytics** | Limited (analytics-oriented; classic Dev Mode lists include Analytics User as role user) | No product edit | No | Yes (by design) |

### Tester policy note

Meta says add Testers only if they are employees or have an agreement that they act on your behalf (QA-style). Remove when they stop testing.

### Related (not the same)

| Concept | What it is |
|---------|------------|
| **Test users** | Fake Facebook accounts Meta generates for Login testing — [Test Users](https://developers.facebook.com/docs/development/build-and-test/test-users/) |
| **Consumer testers** | Real FB users invited to test without a full Dashboard role (accept under FB Settings → Apps and Websites) |
| **WhatsApp “To” recipients** | Phone numbers allowlisted to receive messages from the **test business phone** in API Setup — not App Roles |

### Hinglish

> Role = Meta App Dashboard ki **team ID card**. Admin = malik. Developer = engineer. Tester = QA — settings nahi chhed sakta. Doosre Facebook account se Connect / Login fail ho raha ho to pehle check karo: kya us account ko **Roles → invite → Accept** mila? Pending invite = abhi bhi outsider.

---

## 3. App Review

Official umbrella: [Publish / App Review](https://developers.facebook.com/docs/development/release/).

**What it is:** Meta’s process to approve **specific permissions and features** so people **without an app role** can grant them / so those features activate for them.

**You typically submit:**

1. Which permissions/features you need (only what you actually use).
2. Written use-case: why the app needs that data.
3. Screencast / walkthrough of the end-to-end flow.
4. Complete basic app settings (icon, privacy policy URL, data deletion info, etc.).

**Flow (high level):**

1. Build + test with role users (Dev Mode and/or Standard Access).
2. Request Advanced Access where needed → App Review submission.
3. Complete Business Verification if required for Advanced Access.
4. For Consumer apps with a mode toggle: switch to **Live** only when approvals are in place.
5. Non-role users can then use **approved** surfaces.

### WhatsApp / Tech Provider angle (Samyoj-relevant)

For solution providers using Embedded Signup / managing **other businesses’** WABAs:

- Direct developer using API **only for your own** business often stays on Standard Access / role-scoped paths.
- Partner / Tech Provider path usually needs **Advanced Access** for e.g. `whatsapp_business_management` and `whatsapp_business_messaging`, with written + video evidence.

Sources:

- [WhatsApp Embedded Signup — App Review](https://developers.facebook.com/docs/whatsapp/embedded-signup/app-review/)
- [Business messaging — solution providers App Review](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review)
- [Access Verification / Tech Provider](https://developers.facebook.com/docs/development/release/access-verification/)
- [Tech Providers](https://developers.facebook.com/docs/development/release/tech-providers/)

Without Advanced Access when required, API calls against other businesses’ assets commonly fail (docs cite permission/error patterns such as error **200** for missing Advanced Access on `whatsapp_business_management`).

### Hinglish

> App Review = Meta se **permission ka license**. Dev Mode me tum apni team se test kar sakte ho. Jab **kisi bhi customer** ko Facebook Login / Embedded Signup se permissions deni hon, Review pass + (jaise applicable) **Live / Advanced Access** chahiye. Samyoj jaise SaaS jo **dusre businesses** onboard kare — usually Advanced Access + Access Verification / Tech Provider path. Apna hi WABA test karna ≠ dusre clients ke WABA manage karna.

---

## 4. Business Verification (BV)

Official:

- Developer: [Business Verification](https://developers.facebook.com/docs/development/release/business-verification/)
- Help Center: [About Business Verification](https://www.facebook.com/business/help/1095661473946872), [Verify your business](https://www.facebook.com/business/help/2058515294227817), [Documents](https://www.facebook.com/business/help/159334372093366)

**What it is:** Meta confirms your Business portfolio belongs to a **real legal entity** (name, address/phone, docs, domain/email/phone challenges as asked).

**Why it matters for apps:**

- Since ~**1 Feb 2023**, apps requesting **Advanced Access** for many permissions must be connected to a **verified** business.
- Apps that let **other Businesses** access their own data also need BV; until then, other businesses often **cannot grant** those perms and features stay inactive.
- BV is done in **Meta Business Suite / Business Manager** (Security Center), even if you start the link from App Dashboard → Settings → Basic → Verification.

**Not the same as:**

- Individual Verification
- WhatsApp **display name** approval
- Green badge / Official Business Account
- App Review (BV and Review often both required, but they are different queues)

### Hinglish

> Business Verification = Meta ko prove karo “ye asli company hai.” Advanced Access maangoge to aksar BV pehle/parallel. Documents legal name + address/phone match hone chahiye. Yeh **App Mode Live** ka substitute nahi — alag checkbox hai.

---

## 5. Standard Access vs Advanced Access

Official: [Access Levels](https://developers.facebook.com/docs/graph-api/overview/access-levels/).

| Level | Who can grant / be affected | How you get it |
|-------|-----------------------------|----------------|
| **Standard Access** | Only people with a **role on the app** | Auto for permissions/features available to that app type |
| **Advanced Access** | **Any** app user (subject to Live/mode rules for Consumer apps) | Per permission/feature via App Review; **BV required** for Advanced Access in general |

Notes:

- Downgrading Advanced → Standard can **invalidate** that permission for non-role users.
- Consumer apps: `email` / `public_profile` may be eligible for Advanced by default but often start Standard until you switch; Consumer apps still need **Live** before non-role users get Advanced behavior.
- Business apps: access levels are the primary gate (often **no** Dev/Live toggle).

Publish guidance: [Publish](https://developers.facebook.com/docs/development/release/) — don’t go Live before approvals + BV when required.

### Hinglish

> Standard = “sirf meri team.” Advanced = “duniya (approved use-case).” WhatsApp SaaS jo clients onboard kare → Advanced + BV + kabhi Access Verification. Sirf apna number / apna WABA test → Standard + roles kaafi ho sakta hai.

---

## 6. “App not active” — second Facebook account

**Typical message:**  
*“App not active: This app is not currently accessible and the app developer is aware of the issue…”*

### Real meaning (almost always)

The Facebook account trying Login / OAuth is **not a role user**, and the app is still in **Development Mode** (or the permission is still Standard-only / not approved for public).

**This is expected Meta behavior**, not “Facebook randomly disabled your app.”

### Fix paths

1. **Preferred for testing:** App Dashboard → **App Roles → Roles** → invite the second account as **Tester** (or Developer/Admin if appropriate) → invitee must **Accept** (pending = still blocked).
2. Or use the same Facebook account that already has a role.
3. Or use Meta **Test Users** for Login-only tests ([Test Users](https://developers.facebook.com/docs/development/build-and-test/test-users/)).
4. **Only when ready for production:** complete App Review (+ BV if needed) and switch to **Live** / Advanced Access so real customers can auth.

Community / integrator write-ups match this (Auth0, Stack Overflow): Dev Mode + missing role = “App not active.” Prefer Meta’s roles docs as source of truth over blogs.

### Hinglish

> Doosra Gmail/FB se Connect try kiya, pehle wale se chal raha tha → 99% case: dusre account ko **Tester role nahi mila** ya invite Accept nahi hua. Pehle role do; turant Live mat on karo sirf is error ke liye.

---

## 7. WhatsApp test numbers / sandbox — **different axis**

Official:

- [Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) (also [business-messaging get-started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started))
- [About the platform — Test resources](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform)
- [Business phone numbers](https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers) / [phone-numbers reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/) (`account_mode` filter: `SANDBOX` | `LIVE`)
- [Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/) (live WABA volume tiers — not the same as App Mode)

### What Meta gives you for WhatsApp testing

When you complete Get Started / API Setup:

- A **test WhatsApp Business account** and **test business phone number** are created automatically.
- Useful for early API work: **relaxed messaging limits**, and Meta states test resources **don’t require a payment method** to send template messages during that testing path.
- In **API Setup**, you pick **From** (test number) and add/verify **To** recipient phone numbers before sending.
- Temporary dashboard tokens expire quickly — use a proper system user / permanent token for real development.
- Phone numbers on a WABA can be filtered by `account_mode` = `SANDBOX` vs `LIVE` (API filtering; docs note beta availability).

### What it is **not**

| Not this | Actually that |
|----------|----------------|
| Not Facebook App **Development Mode** | Separate WhatsApp **test phone / test WABA** |
| Not unlimited customer messaging | Recipients must be added/verified for the test From-number flow; not a free blast to any MSISDN |
| Not a substitute for a real registered business number | Live path: add/verify your own number, register via API, payment method / billing for production Cloud API use |
| Not App Review | Partner Advanced Access is still a separate gate when onboarding **other** businesses |

### Live WhatsApp number (contrast)

- You add **your** business phone (must not already be on consumer WhatsApp without migration/offboarding rules).
- Ownership verify (OTP) + **register** endpoint for Cloud API.
- Messaging limits / quality / payment apply to real traffic ([Messaging limits](https://developers.facebook.com/docs/whatsapp/messaging-limits/)).
- `account_mode: LIVE` vs sandbox test number.

### Two-axis mental model (memorize)

```text
Axis A — Meta App gate:     Roles + (Dev/Live mode OR Standard/Advanced) + App Review + BV
Axis B — WhatsApp number:   Test/sandbox From-number  vs  Real LIVE business number
```

You can be:

- App in Dev / Standard Access + WhatsApp **test** number (common early lab).
- App Live / Advanced + still using test number (odd for production; don’t ship customers on sandbox From).
- App ready for partners + **LIVE** customer numbers (Samyoj Connect / Embedded Signup target).

### Hinglish

> WhatsApp **test number** = Meta ka temporary **From** number practice ke liye. App **Dev Mode** = kaun Facebook se login kar sake. Dono alag. Inbox me message nahi aa raha? Pehle tunnel/webhook dekho — App Mode se confuse mat karo. Doosra FB account Connect fail? Roles. Random customer ko test From se message? Pehle API Setup me **To** verify.

---

## 8. Why this matters for Samyoj

- **Connect WhatsApp / OAuth:** second Meta user without a role → “App not active” during internal testing; fix with Tester role, not random Live flips.
- **Tech Provider / Embedded Signup:** Advanced Access on WhatsApp permissions + BV + Access Verification — not “just add a phone in API Setup.”
- **Customer production vs internal test-deploy:** Samyoj `bash start.sh` is *our* test deploy; Meta still has its own Dev/Live and sandbox/live phone layers. Don’t claim Meta production-ready just because localhost outbound works.
- **Never mix:** Meta Cloud API fees / messaging limits ≠ Samyoj SaaS plan price (see billing docs elsewhere).

---

## 9. Common pitfalls

1. Flipping **Live** to “fix” second-account login without App Review → public still blocked on unapproved perms; or you expose unfinished app.
2. Confusing **Tester role** with WhatsApp **To** recipient allowlist.
3. Confusing **Business Verification** with App Review or with WhatsApp display-name review.
4. Assuming Business-type apps have a Dev/Live toggle — they may only show access levels.
5. Using WhatsApp **test** From-number as if it were a customer’s production line.
6. Temporary API Setup token treated as production token.
7. Partner APIs without Advanced Access → opaque failures when touching **other** WABAs.
8. Invite sent but not **Accepted** → still “App not active.”

---

## 10. Official URL checklist

| Topic | URL |
|-------|-----|
| App Modes | https://developers.facebook.com/docs/development/build-and-test/app-modes/ |
| App Roles | https://developers.facebook.com/docs/development/build-and-test/app-roles/ |
| Test Users | https://developers.facebook.com/docs/development/build-and-test/test-users/ |
| App Dashboard | https://developers.facebook.com/docs/development/create-an-app/app-dashboard/ |
| App Types | https://developers.facebook.com/docs/development/create-an-app/app-dashboard/app-types/ |
| Publish / App Review overview | https://developers.facebook.com/docs/development/release/ |
| Access Levels | https://developers.facebook.com/docs/graph-api/overview/access-levels/ |
| Business Verification (dev) | https://developers.facebook.com/docs/development/release/business-verification/ |
| Access Verification | https://developers.facebook.com/docs/development/release/access-verification/ |
| Tech Providers | https://developers.facebook.com/docs/development/release/tech-providers/ |
| Live Mode blog (2019) | https://developers.facebook.com/blog/post/2019/09/23/live-mode-for-production-use/ |
| BV Help Center | https://www.facebook.com/business/help/1095661473946872 |
| Verify business steps | https://www.facebook.com/business/help/2058515294227817 |
| WA Cloud Get Started | https://developers.facebook.com/docs/whatsapp/cloud-api/get-started |
| WA about / test resources | https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform |
| WA phone numbers | https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers |
| WA phone numbers API (`account_mode`) | https://developers.facebook.com/docs/whatsapp/cloud-api/reference/phone-numbers/ |
| WA messaging limits | https://developers.facebook.com/docs/whatsapp/messaging-limits/ |
| WA Embedded Signup App Review | https://developers.facebook.com/docs/whatsapp/embedded-signup/app-review/ |
| Solution provider App Review | https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review |

---

## 11. Quiz / self-check

Answer without scrolling; then check.

1. **True/False:** Development Mode lets any Facebook user log into your unfinished app.  
2. Your colleague’s personal FB account gets “App not active” while yours works. First fix?  
3. Name two things Business Verification is **not**.  
4. Standard Access vs Advanced Access — one sentence each.  
5. Does a **Business**-type app always show a Dev/Live toggle?  
6. WhatsApp **test business phone** proves what about payment methods (per Meta test-resources wording)?  
7. `account_mode=SANDBOX` filters what?  
8. For a Tech Provider managing **client** WABAs, which gate is usually required beyond “I can message myself from API Setup”?  
9. True/False: Switching Live automatically completes App Review.  
10. Tester role can reset the App Secret — True/False?

### Answer key

1. **False** — role users only (for apps that use Dev Mode).  
2. Invite them as **Tester/Developer/Admin** and have them **Accept**; don’t rush Live.  
3. Examples: App Review; WhatsApp display-name approval; green badge; Individual Verification.  
4. Standard = role users only; Advanced = any user after review (+ BV).  
5. **No** — Business apps often rely on access levels only.  
6. Test WABA/number path: relaxed limits and **no payment method required** to send templates in that test context (per About the platform — Test resources).  
7. WhatsApp **phone numbers** on a WABA (sandbox vs live numbers), not Facebook App Mode.  
8. **Advanced Access** (WhatsApp perms) + **Business Verification** + often **Access Verification / Tech Provider** — plus App Review materials.  
9. **False** — Review and Live are separate; Live without approval leaves perms inactive for the public.  
10. **False** — Testers cannot edit app settings / secrets.

---

## 12. 60-second Hinglish recap

> **Dev Mode** = sirf team (roles). **Live** = public, lekin sirf **approved** permissions. **Roles** = Admin/Dev/Tester cards. **App Review** = Meta se permission approval. **Business Verification** = company asli hai. **Advanced Access** = non-role users ko woh permission. **“App not active”** = dusra FB account role ke bina. **WhatsApp test number** = alag sandbox phone — App Mode se mix mat karo.

---

*Leaf L7 — researched 2026-08-25. Prefer linked Meta docs over third-party blogs if anything conflicts.*
