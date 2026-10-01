import { useState } from 'react';
import { AlertCircle, CheckCircle2, Info, MessageSquare, RefreshCw } from 'lucide-react';
import CommentAutomationFields from './CommentAutomationFields';

type AutomationTabProps = {
  /** igMediaId present — automation can be saved for this post. */
  ready: boolean;
  /** Draft/scheduled post — rule saves pending and activates on publish. */
  pendingOk: boolean;
  isRemote: boolean;
  isMock: boolean;
  canEdit: boolean;
  saving: boolean;
  keyword: string;
  onKeywordChange: (value: string) => void;
  publicReply: string;
  onPublicReplyChange: (value: string) => void;
  dm: string;
  onDmChange: (value: string) => void;
  autoId: string | null;
  /** Post row exists (draft saved at least once) — standalone Save is allowed. */
  postPersisted: boolean;
  onSave: () => void;
};

/**
 * Post-scoped comment automation only: keyword → public reply and/or private DM.
 */
export default function PostAutomationTab({
  ready,
  pendingOk,
  isRemote,
  isMock,
  canEdit,
  saving,
  keyword,
  onKeywordChange,
  publicReply,
  onPublicReplyChange,
  dm,
  onDmChange,
  autoId,
  postPersisted,
  onSave,
}: AutomationTabProps) {
  const [showErrors, setShowErrors] = useState(false);
  const keywordError = showErrors && !keyword.trim();
  const replyError = showErrors && !publicReply.trim() && !dm.trim();

  const handleSave = () => {
    if (!keyword.trim() || (!publicReply.trim() && !dm.trim())) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    onSave();
  };

  if (!ready && !pendingOk) {
    return (
      <div className="igp-auto__empty">
        <span className="igp-auto__emptyicon">
          <MessageSquare className="h-5 w-5" />
        </span>
        <strong>Comment automation unavailable</strong>
        <p>
          {isRemote
            ? 'Connect this post to your Instagram account.'
            : 'Open a draft or new post to set up keyword replies.'}
        </p>
      </div>
    );
  }

  return (
    <div className="igp-auto">
      <div className="igp-auto__head igp-auto__head--compact">
        <div className="flex flex-wrap items-center gap-2">
          <h3>Comment automation</h3>
          {autoId ? (
            <span
              className={`igp-autosummary__state ${
                ready ? 'igp-autosummary__state--on' : 'igp-autosummary__state--off'
              }`}
            >
              {ready ? 'Active' : 'On publish'}
            </span>
          ) : null}
        </div>
        {!ready && pendingOk ? (
          <p className="igp-auto__sub">Saved with the post · runs when it is live</p>
        ) : ready ? (
          <p className="igp-auto__sub">Keyword in a comment → reply and/or DM</p>
        ) : null}
      </div>

      <section className="igp-auto__card igp-auto__card--flat">
        {!canEdit ? (
          <p className="igp-readonly" style={{ marginBottom: 12 }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>View only — ask an admin to edit comment replies.</span>
          </p>
        ) : null}

        <CommentAutomationFields
          idPrefix="igp-auto"
          keyword={keyword}
          onKeywordChange={onKeywordChange}
          publicReply={publicReply}
          onPublicReplyChange={onPublicReplyChange}
          dm={dm}
          onDmChange={onDmChange}
          disabled={!canEdit || saving}
          keywordError={keywordError}
          replyError={replyError}
          hideFlow
        />

        {isMock ? (
          <p className="igp-tip igp-tip--compact">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--igp-amber)]" />
            <span>Sample post — create a real post to save this rule.</span>
          </p>
        ) : !postPersisted ? (
          <p className="igp-tip igp-tip--compact">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--igp-accent)]" />
            <span>Saves with Draft, Schedule, or Publish. Use Save below once the post exists.</span>
          </p>
        ) : null}
      </section>

      {canEdit && postPersisted ? (
        <button
          type="button"
          className="igp-btn igp-btn--primary"
          style={{ alignSelf: 'stretch' }}
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save automation
        </button>
      ) : null}
    </div>
  );
}
