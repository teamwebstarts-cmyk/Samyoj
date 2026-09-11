# Isolated restore checklist (Packet F)

Primary `DATABASE_URL` is never the restore target in this rehearsal. Off-host encrypt is later (Manual / ops).

1. `cd server && npm run db:backup` — writes `.run/backups/*.dump`.
2. Create a **second** empty database (`samyoj_restore_rehearsal`), not the live `whatsapp_platform` name.
3. Set `RESTORE_DATABASE_URL` to that second database. It must differ in host+port+name from `DATABASE_URL`.
4. Restore: `npx tsx scripts/restore-database.ts --isolated ../.run/backups/<file>.dump --yes`
5. Script **exits 1** if `RESTORE_DATABASE_URL` is missing or equals the primary DB.
6. Spot-check tenant/number rows **on the second DB only**. Drop the rehearsal DB when done.
7. Do **not** run raw `prisma migrate deploy` on a fresh host if it would apply the historical unique-phone DELETE. Use `npm run db:migrate-startup-safe`.
