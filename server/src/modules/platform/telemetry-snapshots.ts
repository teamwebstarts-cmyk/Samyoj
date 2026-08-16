import {
  cleanupPlatformTelemetry,
  snapshotAllOrganizations,
  SNAPSHOT_RETENTION_DAYS as HEALTH_SNAPSHOT_RETENTION_DAYS,
  PRODUCT_EVENT_RETENTION_DAYS,
  META_ERROR_RETENTION_DAYS,
  activationStage,
  healthFlags,
  computeOrgHealthSnapshot,
  snapshotOrganization,
} from './snapshots';
export { utcDay } from './privacy';
export { AI_INACTIVE_DAYS, WEBHOOK_STALE_HOURS, BILLING_RISK_DAYS } from './stage';
export {
  activationStage,
  healthFlags,
  computeOrgHealthSnapshot,
  snapshotOrganization,
  snapshotAllOrganizations,
  cleanupPlatformTelemetry,
  HEALTH_SNAPSHOT_RETENTION_DAYS,
  PRODUCT_EVENT_RETENTION_DAYS,
  META_ERROR_RETENTION_DAYS,
};

export async function runPlatformTelemetryMaintenance(now = new Date()) {
  const snapshots = await snapshotAllOrganizations(now);
  const retention = await cleanupPlatformTelemetry(now);
  return { snapshots, retention };
}
