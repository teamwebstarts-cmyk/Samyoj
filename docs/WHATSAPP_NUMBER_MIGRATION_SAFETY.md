# WhatsApp Number Migration Safety

## Non-negotiable deployment procedure

The migration history contains an older applied migration,
`20260808120000_unique_whatsapp_phone_number_id`, whose SQL deleted duplicate
`whatsapp_numbers` rows. That history is retained honestly and cannot be made
safe for a clean install without rewriting history.

For this app:

1. Do not run raw `prisma migrate deploy`, `prisma migrate dev`, or `prisma db push`.
2. Create a backup first:

   ```bash
   cd server
   npm run db:backup
   ```

3. Run the preflight report:

   ```bash
   npm run db:preflight-number-isolation
   ```

   It writes `.run/reports/whatsapp-number-isolation-preflight.json`, blocks
   invalid/global duplicate identities, cross-organization/number links, and
   ambiguous campaign ownership.
4. `npm run db:migrate-safe` is intentionally fail-closed while the historical
   destructive migration remains in the chain. A migration operator must use a
   reviewed replacement chain for fresh installs, or explicitly recover the
   existing database from the backup and approved migration procedure.

For an existing database where the historical migration is already recorded as
applied, the narrowly scoped reconciliation command may be used. It requires
an explicit non-empty backup path, reruns preflight, verifies that the
historical migration is applied, confirms that the reconciliation migration is
the only pending migration, and then invokes Prisma deploy:

```bash
MIGRATION_BACKUP_FILE=/workspaces/Samyoj/.run/backups/<verified-dump>.dump \
  npm run db:migrate-reconciliation-safe
```

This command is not a general migration bypass and cannot be used for a clean
install or for an unexpected pending migration.

The current migration scripts added for isolation never delete number,
contact, conversation, ticket, campaign, call, lead, or order rows. Proven
duplicate number identities can be repaired with:

```bash
npm run db:repair-proven-number-duplicates
```

That command only rehomes dependents when duplicate rows share the same
`phone_number_id`, then preserves duplicate rows as inactive. Conflicting
identities are reported and block deployment.

## Recovery

Keep the custom-format dump created by `db:backup` with the deployment record.
If a migration fails, mark only the failed migration rolled back after
verifying the database transaction was rolled back, restore into a separate
database first, and validate with:

```bash
npm run db:validate-migration-chain
npm run db:preflight-number-isolation
npx prisma validate
npx prisma migrate status
```

Do not use `--force`, `--skip-generate`, or destructive reset commands to
recover production data.
