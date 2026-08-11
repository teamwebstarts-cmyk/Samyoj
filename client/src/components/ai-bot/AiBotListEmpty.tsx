import {
  BotMessageSquare,
  BookOpen,
  FilterX,
  Plus,
  Power,
  SearchX,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import EmptyState from '../ui/EmptyState';

interface AiBotListEmptyProps {
  mode: 'new' | 'filter';
  hasSearch: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}

/** Empty body inside the bots list card — bare (no nested card/shadow). */
export default function AiBotListEmpty({
  mode,
  hasSearch,
  onCreate,
  onClearFilters,
}: AiBotListEmptyProps) {
  if (mode === 'new') {
    return (
      <EmptyState
        bare
        compact
        icon={BotMessageSquare}
        variant="default"
        title="No AI bots yet"
        description="Create a bot once — it can reply on WhatsApp day and night, and hand tricky chats to your team."
        stepsLabel="Get started"
        steps={[
          {
            label: 'Create a bot',
            description: 'Pick a name and personality',
            icon: Plus,
            onClick: onCreate,
          },
          {
            label: 'Add FAQs',
            description: 'Teach it your business answers',
            icon: BookOpen,
          },
          {
            label: 'Turn it on',
            description: 'Set as default to reply to all chats',
            icon: Power,
          },
        ]}
        action={
          <AppButton icon={<Plus size={16} />} onClick={onCreate}>
            Create bot
          </AppButton>
        }
        hint="You can pause AI for one customer from Inbox anytime"
      />
    );
  }

  return (
    <EmptyState
      bare
      compact
      icon={hasSearch ? SearchX : FilterX}
      variant="filter"
      title={hasSearch ? 'No bots match your search' : 'No bots for this filter'}
      description={
        hasSearch
          ? 'Try another name, or clear search and filters to see all bots.'
          : 'Nothing in this status right now. Switch filter or clear it to see every bot.'
      }
      action={
        <AppButton variant="secondary" icon={<FilterX size={16} />} onClick={onClearFilters}>
          Clear filters
        </AppButton>
      }
    />
  );
}
