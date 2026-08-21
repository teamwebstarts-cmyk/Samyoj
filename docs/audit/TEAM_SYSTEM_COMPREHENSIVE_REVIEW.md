# Team System — Comprehensive Documentation & Review

**Date:** 2026-08-21
**Scope:** `server/src/modules/team/`, `client/src/pages/TeamPage.tsx` + `client/src/components/team/`, Prisma schema, and every cross-module connection (Inbox, Presence, Auth, Analytics, Billing, Sockets, Platform Admin).
**Method:** Full source read of every route/component/schema model + integration tracing + competitor research (Freshdesk, Intercom, Wati). Every claim cites `file:line`.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Database Model](#3-database-model)
4. [Backend — Complete Route Reference](#4-backend--complete-route-reference)
5. [Permission System](#5-permission-system)
6. [Frontend — Page & Component Inventory](#6-frontend--page--component-inventory)
7. [Cross-Module Integration Map](#7-cross-module-integration-map)
8. [Assignment Lifecycle](#8-assignment-lifecycle)
9. [Security Review](#9-security-review)
10. [Issues Found (POC-verified)](#10-issues-found-poc-verified)
11. [Competitor Analysis](#11-competitor-analysis)
12. [Recommendations (Prioritized)](#12-recommendations-prioritized)
13. [Test Coverage](#13-test-coverage)

---

## 1. Executive Summary

The Team feature is a **complete, working multi-member workspace system**: role-based membership (OWNER/ADMIN/SUPERVISOR/AGENT), email invites with 7-day tokens, per-role + per-member permission overrides, departments, seat limits by plan, availability/heartbeat presence, 2FA (TOTP), session management, audit logging, and conversation reassignment on member removal.

**Verdict: 7.5/10 for internal test deploy.** Core flows are solid and better-engineered than most of the codebase (transactional deletes, fresh-from-DB role loading, socket removal guard). But there are **two real security gaps** (unvalidated reassign targets; invite accept can hijack existing accounts), **four dead permission keys** that the Roles UI lets admins toggle with zero backend effect, **two fully-built components that are never rendered** (Audit tab, Settings tab), and a stale-presence bug that silently breaks AI handoff routing.

Nothing here blocks the test deploy. Items R1–R4 in §12 should land before any customer production.

---

## 2. Architecture Overview

```
┌────────────────────────── CLIENT (:3000) ──────────────────────────┐
│ TeamPage.tsx (4 tabs: members/invites/departments/roles)           │
│   ├─ TeamMembersTab → cards, add/edit/remove slide-overs           │
│   ├─ TeamInvitesTab  → invite list + create (admin only)           │
│   ├─ TeamDepartmentsTab → dept CRUD                                │
│   └─ TeamRolesTab    → permission matrix editor (admin only)       │
│ AcceptInvitePage (/invite/:token) — public                         │
│ AuthContext — heartbeat every 60s, orgRole, canManageTeam          │
│ Settings → General → TeamSecurityPanel (sessions + 2FA)            │
└──────────────┬─────────────────────────────────────────────────────┘
               │ Bearer JWT + X-WhatsApp-Number-Id
┌──────────────▼──────────────── SERVER (:8000) ─────────────────────┐
│ /api/team/*  (routes.ts, guards: authenticate→requireOrg→          │
│               loadOrgRole→requireOrgRole(OWNER,ADMIN))             │
│   ├─ assignment.ts  — LEAST_LOAD / ROUND_ROBIN handoff picking     │
│   ├─ metrics.ts     — AgentMetrics aggregation                     │
│   ├─ audit.ts       — TeamAuditLog writer                          │
│   └─ types.ts       — DEFAULT_PERMISSIONS, getSeatLimit            │
│ Consumed by: inbox assign, ai handoff.service, calling routing,    │
│              analytics leaderboard, billing seat display           │
└──────────────┬─────────────────────────────────────────────────────┘
               │ Prisma
┌──────────────▼──────────── POSTGRES ───────────────────────────────┐
│ User · OrganizationUser · Organization · TeamInvite · Department   │
│ RefreshSession · TeamAuditLog                                      │
└────────────────────────────────────────────────────────────────────┘
```

Module files (`server/src/modules/team/`): `routes.ts`, `types.ts`, `totp.ts`, `totp.test.ts`, `assignment.ts`, `metrics.ts`, `audit.ts`. Mounted at `app.use('/api/team', teamRoutes)` (`server/src/index.ts:259`).

---

## 3. Database Model

### 3.1 `User` (global identity)
| Field | Notes |
|---|---|
| `id`, `email` (unique), `passwordHash` | bcrypt cost 12 |
| `name`, `role` | global `UserRole`: `ADMIN \| AGENT` — mirrors org role at register; **not** used for platform admin |
| `emailVerifiedAt` | set immediately at register (verification theater — see §10-I8) |
| `preferredLanguage`, `twoFactorEnabled` | |
| Relations | `memberships OrganizationUser[]`, refresh sessions |

### 3.2 `OrganizationUser` (membership — the heart of Team)
| Field | Notes |
|---|---|
| `organizationId` + `userId` | composite unique — one membership per org per user |
| `orgRole` | enum `OrgRole`: `OWNER \| ADMIN \| SUPERVISOR \| AGENT` |
| `permissions` | JSON — per-member overrides merged over role defaults |
| `availability` | enum: `ONLINE \| AWAY \| OFFLINE` (schema.prisma:664) |
| `lastActiveAt` | updated by heartbeat; **never used to decay availability** (§10-I3) |
| `departmentId` | FK → Department, nullable |
| `shiftSchedule` | JSON, nullable — respected by handoff picker |
| `mustResetPassword` | Boolean — stored but **never enforced at login** (§10-I7) |
| `twoFactorSecretEncrypted` | TOTP secret for member-level 2FA |

### 3.3 Supporting models
- **`TeamInvite`** — `token` (uuid), `email`, `name`, `orgRole`, `departmentId`, `permissions` JSON, `status` (`PENDING/ACCEPTED/EXPIRED/REVOKED`), `expiresAt` (7 days), `invitedById`.
- **`Department`** — `name`, `color` (hex), org-scoped.
- **`RefreshSession`** — per-device sessions; revoked on member delete and password reset.
- **`TeamAuditLog`** — actor, action, targetUser, changes JSON.

### 3.4 Key design decisions (good ones)
1. **Role is never in the JWT** (`server/src/utils/jwt.ts:8-12` — claims are only `{userId, email, organizationId}`). Every request loads role fresh via `loadOrgRole` (`middleware/auth.ts:62`) → role changes take effect on the very next HTTP call, no token rotation needed.
2. **Member deletion is one transaction** (`team/routes.ts:1196-1248`): conversations reassigned/unassigned, calls unassigned, tickets + leads reassigned, membership deleted, all refresh sessions revoked. No orphaned assignments *when the target is valid* (but see §10-I1).
3. **OWNER is immutable from the API**: PATCH blocks modifying OWNER (`routes.ts:1094+`); DELETE blocks removing OWNER/self; permission overrides can't touch OWNER (`types.ts:84-86`).

---

## 4. Backend — Complete Route Reference

Shared guards (`server/src/modules/team/routes.ts:28`):
```ts
adminGuard = [authenticate, requireOrg, loadOrgRole, requireOrgRole('OWNER','ADMIN')]
```
- `authenticate` — Bearer JWT (`middleware/auth.ts:16`)
- `requireOrg` — JWT must carry `organizationId`; verifies live `OrganizationUser` row (`auth.ts:46`)
- `loadOrgRole` — loads membership → `req.orgRole` (`auth.ts:62`)
- `requireOrgRole(...)` — 403 unless role ∈ list (`auth.ts:88`)

### Member management
| Method | Path | Guards | Purpose |
|---|---|---|---|
| GET | `/api/team/` | auth+org (+`search`,`departmentId` query) | Members with resolved permissions, assigned-conversation counts, summary `{total, owners, admins, supervisors, agents, online}` (`routes.ts:898`) |
| GET | `/api/team/:id` | auth+org | Single member + AgentMetrics + last 20 assigned conversations (`routes.ts:960`) |
| POST | `/api/team/` | adminGuard | Direct-add member `{name,email,password,orgRole,departmentId,permissions,shiftSchedule}`; seat check; reuses existing User by email; sets `mustResetPassword:true`, `availability:OFFLINE`; audits `MEMBER_ADDED` (`routes.ts:998`) |
| PATCH | `/api/team/:id` | adminGuard | Update name/role/dept/availability/permissions/shift/password/language. Blocks OWNER edits, self-role-change; role change OWNER-only; audits `ROLE_CHANGED`/`MEMBER_UPDATED` (`routes.ts:1094`) |
| POST | `/api/team/:id/reassign` | adminGuard | Bulk move all conversations to `toAgentId` or unassign (`routes.ts:1174`) |
| DELETE | `/api/team/:id` | adminGuard | Transactional removal + cleanup + session revocation (`routes.ts:1196`) |

### Invites
| Method | Path | Guards | Purpose |
|---|---|---|---|
| GET | `/invites` | adminGuard | PENDING/EXPIRED invites incl. raw invite URL with token (`routes.ts:410`) |
| POST | `/invites` | adminGuard | Seat check counts members + pending invites; 409 if already member; creates uuid-token invite, 7-day expiry; emails link; audits `INVITE_SENT` (`routes.ts:441`) |
| DELETE | `/invites/:id` | adminGuard | Revoke PENDING invite; audits `INVITE_REVOKED` (`routes.ts:539`) |
| GET | `/invites/token/:token` | **public** | Lookup; lazily flips expired → EXPIRED + 410; returns email/name/role/company/dept/expiry (`routes.ts:564`) |
| POST | `/invites/accept` | **public** | Tx: create-or-update User (bcrypt 12), create membership with invite role/dept/perms, mark ACCEPTED, return access+refresh tokens, audits `INVITE_ACCEPTED` (`routes.ts:595`) |

### Departments
| Method | Path | Guards | Purpose |
|---|---|---|---|
| GET | `/departments` | auth+org | List with member counts (`routes.ts:302`) |
| POST | `/departments` | adminGuard | Create `{name 2–50, color?}` default `#10b981`; audits `DEPARTMENT_CREATED` (`routes.ts:326`) |
| PATCH | `/departments/:id` | adminGuard | Org-scoped update; audits `DEPARTMENT_UPDATED` (`routes.ts:350`) |
| DELETE | `/departments/:id` | adminGuard | Tx: null members' `departmentId`, delete; audits `DEPARTMENT_DELETED` (`routes.ts:379`) |

### Roles, settings, presence, security
| Method | Path | Guards | Purpose |
|---|---|---|---|
| GET | `/agents` | auth+org | All memberships (id/name/email/availability/departmentId) — feeds every agent dropdown in the app (`routes.ts:105`) |
| GET/PATCH | `/settings` | adminGuard | Assignment strategy (`LEAST_LOAD\|ROUND_ROBIN`), seatLimit (≤ plan max unless enterprise), `handoffOnlyOnline`, `respectShiftSchedule` → stored in `Organization.settings.team` (`routes.ts:131,155`) |
| GET/PATCH | `/role-permissions` | adminGuard | Permission matrix read / merge overrides for ADMIN/SUPERVISOR/AGENT only (`routes.ts:195,212`) |
| POST | `/heartbeat` | auth+org | `lastActiveAt=now`, availability defaults ONLINE; called every 60s by client (`routes.ts:249`) |
| PATCH | `/me/availability` | auth+org | Explicit status change; audits `AVAILABILITY_CHANGED` (`routes.ts:272`) |
| GET | `/audit` | adminGuard | Last N (≤100) TeamAuditLog rows (`routes.ts:708`) |
| GET/DELETE | `/sessions`, `/sessions/:id` | auth+org | Own-session list / revoke one / revoke-all-except-current (`routes.ts:731,753,780`) |
| POST | `/me/2fa/setup` / `enable` / `disable` | auth+org | TOTP enroll → verify → disable (needs password + code) (`routes.ts:803,825,857`) |

---

## 5. Permission System

### 5.1 Three-layer merge (`resolvePermissions`, `team/types.ts:79-93`)
1. **Hardcoded defaults** per OrgRole (`DEFAULT_PERMISSIONS`, types.ts:40-77)
2. **Org-wide overrides** — `Organization.settings.team.rolePermissions[role]` (loaded `permissions.ts:33-39`)
3. **Per-member overrides** — `OrganizationUser.permissions` JSON

**OWNER always gets everything**, regardless of stored overrides (`types.ts:84-86`).

### 5.2 Default matrix

| Key | OWNER | ADMIN | SUPERVISOR | AGENT |
|---|:-:|:-:|:-:|:-:|
| manageTeam | ✅ | ✅ | ❌ | ❌ |
| manageSettings | ✅ | ✅ | ❌ | ❌ |
| manageCampaigns | ✅ | ✅ | ❌ | ❌ |
| manageTemplates | ✅ | ✅ | ❌ | ❌ |
| manageFlows | ✅ | ✅ | ❌ | ❌ |
| manageInbox | ✅ | ✅ | ✅ | ✅ |
| viewAnalytics | ✅ | ✅ | ✅ | ❌ |

### 5.3 Where permissions are actually enforced ⚠️

Only **three keys have real server-side gates**:

| Key | Enforced at |
|---|---|
| `manageInbox` | labels CRUD, canned replies, tickets, leads write (`labels/routes.ts:23…`, `canned-replies/routes.ts:37…`, `tickets/routes.ts:99…`, `leads/routes.ts:67…`) |
| `manageInbox` OR `viewAnalytics` | leads list (`leads/routes.ts:27`) |
| `viewAnalytics` | analytics reports/leaderboard/agent-analytics, SLA stats (`analytics/routes.ts:229,391,466`, `compliance/routes.ts:110`) |
| `manageSettings` | billing plan changes, payment links, integrations API keys/webhooks, Google Sheets, compliance consent (`billing/routes.ts:100,153,295`, `integrations/routes.ts:37…`, `compliance/routes.ts:14,75`) |

**Dead keys — defined, editable in the Roles UI, but enforced NOWHERE** (grep across `server/src` = 0 hits):
`manageTeam`, `manageCampaigns`, `manageTemplates`, `manageFlows`.

Those four modules instead use coarse `requireOrgRole('OWNER','ADMIN')` guards (`campaigns/routes.ts:41`, `flows/routes.ts:23`, `automation/routes.ts:14`, `ai-bot/routes.ts:73`, `settings/routes.ts:61`). Consequence: granting SUPERVISOR `manageCampaigns` in the matrix does nothing; revoking AGENT's `manageInbox` does work. This inconsistency is invisible to the admin editing the matrix. → **R2**.

Also notable: **inbox assignment itself is permission-free** — `PATCH /inbox/:id/assign` sits behind only `authenticate, requireOrg, resolveActiveWhatsappNumber` (`inbox/routes.ts:140,1626`), so a member whose `manageInbox` was revoked can still assign conversations. → **R3**.

---

## 6. Frontend — Page & Component Inventory

### 6.1 Page shell — `client/src/pages/TeamPage.tsx`
- 4 tabs: **Members / Invites / Departments / Roles** (`TeamPage.tsx:14`).
- Invites + Roles are `adminOnly` (`tabMeta`, line 17-24); visible-tab filtering uses `canManageTeam = orgRole === 'OWNER' || 'ADMIN'` from `AuthContext.tsx:306`.
- Hero copy swaps per tab (`heroCopy`, line 26).
- Loads departments once and passes down; summary stats come from the members payload.

### 6.2 Components (`client/src/components/team/`)
| Component | Responsibility | Notes |
|---|---|---|
| `TeamMembersTab.tsx` | Search/filter, member grid, add/edit/remove flows, reassign dialog | Mixed client+server filtering (§10-C5) |
| `TeamInvitesTab.tsx` | Pending invites table, create-invite slide-over, copy link, revoke | Shows raw invite URL |
| `TeamDepartmentsTab.tsx` | Dept CRUD grid | **No edit/rename UI** though `PATCH /departments/:id` exists (§10-C2) |
| `TeamRolesTab.tsx` | 7×3 permission matrix editor | Saves via `PATCH /role-permissions`; toggles 4 dead keys (§10-I2) |
| `TeamMemberCard.tsx` | Avatar, role badge, availability dot, actions | Contains invalid nested-button HTML (§10-C4) |
| `AvailabilityBadge.tsx` | ONLINE/AWAY/OFFLINE pill | |
| `TeamAuditTab.tsx` | Audit log viewer | **DEAD CODE — never imported by TeamPage** (grep confirms) |
| `TeamSettingsTab.tsx` | Seat limit, assignment strategy, handoff toggles | **DEAD CODE — never imported** |
| `TeamSecurityPanel.tsx` | Sessions list/revoke + 2FA setup | Lives in **Settings → General**, not Team page |
| `teamUi.tsx` | `ROLE_COLUMNS`, badges, shared bits | |

### 6.3 Public flow — `AcceptInvitePage` (`/invite/:token`)
Fetches `GET /invites/token/:token` → shows org name, invited email, role → posts `POST /invites/accept` with name+password → receives tokens → lands in app.

### 6.4 API client — `teamApi` (`client/src/services/api.ts:744-793`)
`list, get, agents, create, update, remove, reassign, invites.{list,create,revoke,getByToken,accept}, settings.{get,update}, rolePermissions.{get,update}, audit, sessions.{list,revoke,revokeAll}, me2fa.{setup,enable,disable}` — full coverage of the backend; **`reassign`, `settings.*`, `audit` currently have no live caller** because their components are dead code.

### 6.5 Role gating in UI
- Nav item "Team" is `showForRoles: SUPERVISOR_PLUS` (`navigation.ts:84`) — AGENTs don't see the page at all.
- Inside the page, AGENT/SUPERVISOR see only Members (read-only-ish); invites/roles hidden.
- OWNER rows lock edit/delete everywhere.
- Mobile: Team reachable via More menu.

### 6.6 UX quality
Good: skeletons (`ListLayoutSkeleton`), empty states with CTAs, confirm dialogs for destructive actions, disabled states while saving, aria-labels on icon buttons.
Gaps: no optimistic updates (every action refetches), no department rename, no manual availability switcher in the top bar (context method exists but unused — §10-C3), duplicated availability config between `teamUi.tsx` and `AuthContext`.

---

## 7. Cross-Module Integration Map

### 7.1 Team ↔ Inbox (assignment)
- `PATCH /api/inbox/:id/assign` validates target is an org member ("Agent is not a team member", `inbox/routes.ts:1633-1640`), sets `assignedAgentId`, broadcasts `conversation:assigned` + `conversation:updated` to `org:{orgId}`, emails the agent (`notification.service.ts:44-57`).
- Bulk variant: `POST /inbox/bulk {action:'assign'}` (`inbox/routes.ts:1838-1907`).
- Filter by assignee: `?assignedTo=` → `where.assignedAgentId` (`inbox/routes.ts:176,196`).
- **Agent dropdowns everywhere** (`InboxPage.tsx:375`, `TicketDetailPanel.tsx:44`, `LeadFormSlideOver.tsx:43`, `flowReferenceData.ts:22`) all call `GET /api/team/agents`.

### 7.2 Team ↔ AI handoff (auto-assignment)
When a bot hands off with no assignee, `ai/handoff.service.ts:12-37` calls team's `pickAgentForHandoff` (`team/assignment.ts:105-141`):
- `LEAST_LOAD` — fewest open conversations among eligible agents
- `ROUND_ROBIN` — index persisted in `Organization.settings.team.roundRobinIndex`
- Eligibility filter honors `handoffOnlyOnline` (skips OFFLINE/AWAY, `assignment.ts:80-81`) and `respectShiftSchedule`.

### 7.3 Team ↔ Calling
Call routing filters strictly-ONLINE agents for ring groups (`calling/routing.service.ts:87-88`). Same stale-presence risk as handoff (§10-I3).

### 7.4 Team ↔ Presence (two separate systems — do not confuse)
1. **Durable availability** on `OrganizationUser.availability` — heartbeat every 60s from `AuthContext.tsx:169-174`; login flips ONLINE (`auth/routes.ts:208-211`). Feeds handoff eligibility, call routing, Reports, Team badges, online-count summary.
2. **Ephemeral "X is viewing"** (`inbox/presence.ts`) — in-memory, 60s TTL, events `conversation:presence`. Does **not** read team availability at all.

### 7.5 Team ↔ Sockets (removal propagation — verified working)
- Handshake: `socketAuthMiddleware` checks active membership (`socket-auth.ts:13-51`).
- Runtime: `startMembershipGuard` polls every 60s; on revocation emits `session:revoked {reason:'membership_revoked'}` then force-disconnects (`socket-auth.ts:59-92`). Client (`useSocket.ts:220-232`) stops reconnecting, clears tokens, redirects to login.
- Confirmed by audit: removed users are disconnected within ≤60s (`audit/FULL_REVIEW_2026-08-18.md:108-119`).

### 7.6 Team ↔ Auth
- Register: first user becomes OWNER (User + Organization + OrganizationUser in one tx, `auth/routes.ts:71-98`).
- Invite accept: public, token-based; returns tokens directly.
- Password reset: standard forgot/reset flow revokes all refresh tokens.
- `mustResetPassword` flag: set on admin-create, **never checked at login** (§10-I7).

### 7.7 Team ↔ Analytics
Reports agent performance + leaderboard iterate `organizationUser.findMany` and aggregate per `assignedAgentId` (`analytics/routes.ts:308-349,399-456`). Leaderboard gated by `viewAnalytics` so default AGENTs excluded. Removed members vanish from leaderboards automatically (membership-based iteration).

### 7.8 Team ↔ Billing (seats — two sources of truth)
- **Enforced path:** `getSeatLimit(plan, settings)` (`team/types.ts:110-128`): launch 1 / starter 3 / growth 10 / pro-business 25 / enterprise custom ≤999. Invite counts members+pending; direct-create counts members.
- **Unused parallel path:** billing entitlements define a `seats` QuotaType with `PLAN_TIERS.seats` (`billing/plans.ts:41-99`) and `checkQuota(org,'seats')` — **zero call sites** (contacts/waNumbers/etc. are enforced; seats is not). Two systems waiting to drift. → **R5**.

### 7.9 Team ↔ Platform Admin (`admin/` :3001)
Platform admins see orgs with owner email (`platform/orgs.ts:240-262`) and full member list `{role, lastActiveAt, user{email,name}}` + seatCount (`orgs.ts:285-291,364`). **Read-only** — no member management, no impersonation yet (documented SAMYOJ-57 remaining work).

---

## 8. Assignment Lifecycle

```
Assign      PATCH /inbox/:id/assign        ← validates membership ✓
            POST /inbox/bulk {assign}      ← validates membership ✓
   or auto  AI handoff → pickAgentForHandoff (strategy + online + shift filters)
   ↓
Live        conversation.assignedAgentId · socket broadcast · email ping
   ↓
Reassign    POST /team/:id/reassign {toAgentId}   ← ⚠️ NO membership validation
   ↓
Remove      DELETE /team/:id {reassignToId?}      ← ⚠️ NO membership validation
            tx: conversations→target|null · calls→null · tickets→target|null
                leads→target|null · delete membership · revoke sessions
   ↓
Sockets     membership guard disconnects ≤60s · client force-logout
   ↓
Orphans     none IF target valid; if target was a non-member UUID,
            conversations point at a ghost — invisible in every filter,
            never cleaned by future deletions.                    (§10-I1)
```

---

## 9. Security Review

### What's done right
- bcrypt cost 12 everywhere; TOTP secrets encrypted at rest (`ENCRYPTION_KEY`).
- Role loaded fresh from DB per request — instant revocation.
- Public invite endpoints are token-based (uuid), 7-day expiry, lazy EXPIRED flip, throttled login (`platformAuthLoginLimiter` pattern also applied to customer login).
- Session-bound CSRF on platform mutations; cookie flags handled in `security.ts`.
- Socket membership guard closes the "removed but still connected" hole within 60s.
- Transactional member deletion prevents partial cleanup.
- Owner immutability + cannot-change-own-role prevents privilege lockout/desecration.

### Gaps (each detailed in §10)
| # | Severity | Gap |
|---|---|---|
| I1 | **High** | Reassign/delete targets not validated as members → ghost assignments |
| I5 | **High** | Invite accept overwrites an existing account's name+password without old-password proof |
| I2 | Medium | 4 permission keys are dead config (UI lies about enforcement) |
| I3 | Medium | Stale ONLINE presence — no sweeper; breaks handoff/call routing |
| I4 | Medium | JWT in sessionStorage (XSS steals any member session) — known SAMYOJ-3, deferred |
| I6 | Low | Duplicate seat-limit sources (team vs billing entitlements) |
| I7 | Low | `mustResetPassword` cosmetic only |
| I8 | Low | Email verification theater (shared trust model for invited users) |

---

## 10. Issues Found (POC-verified)

### Backend
- **I1 — Ghost assignments via unvalidated reassign targets.** `POST /team/:id/reassign` accepts any UUID for `toAgentId` without checking an `OrganizationUser` row (`team/routes.ts:1180-1190`); same for `reassignToId` in DELETE (`routes.ts:1202-1233`). Contrast: inbox assign validates (`inbox/routes.ts:1633-1640`). A typo'd/pasted UUID permanently assigns conversations to a non-member — invisible in every agent filter and never cleaned by later member deletions. **Fix: one `findFirst` membership check before updateMany, mirroring inbox.**
- **I2 — Dead permission keys.** `manageTeam/manageCampaigns/manageTemplates/manageFlows` exist in `DEFAULT_PERMISSIONS` (`types.ts:5-13`) and are editable in the Roles matrix, but grep finds zero `requirePermission` usages. Campaigns/templates/flows/settings use `requireOrgRole('OWNER','ADMIN')` instead. An admin who grants SUPERVISOR campaign rights sees no effect; the UI presents it as if it worked.
- **I3 — Stale ONLINE presence.** Availability is set only by heartbeat/login/explicit PATCH. If a browser dies without logout, the member stays ONLINE forever — `handoffOnlyOnline` (`assignment.ts:80-81`) and strict-ONLINE call routing (`routing.service.ts:88`) keep routing to an absent person. `lastActiveAt` is stored but never consulted. **Fix: sweeper — availability=AWAY when `now - lastActiveAt > N minutes`.**
- **I4 — Inbox assign has no permission gate.** `PATCH /inbox/:id/assign` requires no `loadPermissions`/`manageInbox` (`inbox/routes.ts:140,1626`) — a member with revoked `manageInbox` can still assign. Labels/canned-replies around it are gated; the core action isn't.
- **I5 — Invite accept account hijack.** If a User already exists with the invite email, accept overwrites name+password without knowing the old password (`team/routes.ts:623-630`). Anyone who can cause an invite to be sent to an existing user's email and intercept the link gains the account. Mitigation: require the existing user to be logged-in OR send a confirmation to the current account owner OR refuse and prompt "this email already has an account — sign in to join".
- **I6 — Dual seat-limit sources.** `getSeatLimit` (team) vs `PLAN_TIERS.seats` + `checkQuota('seats')` (billing entitlements, computed-but-unused). Plans already diverge (`business→25` legacy map). Pick one source; delete the other.
- **I7 — `mustResetPassword` never enforced.** Set on admin-create (`routes.ts:1050`), returned in payloads (`routes.ts:99`), ignored by login (`auth/routes.ts:177-260`). Either enforce at login (force reset screen) or drop the field.
- **I8 — Email verification theater.** `emailVerifiedAt` set at register (`AUDIT_REMAINING_2026-08-18.md:72-77`); invited members inherit the same trust model.

### Frontend
- **C1 — Dead components.** `TeamAuditTab.tsx` and `TeamSettingsTab.tsx` are fully built (audit viewer; seat-limit + assignment-strategy + handoff toggles) but never imported by `TeamPage.tsx` (grep: only self-references). Users cannot see audit logs or change assignment strategy at all today.
- **C2 — No department rename UI.** `PATCH /departments/:id` exists; `TeamDepartmentsTab` offers create/delete only.
- **C3 — Manual availability switcher missing.** `PATCH /me/availability` + context method exist; no UI in the top bar/profile menu. Agents can't set AWAY without devtools.
- **C4 — Invalid nested buttons.** `TeamMemberCard` renders `<button>` inside `<button>` (card action wrapping row actions) — React hydration warning + broken a11y.
- **C5 — Mixed filtering.** Members tab filters client-side after fetching all, while search param exists server-side (`GET /team/?search=`) — fine at <500 members, wasteful beyond.
- **C6 — Unused typed APIs.** `teamApi.reassign/settings.*/audit` have no callers (consequence of C1).

---

## 11. Competitor Analysis

Researched: Freshdesk roles/scopes, Intercom teammate permissions, Wati operator seats (public docs, 2026).

| Capability | Freshdesk | Intercom | Wati | **Samyoj today** |
|---|---|---|---|---|
| Role model | Default roles (Agent/Supervisor/Admin/Account-Admin) + **custom roles** on higher tiers | Per-teammate individual permission toggles | Fixed operator roles by plan | 4 fixed roles + per-role org overrides + per-member overrides ✅ strong |
| Visibility scoping | **Ticket scope: Global / Group / Restricted-to-assigned** | Limit teammates' conversation access | Chat visibility restricted to assigned | ❌ none — every member sees all conversations |
| Seat enforcement | Full-time vs Occasional agent seat types | Seats hard-tied to plan | Fixed seats by plan | ✅ enforced (invite+create) but dual sources (I6) |
| Self-permission edit | Blocked (can't edit own perms) | Explicitly blocked ("security measure") | — | Partially blocked (can't change own *role*, but own *permissions* editable) |
| Presence decay | Auto-away on idle | Auto away/idle | — | ❌ manual only (I3) |
| Removal safety | Reassignment prompts built into deactivation | Offboarding flow | Reassign chats | ✅ transactional reassign — but unvalidated target (I1) |
| Audit trail | Activity logs (admin-gated) | Teammate activity logs | Limited | ✅ built… but UI dead (C1) |

**Takeaways for Samyoj:**
1. **Conversation visibility scoping is the biggest competitive gap.** All three competitors let you restrict an agent to "only assigned conversations" (Freshdesk Restricted scope, Intercom access limits, Wati assigned-only). Samyoj's inbox is all-or-nothing per member. For Indian SMBs with outsourced/freelance agents this is a common ask.
2. **Auto-away presence** is table stakes elsewhere; our static ONLINE actively harms handoff quality (I3).
3. **Custom roles** (Freshdesk-style named bundles) would be a natural v2 on top of our override layers — we already store per-member JSON, so it's a naming/grouping feature, not a schema change.
4. **Block editing own permissions** explicitly (Intercom treats it as a security invariant; we only block own role).

---

## 12. Recommendations (Prioritized)

### Before customer production (P0)
- **R1 — Validate reassign/delete targets** (fixes I1): in both endpoints, `findFirst` the target `OrganizationUser` in the same org; 404 otherwise. ~10 lines. Highest correctness-per-effort fix in the module.
- **R2 — Make the Roles matrix honest** (fixes I2): either (a) wire `manageCampaigns/manageTemplates/manageFlows` into real `requirePermission` gates replacing the coarse role guards, or (b) hide/disable those four rows in `TeamRolesTab` with a "managed by role" note until wired. (b) is a day; (a) is a week.
- **R3 — Gate inbox assignment** (fixes I4): add `loadPermissions, requirePermission('manageInbox')` to `PATCH /inbox/:id/assign` and bulk-assign.
- **R4 — Close the invite-hijack path** (fixes I5): when `User` exists for the invite email, require the accepting party to authenticate (sign-in then "join workspace") instead of blind password overwrite.

### High-value polish (P1)
- **R5 — Unify seat limits** (fixes I6): make `getSeatLimit` delegate to `PLAN_TIERS.seats`; delete the legacy map; optionally start calling `checkQuota('seats')` for consistency with contacts.
- **R6 — Presence sweeper** (fixes I3): cron/worker — `UPDATE organization_users SET availability='AWAY' WHERE availability='ONLINE' AND last_active_at < now()-interval '5 minutes'`. Immediately improves handoff + call routing accuracy.
- **R7 — Ship the dead tabs** (fixes C1/C6): mount `TeamAuditTab` (admin-only) and `TeamSettingsTab` into `TeamPage`. Both are already built; this is wiring + a tab key each. Instantly exposes audit logs and assignment-strategy control that exist today but are unreachable.
- **R8 — Enforce or drop `mustResetPassword`** (fixes I7): cheapest correct behavior — login response includes the flag; client redirects to a forced-reset screen until cleared.

### Nice-to-have (P2)
- **R9 — Assigned-only inbox scope** (competitive gap): new permission key `viewAllConversations` (default true for SUP+, false optional for AGENT); inbox list adds `assignedAgentId = req.user.userId` when absent. Schema-free; one where-clause.
- **R10 — Department rename UI** (C2): small modal on `TeamDepartmentsTab`.
- **R11 — Availability switcher** (C3): dropdown in the sidebar profile chip → `PATCH /me/availability`.
- **R12 — Fix nested-button HTML** (C4): convert card container to div with onClick, keep inner buttons.
- **R13 — Custom roles v2**: named bundles of the existing permission keys stored in `Organization.settings.team.customRoles`; member picks a bundle. No schema migration needed.
- **R14 — Server-side pagination for members** once orgs exceed ~200 members (C5).

### Explicitly do NOT build now
- Impersonation (tracked on SAMYOJ-57 remaining work — don't duplicate).
- HttpOnly cookies / JWT storage change (SAMYOJ-3, Phase 2 decision — do not rewrite auth unprompted).
- Billing-plan changes to seat pricing (SAMYOJ-35 TARGET spec — untouched).

---

## 13. Test Coverage

Existing (`server/src/modules/team/totp.test.ts`, `middleware/auth.test.ts`, platform tests):
- TOTP generate/verify round-trip ✔
- `requireOrgRole` allow/deny paths incl. API-key sentinel ✔
- Platform RBAC separation (SUPER_ADMIN vs SUPPORT) ✔

**Not covered (write these when touching the module):**
1. Invite lifecycle: create → token fetch → expired-flip → accept → revoke (the money path, zero tests).
2. Member delete transaction: conversations/tickets/leads reassigned, calls nulled, sessions revoked.
3. Seat-limit boundary: invite rejected at `memberCount + pending == seatLimit`.
4. `resolvePermissions` merge order: default < org override < member override; OWNER always full.
5. Reassign endpoint validation (will fail until R1 lands — write the test first).
6. Heartbeat/availability transitions incl. the R6 sweeper.

---

*End of document. Source of truth remains the code; if this doc and code disagree, code wins — file an issue against this doc.*
