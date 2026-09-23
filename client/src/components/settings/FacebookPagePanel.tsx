import { Link } from 'react-router-dom';
import { Facebook, LogOut, Plus, CheckCircle2 } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import { SettingsTabSkeleton } from './SettingsSkeleton';

export type FacebookPageSummary = {
  channelId: string;
  pageId: string;
  name: string;
};

interface FacebookPagePanelProps {
  page: FacebookPageSummary | null;
  loading?: boolean;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  canEdit: boolean;
}

/** Settings card cloned from WhatsApp numbers — Connect Page only. No App ID/Secret. */
export default function FacebookPagePanel({
  page,
  loading = false,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
  canEdit,
}: FacebookPagePanelProps) {
  if (loading) return <SettingsTabSkeleton variant="compact" />;

  return (
    <div className="space-y-4">
      <p className="text-[13px] font-medium text-theme-secondary">
        Instant Forms from Ads Manager become CRM leads.{' '}
        <Link
          to="/contacts?tab=pipeline&source=META_ADS"
          className="font-semibold text-[#1877F2] hover:underline"
        >
          Facebook → Leads →
        </Link>
      </p>
      <SettingsPanel
        title="Facebook Page"
        description="Connect a Page to receive Instant Form leads."
        icon={Facebook}
        footer={
          page ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-theme-muted">1 connected</p>
              {canEdit ? (
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={onConnect}
                  disabled={connecting}
                  loading={connecting}
                >
                  Connect Page
                </AppButton>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {page ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200/70 bg-gradient-to-r from-sky-50/80 via-[#1877F2]/[0.04] to-theme-surface px-3.5 py-3 ring-1 ring-sky-100/80 dark:border-sky-900/40 dark:from-sky-950/25 dark:ring-sky-900/30">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1877F2] text-white">
                <Facebook className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-[14px] text-theme-fg">{page.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  Connected
                </p>
              </div>
            </div>
            <AppButton
              variant="danger"
              size="sm"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={onDisconnect}
              loading={disconnecting}
              disabled={disconnecting || !canEdit}
              className="shrink-0"
            >
              Disconnect
            </AppButton>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#1877F2]/30 bg-gradient-to-b from-[#1877F2]/[0.05] to-transparent px-4 py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#1877F2] text-white">
              <Facebook className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <p className="mt-3 text-[14px] font-semibold text-theme-fg">Connect a Page to receive Instant Form leads.</p>
            <p className="mt-1 text-[12px] text-theme-secondary">
              Sign in with Facebook and pick your Page. No App ID in Settings.
            </p>
            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <AppButton
                onClick={onConnect}
                disabled={connecting || !canEdit}
                loading={connecting}
                icon={<Plus className="h-4 w-4" />}
              >
                Connect Page
              </AppButton>
            </div>
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}
