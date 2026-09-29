export const approvedReconciliationMigrations = [
  '20260814013000_reconcile_whatsapp_schema',
  '20260814130000_scope_conversation_charges_by_phone',
] as const;

export const historicalDestructiveMigration = '20260808120000_unique_whatsapp_phone_number_id';

const instagramPostsRebuildMigrations = [
  '20260927190000_drop_instagram_posts',
  '20260928130500_instagram_posts_restore',
] as const;

/** The drop is safe only when its immediately-following restore is also pending. */
export function hasApprovedInstagramPostsRebuild(pending: readonly string[]): boolean {
  const dropIndex = pending.indexOf(instagramPostsRebuildMigrations[0]);
  const restoreIndex = pending.indexOf(instagramPostsRebuildMigrations[1]);
  return dropIndex >= 0 && restoreIndex > dropIndex;
}
