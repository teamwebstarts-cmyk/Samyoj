# Environment Backup & VM Recovery

The workspace env files (`server/.env`, `client/.env`, `admin/.env`) are
git-ignored and do **not** survive a Codespace/VM rebuild. This folder keeps a
restore copy so a fresh VM can be brought back in minutes.

## What is saved here

| File | Purpose |
|---|---|
| `server.env.backup` | Full server env (Meta, Sarvam, Azure, Razorpay, JWT, ngrok) |
| `client.env.backup` | Client Vite env |
| `admin.env.backup` | Admin Vite env |

These copies are also git-ignored (`.gitignore` → `docs/env-backup/*.backup`)
because they contain real secrets. They live only in this VM's disk. For
off-VM safety, keep a copy in your private password manager / private gist.

## Restore after a VM rebuild

```bash
cd /workspaces/Samyoj
cp docs/env-backup/server.env.backup server/.env
cp docs/env-backup/client.env.backup client/.env
cp docs/env-backup/admin.env.backup admin/.env
chmod 600 server/.env client/.env admin/.env
bash setup.sh   # installs deps, starts docker, then start.sh
```

## Fresh-database note (important)

A rebuilt VM usually means an **empty Postgres volume**. The migration gate
(`db:migrate-startup-safe`) is fail-closed and refuses fresh installs because
the historical migration `20260808120000_unique_whatsapp_phone_number_id`
contains a `DELETE FROM whatsapp_numbers`.

On a genuinely empty database that DELETE provably touches zero rows (the table
is created empty by `20250617000000_init` earlier in the same chain). The
documented one-time procedure used on 2026-08-21:

```bash
cd server
npm run db:backup                        # documentary dump first
npx prisma migrate deploy                # apply full chain ONCE on empty DB
npm run db:preflight-number-isolation    # must exit 0
cd .. && bash start.sh
```

Never run raw `prisma migrate deploy` against a database that already has data.

## After any restore

1. Register the first account at http://localhost:3000 (fresh DB = no users).
2. Settings → Connect WhatsApp (OAuth) — tunnel + webhook re-register via `start.sh`.
3. Send a new message from a phone to prove inbound (`totalReceived` > 0).

Last verified full restore: 2026-08-21.
