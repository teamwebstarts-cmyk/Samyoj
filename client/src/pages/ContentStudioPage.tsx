import PageShell from '../components/ui/PageShell';
import AiStudio from '../components/ai-studio/AiStudio';

/**
 * AI Studio — creation desk (IDEA → BRIEF → GENERATE → REVIEW → EDIT → SAVE → HAND-OFF).
 * Fully client-side with mock data; the app's sidebar/topbar stay untouched.
 */
export default function ContentStudioPage() {
  return (
    <PageShell>
      <AiStudio />
    </PageShell>
  );
}
