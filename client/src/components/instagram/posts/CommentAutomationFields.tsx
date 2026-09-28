import { Link2, MessageCircle, MessageSquare, Send } from 'lucide-react';

const KEYWORD_SUGGESTIONS = ['PRICE', 'LINK', 'OFFER', 'DETAILS', 'YES'] as const;

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
}: CommentAutomationFieldsProps) {
  const keywordId = `${idPrefix}-keyword`;
  const publicId = `${idPrefix}-public`;
  const dmId = `${idPrefix}-dm`;
  const kw = keyword.trim();
  const hasPublic = Boolean(publicReply.trim());
  const hasDm = Boolean(dm.trim());

  const applySuggestion = (word: string) => {
    if (disabled) return;
    onKeywordChange(word);
  };

  return (
    <div className={`igp-auto-fields ${compact ? 'igp-auto-fields--compact' : ''}`}>
      <div className="igp-auto-fields__flow" aria-hidden={compact}>
        <div className="igp-auto-fields__flow-step">
          <span className="igp-auto-fields__flow-ico">
            <MessageSquare className="h-3.5 w-3.5" />
          </span>
          <span>Comment matches keyword</span>
        </div>
        <span className="igp-auto-fields__flow-arrow" />
        <div className="igp-auto-fields__flow-step">
          <span className="igp-auto-fields__flow-ico igp-auto-fields__flow-ico--green">
            <Send className="h-3.5 w-3.5" />
          </span>
          <span>Public reply (optional)</span>
        </div>
        <span className="igp-auto-fields__flow-arrow" />
        <div className="igp-auto-fields__flow-step">
          <span className="igp-auto-fields__flow-ico igp-auto-fields__flow-ico--violet">
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
          <span>Private DM (optional)</span>
        </div>
      </div>

      <div className={`igp-field ${keywordError ? 'igp-field--error' : ''}`}>
        <label htmlFor={keywordId}>
          Trigger keyword <span>word in their comment</span>
        </label>
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
          <span className="igp-field__error">Add the word to match in comments.</span>
        ) : (
          <p className="igp-field__hint">Case-insensitive · matches whole word (e.g. “price” in “What’s the price?”)</p>
        )}
      </div>

      <div className="igp-auto-fields__responses">
        <div className={`igp-auto-fields__card ${replyError ? 'igp-auto-fields__card--error' : ''}`}>
          <label className="igp-auto-fields__card-head" htmlFor={publicId}>
            <Send className="h-3.5 w-3.5 text-[var(--igp-green)]" aria-hidden />
            <strong>Public reply</strong>
            <span>Visible under their comment</span>
          </label>
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
          <label className="igp-auto-fields__card-head" htmlFor={dmId}>
            <Link2 className="h-3.5 w-3.5 text-[var(--igp-violet)]" aria-hidden />
            <strong>Private DM</strong>
            <span>Only the commenter · links & offers OK</span>
          </label>
          <textarea
            id={dmId}
            name={dmId}
            rows={3}
            autoComplete="off"
            value={dm}
            disabled={disabled}
            placeholder="Hi! Here’s the price list: https://…"
            onChange={(event) => onDmChange(event.target.value)}
          />
          <p className="igp-field__hint">
            Sent via Instagram’s private reply (within 7 days of their comment). One DM per commenter per post.
          </p>
        </div>
      </div>

      {replyError ? (
        <span className="igp-field__error">Add a public reply, a private DM, or both.</span>
      ) : null}

      <div className="igp-auto-live" aria-live="polite">
        <p className="igp-auto-live__label">Preview</p>
        <ol className="igp-auto-live__list">
          <li>
            Someone comments <em>{kw ? `“…${kw}…”` : 'with your keyword'}</em> on this post
          </li>
          {hasPublic ? (
            <li>
              Samyoj posts publicly: <span className="igp-auto-live__quote">{publicReply.trim()}</span>
            </li>
          ) : (
            <li className="igp-auto-live__muted">No public reply (skip if you only use DM)</li>
          )}
          {hasDm ? (
            <li>
              Samyoj sends a private DM: <span className="igp-auto-live__quote">{dm.trim()}</span>
            </li>
          ) : (
            <li className="igp-auto-live__muted">No private DM (skip if public reply is enough)</li>
          )}
        </ol>
      </div>
    </div>
  );
}
