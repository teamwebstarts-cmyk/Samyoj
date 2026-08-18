# Samyoj Authentication Setup

Complete guide for email/password + Google Sign-In + forgot password + sessions.

## What works now

| Feature | Status |
|---------|--------|
| Register (name, company, email, password) | Hardened — strong password policy, org created, email verification disabled (set immediately) |
| Login | Rate-limited, 2FA optional, email verification gate |
| Continue with Google | CSRF `state`, org auto-created, **tokens not in URL** (one-time code exchange) |
| Forgot / reset password | UUID token, revokes all sessions on reset |
| Email verification | `/verify-email?token=` + resend |
| Refresh sessions | **Rotated** on every refresh; reuse of revoked token kills all sessions |
| Logout | Revokes refresh token |
| JWT | HS256 algorithm pinned |

## Credentials you must add (`server/.env`)

Copy from `server/.env.example` and fill:

### 1) JWT (required)

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
```

### 2) Google Sign-In (for Continue with Google)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials  
2. Create **OAuth 2.0 Client ID** (Web application)  
3. Authorized JavaScript origins: `http://localhost:3000`  
4. Authorized redirect URI (**exact**):

```text
http://localhost:8000/api/auth/oauth/google/callback
```

5. Put into `server/.env`:

```env
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-....
```

6. Restart API (`bash start.sh` or restart `server` process).

Check: `GET http://localhost:8000/api/auth/oauth/google/status` → `{ configured: true }`

### 3) SMTP (forgot-password + verification emails)

Without SMTP, links are **logged in API console** (dev OK). For real mail:

```env
EMAIL_FROM=Samyoj <noreply@yourdomain.com>
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
SMTP_SECURE=false
```

## Password policy

- Min 8 characters  
- Must include uppercase, lowercase, and a number  
- Blocks common passwords  

## Security notes (AUTH_DEEP_REVIEW)

Still intentional tradeoffs until a larger cookie-session migration:

- Access + refresh tokens remain in `sessionStorage` per tab (XSS can still read them). HttpOnly cookies deferred to SAMYOJ-3.  
- Microsoft OAuth routes removed from the active OAuth module (Google only).  
- 2FA secrets encryption / backup codes remain a follow-up under Team settings.
- Meta OAuth token-exchange uses `GET /oauth/access_token?client_secret=...` (Meta's API design). POST would be a contract change with Meta's Graph API — cannot be changed unilaterally. The `client_secret` is only sent server-to-server (never exposed to the browser).

## API endpoints

| Method | Path |
|--------|------|
| POST | `/api/auth/register` |
| POST | `/api/auth/login` |
| POST | `/api/auth/refresh` |
| POST | `/api/auth/logout` |
| GET | `/api/auth/me` |
| POST | `/api/auth/forgot-password` |
| POST | `/api/auth/reset-password` |
| POST | `/api/auth/verify-email` |
| POST | `/api/auth/resend-verification` |
| GET | `/api/auth/oauth/google/url` |
| GET | `/api/auth/oauth/google/callback` |
| POST | `/api/auth/oauth/exchange` |
| GET | `/api/auth/oauth/google/status` |

Source of issues reviewed: `docs/audit/AUTH_DEEP_REVIEW.md`.
