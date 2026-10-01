import { Link2, MessageCircle, MessageSquare, Send } from 'lucide-react';
import InfoTip from '../../ui/InfoTip';

const KEYWORD_SUGGESTIONS = ['PRICE', 'LINK', 'OFFER', 'DETAILS', 'YES'] as const;

const KEYWORD_MATCH_TIP =
  'Matches whole words only (not case-sensitive). “price” matches “What’s the price?” but not “priced”.';

const PRIVATE_DM_TIP =
  'Instagram allows one private reply per commenter, within 7 days of their comment. Use this for links or offers.';

export type CommentAutomationFieldsProps = {
  idPrefix: string;
  keyword: string;
  onKeywordChange: (value: string) => void;
  publicReply: string;
  onPublicReplyChange: (value: string) => void;
  dm: string;
  onDmChange: (value: string) => void;
  disabled?: boolean;
  keywordError?: boolean;
  replyError?: boolean;
  /** Shorter layout for the composer accordion */
  compact?: boolean;
  /** Hide the 3-step flow strip (post automation panel) */
  hideFlow?: boolean;
};

export default function CommentAutomationFields({
  idPrefix,
  keyword,
  onKeywordChange,
  publicReply,
  onPublicReplyChange,
  dm,
  onDmChange,
  disabled = false,
  keywordError = false,
  replyError = false,
  compact = false,
  hideFlow = false,
}: CommentAutomationFieldsProps) {
  const keywordId = `${idPrefix}-keyword`;
  const publicId = `${idPrefix}-public`;
  const dmId = `${idPrefix}-dm`;
  const kw = keyword.trim();
  const hasPublic = Boolean(publicReply.trim());
  const hasDm = Boolean(dm.trim());
  const showFlow = !compact && !hideFlow;

  const applySuggestion = (word: string) => {
    if (disabled) return;
    onKeywordChange(word);
  };

  return (
    <div className={`igp-auto-fields ${compact ? 'igp-auto-fields--compact' : ''}`}>
      {showFlow ? (
        <div className="igp-auto-fields__flow" aria-hidden={compact}>
          <div className="igp-auto-fields__flow-step">
            <span className="igp-auto-fields__flow-ico">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <span>Keyword in comment</span>
          </div>
          <span className="igp-auto-fields__flow-arrow" />
          <div className="igp-auto-fields__flow-step">
            <span className="igp-auto-fields__flow-ico igp-auto-fields__flow-ico--green">
              <Send className="h-3.5 w-3.5" />
            </span>
            <span>Comment reply (optional)</span>
          </div>
          <span className="igp-auto-fields__flow-arrow" />
          <div className="igp-auto-fields__flow-step">
            <span className="igp-auto-fields__flow-ico igp-auto-fields__flow-ico--violet">
              <MessageCircle className="h-3.5 w-3.5" />
            </span>
            <span>Private DM (optional)</span>
          </div>
        </div>
      ) : null}

      <div className={`igp-field ${keywordError ? 'igp-field--error' : ''}`}>
        <div className="igp-field__label-row">
          <label htmlFor={keywordId}>Trigger keyword</label>
          <InfoTip content={KEYWORD_MATCH_TIP} label="How keyword matching works" />
        </div>
        <input
          id={keywordId}
          name={keywordId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={keyword}
          disabled={disabled}
          placeholder="e.g. PRICE"
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        <div className="igp-keyword-chips" role="list" aria-label="Suggested keywords">
          {KEYWORD_SUGGESTIONS.map((word) => (
            <button
              key={word}
              type="button"
              role="listitem"
              className={`igp-keyword-chip ${kw.toUpperCase() === word ? 'igp-keyword-chip--on' : ''}`}
              disabled={disabled}
              onClick={() => applySuggestion(word)}
            >
              {word}
            </button>
          ))}
        </div>
        {keywordError ? (
          <span className="igp-field__error">Add a keyword to match in comments.</span>
        ) : null}
      </div>

      <div className="igp-auto-fields__responses">
        <div className={`igp-auto-fields__card ${replyError ? 'igp-auto-fields__card--error' : ''}`}>
          <div className="igp-auto-fields__card-head">
            <span className="igp-auto-fields__card-ico igp-auto-fields__card-ico--green" aria-hidden>
              <Send className="h-3.5 w-3.5 text-[var(--igp-green)]" />
            </span>
            <div className="igp-auto-fields__card-titles">
              <label htmlFor={publicId}>
                <strong>Comment reply</strong>
              </label>
              <span>Shown under their comment</span>
            </div>
          </div>
          <textarea
            id={publicId}
            name={publicId}
            rows={3}
            autoComplete="off"
            value={publicReply}
            disabled={disabled}
            placeholder="Thanks! Check your DMs for the link."
            onChange={(event) => onPublicReplyChange(event.target.value)}
          />
        </div>

        <div className={`igp-auto-fields__card ${replyError ? 'igp-auto-fields__card--error' : ''}`}>
          <div className="igp-auto-fields__card-head">
            <span className="igp-auto-fields__card-ico igp-auto-fields__card-ico--violet" aria-hidden>
              <Link2 className="h-3.5 w-3.5 text-[var(--igp-violet)]" />
            </span>
            <div className="igp-auto-fields__card-titles">
              <label htmlFor={dmId} className="igp-field__label-row igp-field__label-row--tight">
                <strong>Private DM</strong>
                <InfoTip content={PRIVATE_DM_TIP} label="Private reply rules" />
              </label>
              <span>Only the commenter sees this</span>
            </div>
          </div>
          <textarea
            id={dmId}
            name={dmId}
            rows={3}
            autoComplete="off"
            value={dm}
            disabled={disabled}
            placeholder="Hi! Here’s the link: https://…"
            onChange={(event) => onDmChange(event.target.value)}
          />
        </div>
      </div>

      {replyError ? (
        <span className="igp-field__error">Add a comment reply, a private DM, or both.</span>
      ) : null}

      <div className="igp-auto-live" aria-live="polite">
        <p className="igp-auto-live__label">Preview</p>
        <ol className="igp-auto-live__list">
          <li>
            Comment includes <em>{kw || 'your keyword'}</em>
          </li>
          {hasPublic ? (
            <li>
              Reply on post: <span className="igp-auto-live__quote">{publicReply.trim()}</span>
            </li>
          ) : (
            <li className="igp-auto-live__muted">No comment reply</li>
          )}
          {hasDm ? (
            <li>
              DM: <span className="igp-auto-live__quote">{dm.trim()}</span>
            </li>
          ) : (
            <li className="igp-auto-live__muted">No DM</li>
          )}
        </ol>
      </div>
    </div>
  );
}
