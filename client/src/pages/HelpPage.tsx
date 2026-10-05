import PageShell from '../components/ui/PageShell';
import SupportAssistantShell from '../components/support/SupportAssistantShell';

export default function HelpPage() {
  return (
    <PageShell list>
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-theme-border bg-theme-surface">
        <SupportAssistantShell active variant="page" />
      </div>
    </PageShell>
  );
}
