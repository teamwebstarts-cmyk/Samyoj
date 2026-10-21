# AWS VPS audit — what changed, what was tested

Date: 2026-10-21. Host: `samyoj-poc` (`i-085ca1949bb94e621`), `app.samyoj.com`.

The live process is the compiled tree deployed today on top of git `876daec6377f9b8551fd8a6900362801c3fcbdf4`. Those audit edits are not a separate commit. `/health` reports that base SHA. Rollback tarball: `/var/backups/samyoj/dist-before-audit-2026-10-21.tgz`.

## Results

| ID | Change | Test | Result |
|----|--------|------|--------|
| P0-1 | Nightly `pg_dump` script, systemd timer 01:30 UTC, S3 bucket `samyoj-backups-157328692150`, EBS DLM daily retain 7 | Local tooling script; on-box `BACKUP_VERIFY=1` restore drill | Passed earlier this session. Timer enabled. Scratch DB dropped. |
| P1-1 | `graphApiError` / `isMetaUnavailableError`; templates route `/by-any-active-number` skips a dead WABA; production row `918839888531` set `is_active=false` (history kept) | Vitest graph mapping + dead-WABA isolation; SQL select shows only `919303618219` active | Passed. The old `GET /api/templates` path still needs a number header when more than one number is active. With one active number it no longer selects the dead WABA. |
| P1-2 | Oversize webhook envelopes become a COMPLETED tombstone; queue defaults; startup sweep abandons envelopes claimed more than 1 hour | Vitest oversize + accept; production rows are `ABANDONED` 2 and `COMPLETED` 56; the two BullMQ failed jobs removed | Passed. `bull:webhook-queue:failed` length 0. |
| P2-1 | `pm2-samyoj` started with a real pid file. `pm2 save` after this deploy | `systemctl is-active` | **pm2-samyoj: active**. Health recovered after the earlier `pm2 kill`. No reboot drill (that would take the site down). |
| P2-2 | Nginx `limit_req` 20 r/s on `/api/`, 50 r/s on the webhook, 40 r/s on the site, burst allowed. `server_tokens off` | `nginx -t`, reload, 70 rapid `/api` calls, public health still 200 | 62 served, 8 returned 429. Health stayed 200. Webhook challenge still returned `ping`. |
| P2-3 | Temporary audit SSH key removed and security-group port 22 from `20.192.21.56/32` revoked after the other fixes | SSM still answers; new SSH to port 22 does not | See the close-out note at the bottom. 80/443 stay open. |
| P2-4 | SPA fallback answers HEAD | `HEAD https://app.samyoj.com/login` | HTTP/2 200 |
| P3-1 | Malformed JSON is 400 `INVALID_JSON`; oversize JSON is 413 | Vitest; `POST /.env` with `0x%5B%5D=DTAB` on the public host | 400 `INVALID_JSON` |
| P3-2 | A signed media URL past `exp` returns 403 `MEDIA_URL_EXPIRED` | Vitest public media route | Passed. The gallery does not auto-regenerate on that 403. An `<img>` cannot read the JSON, and regenerating would spend image credits. Left as a manual regenerate. |
| P3-3 | `gzip_types` for JS/CSS/JSON, HTTP/2, hashed `/assets/` cached immutable for one year | Public fetch of `index-kF6yC2du.js` | `content-encoding: gzip`, `cache-control: public, max-age=31536000, immutable`, HTTP/2 200 |
| P3-4 | 2 GB `/swapfile` in fstab; `pm2-logrotate` max 50M, retain 14, compress | `swapon --show`; PM2 module online | Swap 2G, 0 used. Module online. |
| P3-5 | Same rate limit as P2-2 | Same burst | Scanner-speed bursts now 429. Access-log filtering was not added; the http-level log still records 404s. |
| P3-6 | Forgot-password screen says mail was not delivered when `smtpConfigured` is false. GST invoices already stay unissued without supplier GSTIN | Client build includes the page. No SMTP password was invented | Shipped in `client/dist`. Production SMTP and GST fields are still unset on purpose. |
| P3-7 | Campaign quota day is 00:00 Asia/Kolkata, not UTC midnight | `businessDayStart` boundary test: 18:30 UTC rolls the day | Passed. Analytics “today” still uses the host clock (UTC on this box). |
| P3-8 | `BUILD_INFO` next to the server process; `/health` adds `commit` when the line is a SHA | Vitest; public `/health` | `commit` is `876daec6377f9b8551fd8a6900362801c3fcbdf4`, workers true, db and redis ok. No env values in the body. |

## Self-score

**8 / 10.** The durability, dead-number, webhook, rate-limit, HEAD, JSON, gzip, swap, and health-commit items are on the box and were exercised. Points held back: no reboot test of `pm2-samyoj`, analytics day buckets are still UTC, expired studio images are not auto-refetched, and the health SHA is the base commit rather than a commit that contains this patch.

## Close-out

After the checks above, the audit public key was removed and the security group no longer has port 22 (only 80 and 443). A new SSH connection to `3.108.25.94:22` timed out. Session Manager then reported `pm2-samyoj` active, `/health` ok, swap 2G, and zero failed webhook jobs. The local private key file was deleted.
