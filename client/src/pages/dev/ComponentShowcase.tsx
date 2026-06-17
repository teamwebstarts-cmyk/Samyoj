import AppAlert from '../../components/ui/AppAlert';
import AppButton from '../../components/ui/AppButton';
import AppInput from '../../components/ui/AppInput';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';
import PageShell from '../../components/ui/PageShell';
import ProgressBar from '../../components/ui/ProgressBar';
import SegmentedControl from '../../components/ui/SegmentedControl';
import StatusBadge from '../../components/ui/StatusBadge';
import { MessageSquare, Send } from 'lucide-react';
import { useState } from 'react';

export default function ComponentShowcase() {
  const [tab, setTab] = useState('a');
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <PageShell>
      <h1 className="text-display mb-2">Component Showcase</h1>
      <p className="text-body mb-8 text-theme-secondary">Dev-only catalog of shared UI primitives.</p>

      <div className="gap-section flex flex-col">
        <section className="space-y-3">
          <h2 className="text-title">Buttons & inputs</h2>
          <div className="flex flex-wrap gap-2">
            <AppButton>Primary</AppButton>
            <AppButton variant="secondary">Secondary</AppButton>
            <AppButton variant="ghost">Ghost</AppButton>
            <AppButton variant="danger">Danger</AppButton>
          </div>
          <AppInput label="Sample input" placeholder="Type here" />
        </section>

        <section className="space-y-3">
          <h2 className="text-title">Feedback</h2>
          <AppAlert variant="info">System message example for info alerts.</AppAlert>
          <LoadingState label="Loading example" className="py-8" />
          <ProgressBar value={65} label="Setup progress" />
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="APPROVED" />
            <StatusBadge status="RUNNING" />
            <StatusBadge status="FAILED" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-title">Controls</h2>
          <SegmentedControl
            value={tab}
            onChange={setTab}
            options={[
              { value: 'a', label: 'Option A', shortLabel: 'A' },
              { value: 'b', label: 'Option B', shortLabel: 'B' },
            ]}
          />
          <AppButton variant="secondary" onClick={() => setConfirmOpen(true)}>
            Open confirm dialog
          </AppButton>
        </section>

        <EmptyState
          icon={MessageSquare}
          title="Empty state"
          description="Used when lists have no items."
          action={<AppButton icon={<Send size={14} />}>Primary action</AppButton>}
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Example confirmation"
        description="This dialog traps focus and supports keyboard dismissal."
        confirmLabel="Got it"
      />
    </PageShell>
  );
}
