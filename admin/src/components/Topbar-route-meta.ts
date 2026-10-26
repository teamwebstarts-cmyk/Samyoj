/**
 * Pure wayfinding meta for the admin Topbar — split out of the component so
 * the page-tracking logic stays testable without React.
 */

/** Per-nav-root meta — titles mirror the in-page PageHeaders. */
export const ROOT_META: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Overview', sub: 'Ecosystem telemetry & account health triage' },
  '/accounts': { title: 'Organizations', sub: 'Tenant workspaces, lifecycle & access' },
  '/billing': { title: 'Billing', sub: 'Subscription tiers, quotas & pricing catalog' },
  '/library': { title: 'Templates', sub: 'Catalog templates shared to tenant libraries' },
  '/errors': { title: 'Meta Telemetry', sub: 'Cloud API error codes across connected numbers' },
  '/outreach': { title: 'Email Outreach', sub: 'Lifecycle nurture queues for owner emails' },
  '/operators': { title: 'Staff & Access', sub: 'Operator identities, RBAC & sessions' },
  '/audit': { title: 'Audit', sub: 'Immutable ledger of platform mutations' },
};

export type TopbarMeta = {
  rootTo: string | null;
  root: string;
  title: string;
  sub: string;
  detail: string | null;
};

/** Active-page meta — special-cases wizard/detail suffixes over the nav root. */
export function routeMetaForTest(pathname: string): TopbarMeta {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'library' && segments[1] === 'new') {
    return { rootTo: '/library', root: 'Templates', title: 'New template', sub: 'Draft a platform catalog template', detail: null };
  }
  if (segments[0] === 'library' && segments.length > 1) {
    return { rootTo: '/library', root: 'Templates', title: 'Edit template', sub: 'Update an existing catalog template', detail: segments[1] };
  }
  if (segments[0] === 'accounts' && segments.length > 1) {
    return { rootTo: '/accounts', root: 'Organizations', title: 'Account', sub: 'Organization detail · telemetry, flags & billing', detail: segments[1] };
  }
  const meta = ROOT_META[pathname] ?? { title: 'Console', sub: 'Samyoj platform operations' };
  return { rootTo: null, root: '', title: meta.title, sub: meta.sub, detail: null };
}
