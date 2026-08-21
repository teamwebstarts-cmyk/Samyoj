import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import AppButton from '../../ui/AppButton';

interface FallbackQuery {
  query: string;
  count: number;
}

interface AiKnowledgeGapTableProps {
  queries: FallbackQuery[];
}

export default function AiKnowledgeGapTable({ queries }: AiKnowledgeGapTableProps) {
  const navigate = useNavigate();

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="border-b border-theme-border bg-theme-subtle/50 px-5 py-4">
        <h3 className="text-base font-extrabold tracking-tight text-theme-fg">
          AI Knowledge Gaps & Unrecognized Queries
        </h3>
        <p className="mt-0.5 text-[12px] font-medium text-theme-secondary">
          Customer questions that triggered fallback replies — add them to your bot FAQ to boost deflection
        </p>
      </div>

      <div className="divide-y divide-theme-border/60">
        {queries.map((item, index) => (
          <div
            key={item.query}
            className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-theme-subtle/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold">
                #{index + 1}
              </span>
              <div>
                <p className="text-[13px] font-bold text-theme-fg">{item.query}</p>
                <p className="text-[11px] font-medium text-theme-muted">
                  Asked <span className="font-bold text-amber-700 dark:text-amber-300">{item.count} times</span> by customers without automated resolution
                </p>
              </div>
            </div>

            <AppButton
              size="sm"
              variant="secondary"
              icon={<PlusCircle size={13} />}
              onClick={() => navigate('/ai-bot')}
            >
              Add to Knowledge Base
            </AppButton>
          </div>
        ))}
      </div>
    </div>
  );
}
