# Auth Features — Deep Security Review

> Reviewed: 2026-07-31  
> Features: Registration, Login, 2FA (TOTP), Google OAuth, Microsoft OAuth  
> Method: Code review + Web research (OWASP, Auth0, RFC 6238/8725/9700)  
> Reviewers: 5 parallel subagents with senior security engineer persona

---

## Overall Scores

| Feature | Score | Verdict |
|---------|-------|---------|
| Registration | 4/10 | NOT production-ready |
| Login | 3.8/10 | NOT production-ready |
| 2FA (TOTP) | 3/10 | NOT production-ready |
| Google OAuth | 3/10 | NOT production-ready |
| Microsoft OAuth | 2.4/10 | Remove or rewrite |
| **Auth System Average** | **3.2/10** | **Critical fixes needed** |

---

## CROSS-CUTTING ISSUES (Affect ALL Features)

### 1. Tokens in localStorage — XSS = Full Account Takeover
**Severity:** CRITICAL | **Affects:** Login, Registration, OAuth

Both access and refresh tokens stored in `localStorage`. Any XSS vulnerability (including from a compromised npm dependency) allows an attacker to steal both tokens.

**Industry standard (2026):** Access tokens in memory only; refresh tokens in `HttpOnly; Secure; SameSite=Strict` cookies.

**Code:**
```typescript
// client/src/utils/authStorage.ts
localStorage.setItem(ACCESS_KEY, accessToken);    // XSS-readable
localStorage.setItem(REFRESH_KEY, refreshToken);   // XSS-readable
```

**Web research:** OWASP explicitly discourages localStorage for tokens since 2020. Auth0, Clerk, Supabase all use HttpOnly cookies for refresh tokens.

---

### 2. No Refresh Token Rotation
**Severity:** CRITICAL | **Affects:** Login, Registration, OAuth

Refresh tokens are never rotated — the same token is reused forever until expiry (7 days). A stolen refresh token grants indefinite access.

**Code:**
```typescript
// server/src/modules/auth/routes.ts — /refresh endpoint
const accessToken = signAccessToken(payload);
sendSuccess(res, { accessToken });  // No new refresh token!
```

**OWASP/Auth0/Clerk:** Refresh tokens MUST be rotated on every use (RFC 9700, Jan 2025). Old tokens must be invalidated. Reuse detection must revoke the entire token family.

---

### 3. No Per-Endpoint Rate Limiting on Auth
**Severity:** CRITICAL | **Affects:** Login, Registration, 2FA

Only a global rate limit of 500/15min exists. An attacker can attempt 500 logins or registrations per 15 minutes with no lockout, no CAPTCHA, no exponential backoff.

**Code:**
```typescript
// server/src/index.ts
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,  // Global — not per-endpoint, not per-IP, not per-email
}));
```

**Web research:** Auth0 uses per-email lockout after 5 failed attempts + exponential backoff + CAPTCHA. Clerk uses rate limiting + bot detection.

---

### 4. JWT Algorithm Not Pinned
**Severity:** HIGH | **Affects:** Login, Registration, OAuth

`jwt.verify()` doesn't specify `{ algorithms: ['HS256'] }`, leaving it vulnerable to algorithm confusion attacks.

**Code:**
```typescript
// server/src/utils/jwt.ts
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;  // No algorithms specified
}
```

**RFC 8725 Section 3.1:** "Indicate the algorithm in the JWS header and verify it." Always pass `{ algorithms: ['HS256'] }`.

---

### 5. Fallback JWT Secrets in Config
**Severity:** HIGH | **Affects:** ALL

If env vars aren't set, server starts with `'dev-secret'` — trivially guessable.

**Code:**
```typescript
// server/src/config/index.ts
secret: process.env.JWT_SECRET || 'dev-secret',  // Dangerous fallback
refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
```

**Fix:** Fail fast at startup if secrets are missing or below minimum entropy (256 bits for HS256).

---

### 6. OAuth Tokens in URL Query Parameters
**Severity:** CRITICAL | **Affects:** Google OAuth, Microsoft OAuth

Both OAuth callbacks pass tokens via URL query params — leaked to browser history, server logs, Referer headers, and proxies.

```typescript
// server/src/modules/auth/oauth.routes.ts
redirectUrl.searchParams.set('accessToken', accessToken);   // Leaked!
redirectUrl.searchParams.set('refreshToken', refreshToken);  // Leaked!
```

**Web research:** OAuth 2.0 Security Best Practice (RFC 9700) — tokens must not be passed in URL fragments or query parameters. Use authorization codes with server-side exchange, then set via HttpOnly cookies.

---

## FEATURE 1: REGISTRATION

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Password policy | 5/10 | Min 8 chars only, no complexity, no breach check |
| Password hashing | 9/10 | bcrypt cost 12 (good) |
| Input validation | 7/10 | Zod on server, but no server-side password policy |
| Email verification | 0/10 | None — users get full access immediately |
| Rate limiting | 1/10 | Global 500/15min allows ~33 registrations/min |
| Error handling | 4/10 | 409 leaks email existence |
| Security headers | 7/10 | Helmet configured |
| **Overall** | **4/10** | |

### What's Right
- bcrypt with cost 12 (good work factor)
- Zod schema validation (server-side)
- Prisma transactions for atomicity
- Generic error messages (mostly)

### What's Wrong

| Issue | Severity | Details |
|-------|----------|---------|
| No email verification | CRITICAL | Users get full access immediately. Anyone can claim any email. |
| No registration rate limiting | CRITICAL | Global 500/15min allows ~33 registrations/min |
| TOCTOU race condition | HIGH | Duplicate email check happens outside the transaction |
| Account enumeration | HIGH | `409 "Email already registered"` leaks which emails have accounts |
| Password strength meter lies | MEDIUM | Frontend rates `Password1` as "Strong" (100%) |
| Registration tokens missing metadata | MEDIUM | No `userAgent`/`ipAddress` on refresh tokens (unlike login) |
| Dangerous dead code | HIGH | `crypto.ts` exports SHA-256 `hashPassword()` — should be deleted |

### Bugs Found

**Bug 1: TOCTOU Race Condition**
```typescript
// server/src/modules/auth/routes.ts
const existing = await prisma.user.findUnique({ where: { email: data.email } });
if (existing) throw new AppError(409, 'Email already registered');
// ← Race window: another request can insert here
const user = await prisma.user.create({ ... });
```
Two simultaneous requests with same email both pass the check, then one fails with DB constraint error.

**Bug 2: Registration refresh tokens missing metadata**
Login creates refresh tokens with `userAgent` and `ipAddress`, but registration doesn't. Inconsistent audit trail.

**Bug 3: Frontend password strength meter**
`Password1` (weak) scores 100% on the frontend strength meter. The meter only checks length + has uppercase + has lowercase + has number — not real strength.

### Web Research Comparison

| Aspect | Samyoj | Auth0/Clerk | Industry Standard |
|--------|--------|-------------|------------------|
| Email verification | None | Required before access | CRITICAL gap |
| Password policy | Min 8 chars | Min 8 + breach check + complexity | MEDIUM gap |
| Rate limiting | Global only | Per-IP + per-email + CAPTCHA | CRITICAL gap |
| Duplicate check | FindUnique outside tx | Upsert in tx with conflict handling | HIGH gap |
| Welcome email | None | Sent on registration | MEDIUM gap |

### Recommendations (Priority Order)

1. **[P0] Add email verification** — Send verification email on registration, block login until verified. Use a short-lived token (15 min expiry).
2. **[P0] Add registration rate limiting** — Max 3 registrations per IP per hour. Use Redis.
3. **[P0] Fix TOCTOU** — Use Prisma `create` with `catch` for unique constraint, or use DB-level unique + retry.
4. **[P1] Improve password policy** — Min 8 chars, require complexity, check against HaveIBeenPwned API.
5. **[P1] Fix account enumeration** — Always return same response for existing/non-existing emails (but still prevent duplicate creation).
6. **[P1] Fix password strength meter** — Use zxcvbn or similar real strength library.
7. **[P2] Delete `crypto.ts` SHA-256 hashPassword** — Dangerous dead code.
8. **[P2] Add welcome email** — Send on successful registration.

---

## FEATURE 2: LOGIN

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Brute force protection | 2/10 | No account lockout, no per-endpoint rate limit |
| Password security | 7/10 | bcrypt is good; no breached-password check |
| JWT configuration | 3/10 | No alg pinning, no iss/aud, fallback secrets |
| Refresh token rotation | 1/10 | No rotation at all |
| Token storage (client) | 1/10 | localStorage — XSS = full takeover |
| Token refresh flow | 4/10 | Race condition on concurrent refresh |
| Session management | 3/10 | No session listing/revocation, no family tracking |
| Error messages | 6/10 | Login is generic; register/forgot leak user existence |
| Logging & monitoring | 1/10 | Zero failed-login logging |
| **Overall** | **3.8/10** | |

### What's Right
- Generic error message ("Invalid email or password") — prevents user enumeration on login
- bcrypt.compare is timing-safe
- Refresh tokens stored server-side with metadata
- Cache-Control: no-store on auth responses
- Zod validation

### What's Wrong

| Issue | Severity | Details |
|-------|----------|---------|
| No brute force protection | CRITICAL | No account lockout, no per-endpoint rate limit |
| No refresh token rotation | CRITICAL | Same token reused indefinitely (7 days) |
| Tokens in localStorage | CRITICAL | XSS = full session hijack |
| JWT alg not pinned | HIGH | Algorithm confusion attack possible |
| No failed login logging | HIGH | Zero audit trail for credential stuffing |
| Token refresh race condition | HIGH | Concurrent 401s trigger multiple refreshes |
| "Remember Me" is non-functional | MEDIUM | Checkbox exists but state never sent to server |
| No iss/aud/jti claims | MEDIUM | Tokens can be replayed across services |
| 2FA flow leaks email | MEDIUM | Server reveals email before asking for TOTP |

### Bugs Found

**Bug 1: No brute force protection**
```typescript
// server/src/modules/auth/routes.ts
if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
  throw new AppError(401, 'Invalid email or password');
  // ← No failed attempt tracking, no lockout, no rate limit
}
```

**Bug 2: Refresh token never rotated**
```typescript
// server/src/modules/auth/routes.ts — /refresh endpoint
const accessToken = signAccessToken(payload);
sendSuccess(res, { accessToken });  // No new refresh token issued
```

**Bug 3: Token refresh race condition**
In `api.ts`, multiple concurrent 401s each independently trigger a refresh. No single-flight queue.

**Bug 4: "Remember Me" checkbox is non-functional**
```typescript
// client/src/pages/LoginPage.tsx
const [rememberMe, setRememberMe] = useState(false);
// ← rememberMe is never sent to the server
```

### Web Research Comparison

| Aspect | Samyoj | Auth0 | Clerk | Industry |
|--------|--------|-------|---------|---------|
| Brute force | None | Per-email lockout + CAPTCHA | Rate limit + bot detection | Required |
| Token rotation | None | Rotate on every use | Rotate + reuse detection | RFC 9700 |
| Token storage | localStorage | HttpOnly cookie | HttpOnly cookie | OWASP |
| Session mgmt | Basic | Device tracking | Family revocation | Recommended |
| 2FA | TOTP only | TOTP + SMS + Email | TOTP + Passkeys | Recommended |

### Recommendations (Priority Order)

1. **[P0] Add per-endpoint login rate limiting** — 5 attempts per email per 15 min, 10 per IP per 15 min. Redis-backed.
2. **[P0] Implement account lockout** — After 5 failed attempts, lock for 15 min with exponential backoff.
3. **[P0] Implement refresh token rotation** — Issue new refresh token on every `/refresh` call, invalidate old one, detect reuse.
4. **[P0] Move tokens to HttpOnly cookies** — Refresh tokens in `HttpOnly; Secure; SameSite=Strict` cookies. Access tokens in memory.
5. **[P0] Pin JWT algorithm** — Add `{ algorithms: ['HS256'] }` to all `jwt.verify()` calls.
6. **[P0] Fail fast on missing secrets** — Throw at startup if JWT secrets are default or too short.
7. **[P1] Add failed login audit logging** — Log email, IP, user-agent, timestamp for every failed attempt.
8. **[P1] Fix token refresh race condition** — Implement single-flight queue.
9. **[P1] Add iss/aud/jti claims** to JWTs. Validate on verification.
10. **[P2] Remove or implement "Remember Me"** — Either remove checkbox or implement variable refresh token lifetimes.
11. **[P2] Add CAPTCHA** after N failed attempts.
12. **[P2] Add breached-password checking** via HaveIBeenPwned API.

---

## FEATURE 3: TWO-FACTOR AUTHENTICATION (TOTP)

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Secret generation | 8/10 | CSPRNG (crypto.randomBytes) |
| Secret storage | 0/10 | Plaintext — DB breach = 2FA bypassed |
| Replay prevention | 0/10 | Same code reusable unlimited times (violates RFC 6238) |
| Rate limiting | 0/10 | No per-user rate limit on 2FA verify |
| TOTP verification | 5/10 | Correct time window, but uses `===` (timing-unsafe) |
| Backup codes | 0/10 | None — no recovery path if device lost |
| OAuth enforcement | 0/10 | OAuth logins bypass 2FA entirely |
| **Overall** | **3/10** | |

### What's Right
- CSPRNG secret generation (crypto.randomBytes)
- Correct time window (30s, 1 step tolerance)
- Proper otpauth:// URI for QR code
- Audit logging of 2FA enable/disable

### What's Wrong

| Issue | Severity | Details |
|-------|----------|---------|
| TOTP secrets stored as plaintext | CRITICAL | DB breach = all 2FA bypassed |
| No replay attack prevention | CRITICAL | Same code can be reused unlimited times within window (violates RFC 6238) |
| No rate limiting on 2FA verify | CRITICAL | 1M keyspace brute-forceable with no lockout |
| OAuth bypasses 2FA | CRITICAL | Google/Microsoft OAuth login skips 2FA entirely |
| Timing attack on code comparison | HIGH | Uses `===` instead of timing-safe comparison |
| Secret persisted before verification | HIGH | Secret saved to DB before user scans QR code |
| No admin 2FA reset | MEDIUM | Admin can't reset a locked-out user's 2FA |
| No backup/recovery codes | MEDIUM | If user loses TOTP device, no recovery path |

### Bugs Found

**Bug 1: Plaintext TOTP secrets in DB**
```typescript
// server/src/modules/team/totp.ts
const secret = crypto.randomBytes(20).toString('hex');  // CSPRNG — good
// ← But stored directly in DB without encryption
await prisma.organizationUser.update({
  where: { id: userId },
  data: { twoFactorSecret: secret },  // PLAINTEXT!
});
```

**Bug 2: No replay prevention**
```typescript
// server/src/modules/team/routes.ts — 2FA verify
const isValid = verifyTotp(totpCode, user.twoFactorSecret);
if (isValid) {
  // ← Same code works again 30 seconds later — RFC 6238 violation
}
```

**Bug 3: Timing attack**
```typescript
// server/src/modules/team/totp.ts
return code === generated;  // String comparison — timing-unsafe
```

**Bug 4: OAuth bypasses 2FA**
Google/Microsoft OAuth login in `oauth.routes.ts` never checks `twoFactorEnabled` — 2FA is security theater for OAuth users.

### Web Research Comparison

| Aspect | Samyoj | Google | GitHub | Auth0 | RFC 6238 |
|--------|--------|--------|--------|-------|----------|
| Secret encryption | Plaintext | Encrypted at rest | Encrypted | Encrypted | Recommended |
| Replay prevention | None | Tracks used codes | Tracks used codes | Tracks used codes | Required |
| Backup codes | None | 10 codes | 8 codes | 8-10 codes | Recommended |
| Rate limiting | None | 5 attempts then lockout | 5 attempts | 5 attempts | Required |
| TOTP window | 30s + 1 step | 30s + 1 step | 30s + 1 step | 30s + 1 step | 30s ± 1 step |
| Recovery | None | Backup codes | Backup codes | Backup codes | Recommended |

### Recommendations (Priority Order)

1. **[P0] Encrypt TOTP secrets at rest** — Use AES-256-GCM (already in `crypto.ts`). Store IV + ciphertext + authTag.
2. **[P0] Add TOTP replay prevention** — Track used codes in Redis with TTL = 90s. Reject if code was already used.
3. **[P0] Add TOTP rate limiting** — Max 5 failed attempts per user per 15 min. Lockout after 5.
4. **[P0] Enforce 2FA for OAuth logins** — If user has 2FA enabled, OAuth login must also require TOTP.
5. **[P1] Fix timing attack** — Use `crypto.timingSafeEqual()` for TOTP code comparison.
6. **[P1] Don't persist secret before verification** — Only save to DB after user successfully verifies the first code.
7. **[P1] Add backup/recovery codes** — Generate 8-10 one-time codes on 2FA setup. Store hashed.
8. **[P2] Add admin 2FA reset** — Allow org admin to reset a user's 2FA (with audit log).
9. **[P2] Add 2FA enforcement setting** — Option to require 2FA for all users in an org.

---

## FEATURE 4: GOOGLE OAUTH

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| State parameter (CSRF) | 2/10 | Exists in code but not properly verified in login flow |
| PKCE | 0/10 | Not implemented |
| ID token verification | 2/10 | Basic verification, not comprehensive |
| Account linking | 1/10 | Implicit linking without verification (CVE-2026-53516 pattern) |
| Token transport | 0/10 | Tokens in URL query params |
| 2FA enforcement | 0/10 | OAuth bypasses 2FA |
| **Overall** | **3/10** | |

### What's Right
- OAuth state parameter exists (in `connect-oauth-state.ts` — but login OAuth doesn't use it properly)
- Server-side token exchange (not client-side)
- Account linking with existing users

### What's Wrong

| Issue | Severity | Details |
|-------|----------|---------|
| No state verification in login flow | CRITICAL | `connect-oauth-state.ts` has proper signed JWT state, but login OAuth doesn't use it |
| Tokens in URL params | CRITICAL | Both tokens leaked via query string |
| Implicit account takeover | CRITICAL | If email exists with password, OAuth links without verification (CVE-2026-53516 pattern) |
| No PKCE | HIGH | Authorization code interception possible |
| No ID token verification | HIGH | Trusts access token via Graph API, doesn't verify JWT signature properly |
| 2FA bypass | HIGH | OAuth login skips 2FA |
| No frontend button | MEDIUM | GoogleAuthButton exists but may not be wired properly |

### Bugs Found

**Bug 1: State parameter not verified in login flow**
```typescript
// server/src/modules/auth/oauth.routes.ts — Google callback
// ← No state verification against stored state
// connect-oauth-state.ts has proper signed JWT state, but this flow doesn't use it
```

**Bug 2: Tokens in URL query params**
```typescript
const redirectUrl = new URL(`${config.clientUrl}/login`);
redirectUrl.searchParams.set('accessToken', accessToken);   // Leaked to logs!
redirectUrl.searchParams.set('refreshToken', refreshToken);  // Leaked to logs!
res.redirect(redirectUrl.toString());
```

**Bug 3: Implicit account linking (CVE-2026-53516 pattern)**
If `test@example.com` has a password account, and an attacker initiates Google OAuth with that email, the system links the OAuth account to the existing account WITHOUT verifying the user owns the Google account.

### Web Research Comparison

| Aspect | Samyoj | Auth0 | NextAuth | Industry |
|--------|--------|-------|----------|---------|
| State parameter | Broken | Always verified | Always verified | RFC 6749 required |
| PKCE | None | Required | Required | RFC 7636 required |
| Account linking | Implicit (dangerous) | Explicit consent | Explicit consent | OWASP |
| Token transport | URL params | HttpOnly cookies | HttpOnly cookies | RFC 9700 |
| ID token verify | Basic | Full JWT verify | Full JWT verify | RFC 7519 |

### Recommendations (Priority Order)

1. **[P0] Add proper state parameter with verification** — Use signed JWT state (like `connect-oauth-state.ts` already does for WhatsApp OAuth).
2. **[P0] Remove tokens from URL params** — Use authorization code flow, then set tokens via HttpOnly cookies.
3. **[P0] Fix account linking** — Require email verification or explicit consent before linking OAuth to existing account.
4. **[P0] Enforce 2FA for OAuth** — If user has 2FA enabled, require TOTP after OAuth.
5. **[P1] Add PKCE** — Generate code_verifier + code_challenge, verify on token exchange.
6. **[P1] Proper ID token verification** — Verify signature, issuer, audience, expiry, nonce.
7. **[P2] Add OAuth account management** — Allow users to unlink OAuth accounts.

---

## FEATURE 5: MICROSOFT OAUTH

### Score Card

| Aspect | Score (1-10) | Notes |
|--------|-------------|-------|
| Frontend button | 0/10 | No button — dead code |
| State parameter | 0/10 | None |
| PKCE | 0/10 | None |
| ID token verification | 0/10 | Never validates Microsoft's JWT |
| Tenant config | 0/10 | No multi-tenant handling |
| Copy-paste quality | 1/10 | Copy-paste of Google OAuth without Microsoft-specific changes |
| **Overall** | **2.4/10** | |

### What's Right
- Backend endpoints exist (but unreachable)

### What's Wrong

| Issue | Severity | Details |
|-------|----------|---------|
| No frontend button | CRITICAL | Endpoints exposed but unreachable — untested dead code still attackable |
| No state parameter | CRITICAL | CSRF on OAuth flow |
| No PKCE | CRITICAL | Microsoft recommends PKCE for all flows |
| No ID token verification | HIGH | Never validates Microsoft's JWT |
| No tenant configuration | HIGH | No multi-tenant vs single-tenant handling |
| Copy-paste of Google OAuth | HIGH | Microsoft-specific requirements not accounted for |

### Recommendations

1. **[P0] Remove Microsoft OAuth endpoints entirely** — Dead code with security vulnerabilities is worse than no code.
2. **[P1] If keeping: rewrite with MSAL** — Use Microsoft's official MSAL library for proper OAuth implementation.
3. **[P1] Add frontend button** — If implementing, add Microsoft login button to LoginPage.
4. **[P1] Proper tenant configuration** — Support multi-tenant or restrict to specific tenant.
5. **[P2] Add Microsoft-specific scopes** — `openid`, `profile`, `email`, `User.Read`.

---

## CONSOLIDATED P0 FIXES (Before Production)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | Add per-endpoint auth rate limiting (Redis-backed) | 2h | Blocks brute force |
| 2 | Implement account lockout (5 failed → 15min) | 2h | Blocks credential stuffing |
| 3 | Implement refresh token rotation + reuse detection | 4h | Limits stolen token damage |
| 4 | Move refresh token to HttpOnly cookie | 3h | Prevents XSS token theft |
| 5 | Add `state` param to Google OAuth with verification | 2h | Prevents OAuth CSRF |
| 6 | Remove tokens from OAuth URL params | 2h | Prevents token leakage |
| 7 | Require email verification before access | 4h | Prevents email hijacking |
| 8 | Encrypt TOTP secrets at rest | 2h | Protects against DB breach |
| 9 | Add TOTP replay prevention | 2h | RFC 6238 compliance |
| 10 | Pin JWT algorithm in all verify calls | 30m | Prevents alg confusion |
| 11 | Remove JWT secret fallback defaults | 30m | Prevents weak secrets |
| 12 | Delete SHA-256 hashPassword dead code | 10m | Removes dangerous code |
| 13 | Remove or rewrite Microsoft OAuth | 1d | Eliminates attack surface |
| **Total** | | **~3-4 days** | |

---

## CONSOLIDATED P1 FIXES (This Sprint)

| # | Fix | Effort |
|---|-----|--------|
| 14 | Add TOTP rate limiting (5 attempts per 15min) | 1h |
| 15 | Implement backup/recovery codes | 4h |
| 16 | Add `iss`, `aud`, `jti` claims to JWTs | 2h |
| 17 | Fix token refresh race condition (single-flight queue) | 3h |
| 18 | Add failed login audit logging | 2h |
| 19 | Fix implicit OAuth account linking | 3h |
| 20 | Enforce 2FA for OAuth-linked accounts | 4h |
| 21 | Add CAPTCHA after N failed auth attempts | 4h |
| 22 | Remove or implement "Remember Me" | 1h |
| 23 | Add PKCE to OAuth flows | 3h |
| **Total** | | **~3 days** |

---

## WEB RESEARCH SOURCES CITED

| Source | URL | Key Finding |
|--------|-----|-------------|
| OWASP ASVS | https://owasp.org/www-project-application-security-verification-standard/ | Token storage, brute force, 2FA requirements |
| RFC 6238 | https://tools.ietf.org/html/rfc6238 | TOTP specification — replay prevention required |
| RFC 8725 | https://tools.ietf.org/html/rfc8725 | JWT security — pin algorithm, add iss/aud |
| RFC 9700 | https://tools.ietf.org/html/rfc9700 | Refresh token rotation required |
| RFC 6749 | https://tools.ietf.org/html/rfc6749 | OAuth 2.0 — state parameter required |
| RFC 7636 | https://tools.ietf.org/html/rfc7636 | PKCE for OAuth |
| Auth0 Best Practices | https://auth0.com/docs/secure | Refresh rotation, brute force, HttpOnly cookies |
| Clerk Security | https://clerk.com/docs | Token storage, rate limiting, session management |
| CVE-2026-53516 | NVD | Implicit OAuth account linking vulnerability |
| HaveIBeenPwned | https://haveibeenpwned.com/API/v3 | Breached password checking |

---

## What We Did RIGHT (Summary)

1. **bcrypt cost 12** — Proper password hashing
2. **Zod validation** — Server-side input validation
3. **Generic login errors** — Prevents user enumeration on login
4. **Server-side token exchange** — OAuth tokens exchanged on backend
5. **CSPRNG for TOTP secrets** — Proper randomness
6. **Refresh tokens in DB** — Schema supports rotation (just not implemented)
7. **Prisma transactions** — Atomic operations
8. **Helmet + CORS** — Basic HTTP security headers
9. **Cache-Control: no-store** — Auth responses not cached
10. **Password reset invalidates sessions** — Good cleanup

## What We Did WRONG (Summary)

1. **localStorage for tokens** — Industry anti-pattern since 2020
2. **No refresh token rotation** — Critical security gap
3. **No brute force protection** — Wide open to automated attacks
4. **No email verification** — Anyone can claim any email
5. **Plaintext TOTP secrets** — Defeats purpose of 2FA
6. **No TOTP replay prevention** — Violates RFC 6238
7. **OAuth tokens in URLs** — Multiple leakage vectors
8. **No PKCE** — Authorization code interception
9. **Microsoft OAuth is dead code** — Exposed but untested
10. **No rate limiting on auth endpoints** — Global limit is insufficient
