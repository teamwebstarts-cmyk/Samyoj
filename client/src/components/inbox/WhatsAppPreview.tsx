import { AlertCircle, Check, CheckCheck, ClipboardCopy, Clock, ExternalLink, List, Phone } from 'lucide-react';
import type { ReactNode } from 'react';

/** Split-pane preview column for inbox composers (Template / Interactive). */
export function ComposerPreviewPane({
  subtitle,
  children,
  className = '',
}: {
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-theme-border/60 bg-theme-surface/80 px-3 py-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-theme-muted">Preview</p>
        <p className="truncate text-[10px] font-medium text-theme-muted">{subtitle}</p>
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-end overflow-y-auto overscroll-contain p-3 wa-chat-surface wa-chat-surface-compact">
        {children}
      </div>
    </div>
  );
}
import type { MessageTemplate, TemplateButton, TemplateLibraryEntry } from '../../types';
import { getTemplateButtons } from '../../utils/templateForm';

export type WhatsAppBubbleDirection = 'inbound' | 'outbound';

type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export function StatusIcon({ status, compact }: { status?: MessageStatus; compact?: boolean }) {
  const size = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';

  if (status === 'failed') {
    return <AlertCircle className={`${size} text-red-500`} strokeWidth={2.5} />;
  }
  if (status === 'pending') {
    return <Clock className={`${size} wa-tick`} strokeWidth={2.5} />;
  }
  if (status === 'read') {
    return <CheckCheck className={`${size} wa-tick-read`} strokeWidth={2.5} />;
  }
  if (status === 'delivered') {
    return <CheckCheck className={`${size} wa-tick`} strokeWidth={2.5} />;
  }
  return <Check className={`${size} wa-tick`} strokeWidth={2.5} />;
}

interface WhatsAppBubbleProps {
  direction?: WhatsAppBubbleDirection;
  content?: string;
  children?: ReactNode;
  header?: string;
  footer?: string;
  time?: string;
  status?: MessageStatus;
  compact?: boolean;
  className?: string;
  mediaClassName?: string;
}

/** Session message bubble (green outbound / white inbound). */
export function WhatsAppBubble({
  direction = 'outbound',
  content,
  children,
  header,
  footer,
  time = '12:30',
  status = 'delivered',
  compact = false,
  className = '',
  mediaClassName = '',
}: WhatsAppBubbleProps) {
  const isOutbound = direction === 'outbound';
  const isFailed = status === 'failed';
  const metaSize = compact ? 'text-[9px]' : 'text-[11px]';
  const hasMedia = Boolean(children);

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} ${className}`}>
      <div
        className={`relative max-w-full shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] wa-msg-font ${
          compact ? 'max-w-[220px]' : 'max-w-[85%] sm:max-w-[75%]'
        } ${
          hasMedia ? 'overflow-hidden p-0' : compact ? 'px-2 py-1.5' : 'px-3 py-2'
        } ${
          isOutbound
            ? isFailed
              ? 'rounded-lg rounded-br-[2px] wa-bubble-failed'
              : 'rounded-lg rounded-br-[2px] wa-bubble-sent'
            : 'rounded-lg rounded-bl-[2px] wa-bubble-received'
        }`}
      >
        {hasMedia && <div className={mediaClassName}>{children}</div>}

        {(header || content || footer) && (
          <div className={hasMedia ? 'px-3 py-2' : ''}>
            {header && (
              <p className={`mb-1 font-semibold leading-snug ${compact ? 'text-[11px]' : 'text-[14px]'}`}>
                {header}
              </p>
            )}

            {content && (
              <p className={`whitespace-pre-wrap break-words ${compact ? 'text-[11px] leading-[1.35]' : 'wa-msg-body'}`}>
                {content}
              </p>
            )}

            {footer && (
              <p className={`mt-1 leading-snug wa-timestamp ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
                {footer}
              </p>
            )}
          </div>
        )}

        {!hasMedia && !content && !header && !footer && children}

        <div className={`flex items-end justify-end gap-1 ${hasMedia ? 'px-3 pb-2' : 'mt-0.5'}`}>
          <span className={`${metaSize} font-normal tabular-nums wa-timestamp`}>{time}</span>
          {isOutbound && <StatusIcon status={status} compact={compact} />}
        </div>
      </div>
    </div>
  );
}

interface WhatsAppChatSurfaceProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export function WhatsAppChatSurface({
  children,
  className = '',
  compact = false,
}: WhatsAppChatSurfaceProps) {
  return (
    <div
      className={`wa-chat-surface ${compact ? 'wa-chat-surface-compact' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

function ButtonIcon({ type }: { type: string }) {
  if (type === 'URL') return <ExternalLink className="h-3.5 w-3.5 wa-accent-text" strokeWidth={2.25} />;
  if (type === 'PHONE_NUMBER') return <Phone className="h-3.5 w-3.5 wa-accent-text" strokeWidth={2.25} />;
  return null;
}

function MediaHeaderPlaceholder({ format, compact }: { format: string; compact?: boolean }) {
  const label =
    format === 'VIDEO' ? 'Video header' : format === 'DOCUMENT' ? 'Document header' : 'Image header';
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200/80 text-neutral-500 ${
        compact ? 'h-28' : 'h-36'
      }`}
    >
      <span className={`font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{label}</span>
    </div>
  );
}

/** WhatsApp template message card (outbound green / inbound white + stacked action buttons). */
export function WhatsAppTemplateCard({
  header,
  headerFormat,
  headerMediaUrl,
  body,
  footer,
  buttons = [],
  compact = false,
  className = '',
  time = '12:30',
  direction = 'outbound',
  status = 'delivered',
}: {
  header?: string;
  headerFormat?: string;
  headerMediaUrl?: string;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  compact?: boolean;
  className?: string;
  time?: string;
  direction?: WhatsAppBubbleDirection;
  status?: MessageStatus;
}) {
  const isOutbound = direction === 'outbound';
  const hasMediaHeader =
    headerFormat && headerFormat !== 'TEXT' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat);
  const shellClass = isOutbound ? 'wa-bubble-sent' : 'wa-bubble-received';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} ${className}`}>
      <div
        className={`overflow-hidden rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] wa-msg-font ${
          isOutbound ? 'rounded-br-[2px]' : 'rounded-bl-[2px]'
        } ${shellClass} ${compact ? 'w-full max-w-[280px]' : 'w-full max-w-[min(100%,340px)]'}`}
      >
        {hasMediaHeader && (
          headerMediaUrl && headerFormat === 'IMAGE' ? (
            <img src={headerMediaUrl} alt="" className={`w-full object-cover ${compact ? 'h-28' : 'h-36'}`} />
          ) : (
            <MediaHeaderPlaceholder format={headerFormat!} compact={compact} />
          )
        )}

        <div className={compact ? 'px-2.5 pt-2.5 pb-1' : 'px-3.5 pt-3 pb-1.5'}>
          {header && (
            <p
              className={`font-semibold leading-snug ${
                compact ? 'text-[13px]' : 'text-[15px]'
              }`}
            >
              {header}
            </p>
          )}
          <p
            className={`whitespace-pre-wrap break-words ${
              compact ? 'text-[12.5px] leading-[1.45]' : 'wa-msg-body'
            } ${header ? 'mt-1' : ''}`}
          >
            {body}
          </p>
          {footer && (
            <p
              className={`mt-2 leading-snug wa-timestamp ${
                compact ? 'text-[10px]' : 'text-[12px]'
              }`}
            >
              {footer}
            </p>
          )}
        </div>

        {buttons.length > 0 && (
          <div className="border-t border-[color:var(--wa-bubble-edge)]">
            {buttons.map((btn, i) => (
              <button
                key={`${btn.type}-${btn.text}-${i}`}
                type="button"
                className={`wa-bubble-action flex w-full items-center justify-center gap-2 border-b py-3 transition last:border-b-0 ${shellClass} ${
                  compact ? 'py-2.5 text-[13px]' : 'text-[14px] font-medium'
                }`}
              >
                <ButtonIcon type={btn.type} />
                <span>{btn.text || btn.type}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`flex items-end justify-end gap-1 ${compact ? 'px-2 pb-1.5 pt-0.5' : 'px-3 pb-2 pt-0.5'}`}>
          <span className={`tabular-nums wa-timestamp ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
            {time}
          </span>
          {isOutbound && <StatusIcon status={status} compact={compact} />}
        </div>
      </div>
    </div>
  );
}

interface WhatsAppMessagePreviewProps {
  content: string;
  direction?: WhatsAppBubbleDirection;
  header?: string;
  footer?: string;
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
  showSurface?: boolean;
  status?: MessageStatus;
}

export function WhatsAppMessagePreview({
  content,
  direction = 'outbound',
  header,
  footer,
  variant = 'default',
  className = '',
  showSurface = true,
  status = 'delivered',
}: WhatsAppMessagePreviewProps) {
  if (!content || content === '—') {
    return <span className="text-[13px] text-neutral-400">—</span>;
  }

  const compact = variant === 'compact' || variant === 'inline';
  const bubble = (
    <WhatsAppBubble
      direction={direction}
      content={content}
      header={header}
      footer={footer}
      compact={compact}
      status={status}
    />
  );

  if (variant === 'inline') {
    return (
      <div className={`overflow-hidden ${className}`}>
        <WhatsAppChatSurface compact>{bubble}</WhatsAppChatSurface>
      </div>
    );
  }

  if (!showSurface) return <div className={className}>{bubble}</div>;

  return (
    <WhatsAppChatSurface compact={compact} className={className}>
      {bubble}
    </WhatsAppChatSurface>
  );
}

export function getTemplateParts(template: MessageTemplate | TemplateLibraryEntry) {
  const components = 'components' in template ? template.components ?? [] : [];
  const headerComponent = components.find((c) => c.type === 'HEADER') as
    | { text?: string; format?: string }
    | undefined;
  const header =
    template.header ?? headerComponent?.text;
  const headerFormat = headerComponent?.format?.toUpperCase();
  let bodyText =
    template.body?.trim() ?? components.find((c) => c.type === 'BODY')?.text?.trim();
  const footer =
    template.footer ?? components.find((c) => c.type === 'FOOTER')?.text;

  if (bodyText && 'body_params' in template && template.body_params?.length) {
    template.body_params.forEach((param, index) => {
      bodyText = bodyText!.replace(`{{${index + 1}}}`, param);
    });
  }

  return {
    header,
    headerFormat,
    body: bodyText || '—',
    footer,
    buttons: getTemplateButtons(template),
    category: template.category,
  };
}

interface WhatsAppTemplatePreviewProps {
  header?: string;
  headerFormat?: string;
  headerMediaUrl?: string;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
  direction?: WhatsAppBubbleDirection;
  status?: MessageStatus;
  showSurface?: boolean;
}

export function WhatsAppTemplatePreview({
  header,
  headerFormat,
  headerMediaUrl,
  body,
  footer,
  buttons = [],
  variant = 'default',
  className = '',
  direction = 'outbound',
  status = 'delivered',
  showSurface = true,
}: WhatsAppTemplatePreviewProps) {
  const compact = variant === 'compact' || variant === 'inline';

  const card = (
    <WhatsAppTemplateCard
      header={header}
      headerFormat={headerFormat}
      headerMediaUrl={headerMediaUrl}
      body={body}
      footer={footer}
      buttons={buttons}
      compact={compact}
      direction={direction}
      status={status}
    />
  );

  if (!showSurface) return <div className={className}>{card}</div>;

  return (
    <WhatsAppChatSurface compact={compact} className={className}>
      {card}
    </WhatsAppChatSurface>
  );
}

export type InteractivePreviewMode = 'reply' | 'cta_url' | 'cta_call' | 'list' | 'copy_code';

export interface WhatsAppInteractivePreviewProps {
  mode: InteractivePreviewMode;
  header?: string;
  body: string;
  footer?: string;
  buttons?: Array<{ id: string; title: string }>;
  ctaLabel?: string;
  listButtonLabel?: string;
  listSections?: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  couponCode?: string;
  direction?: WhatsAppBubbleDirection;
  compact?: boolean;
  className?: string;
  time?: string;
  status?: MessageStatus;
  showSurface?: boolean;
}

function InteractiveActionButton({
  label,
  icon,
  compact,
  variant = 'session',
}: {
  label: string;
  icon?: ReactNode;
  compact?: boolean;
  variant?: 'session' | 'template';
}) {
  const sessionStyles =
    'border-[#c5e8c0] bg-[#d9fdd3] text-[#008069]';
  const templateStyles =
    'border-[#e9edef] bg-white text-[#008069]';

  return (
    <div
      className={`flex w-full items-center justify-center gap-2 border-t py-2.5 font-medium ${
        variant === 'template' ? templateStyles : sessionStyles
      } ${compact ? 'text-[13px]' : 'text-[14px]'}`}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

/** Session interactive message card (reply buttons, CTA, list menu). */
export function WhatsAppInteractiveCard({
  mode,
  header,
  body,
  footer,
  buttons = [],
  ctaLabel,
  listButtonLabel,
  listSections = [],
  couponCode,
  direction = 'outbound',
  compact = false,
  time = '12:30',
  status = 'delivered',
}: Omit<WhatsAppInteractivePreviewProps, 'className' | 'showSurface'>) {
  const isOutbound = direction === 'outbound';
  const shellClass = isOutbound ? 'bg-[#d9fdd3]' : 'bg-white';

  if (mode === 'copy_code') {
    return (
      <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`overflow-hidden rounded-lg bg-white text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
            compact ? 'w-full max-w-[280px]' : 'w-full max-w-[min(100%,340px)]'
          }`}
        >
          <div className={compact ? 'px-2.5 pt-2.5 pb-1' : 'px-3.5 pt-3 pb-1.5'}>
            {header && (
              <p className={`font-semibold leading-snug ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
                {header}
              </p>
            )}
            <p
              className={`whitespace-pre-wrap break-words leading-[1.45] ${
                compact ? 'text-[12.5px]' : 'text-[14.5px]'
              } ${header ? 'mt-1' : ''}`}
            >
              {body}
            </p>
            {footer && (
              <p className={`mt-2 leading-snug text-[#8696a0] ${compact ? 'text-[10px]' : 'text-[12px]'}`}>
                {footer}
              </p>
            )}
          </div>
          <InteractiveActionButton
            label={couponCode ? `Copy code ${couponCode}` : 'Copy code'}
            icon={<ClipboardCopy className="h-3.5 w-3.5" strokeWidth={2.25} />}
            compact={compact}
            variant="template"
          />
          <div className={`flex justify-end gap-1 ${compact ? 'px-2 pb-1.5 pt-0.5' : 'px-3 pb-2 pt-0.5'}`}>
            <span className={`tabular-nums text-[#667781] ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
              {time}
            </span>
            {isOutbound && <StatusIcon status={status} compact={compact} />}
          </div>
        </div>
      </div>
    );
  }

  const ctaIcon =
    mode === 'cta_call' ? (
      <Phone className="h-3.5 w-3.5" strokeWidth={2.25} />
    ) : mode === 'cta_url' ? (
      <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.25} />
    ) : mode === 'list' ? (
      <List className="h-3.5 w-3.5" strokeWidth={2.25} />
    ) : null;

  const actionButtons =
    mode === 'reply'
      ? buttons
      : mode === 'cta_url' || mode === 'cta_call'
        ? [{ id: 'cta', title: ctaLabel || (mode === 'cta_call' ? 'Call us' : 'Open link') }]
        : mode === 'list'
          ? [{ id: 'list', title: listButtonLabel || 'Menu' }]
          : [];

  const totalRows = listSections.reduce((sum, section) => sum + section.rows.length, 0);

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`overflow-hidden rounded-lg shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          compact ? 'max-w-[280px]' : 'max-w-[min(100%,340px)]'
        } ${isOutbound ? 'rounded-br-[2px]' : 'rounded-bl-[2px]'}`}
      >
        <div className={`${compact ? 'px-2.5 pt-2.5 pb-1' : 'px-3.5 pt-3 pb-1.5'} ${shellClass}`}>
          {header && (
            <p className={`mb-1 font-semibold leading-snug ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
              {header}
            </p>
          )}
          <p
            className={`whitespace-pre-wrap break-words leading-[1.45] text-[#111b21] ${
              compact ? 'text-[12.5px]' : 'text-[14.5px]'
            }`}
          >
            {body}
          </p>
          {footer && (
            <p className={`mt-2 leading-snug text-[#8696a0] ${compact ? 'text-[10px]' : 'text-[12px]'}`}>
              {footer}
            </p>
          )}
          {mode === 'list' && totalRows > 0 && (
            <div className={`mt-2 rounded-lg border border-[#e9edef] bg-white/80 p-2 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
              <p className="mb-1 font-semibold text-[#667781]">List preview</p>
              {listSections.map((section, sectionIndex) => (
                <div key={sectionIndex} className={sectionIndex > 0 ? 'mt-2 border-t border-[#e9edef] pt-2' : ''}>
                  {section.title && (
                    <p className="font-semibold text-[#111b21]">{section.title}</p>
                  )}
                  {section.rows.map((row) => (
                    <div key={row.id} className="mt-1">
                      <p className="font-medium text-[#111b21]">{row.title}</p>
                      {row.description && (
                        <p className="text-[#667781]">{row.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className={`flex justify-end gap-1 ${compact ? 'pt-0.5' : 'pt-0.5'}`}>
            <span className={`tabular-nums text-[#667781] ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
              {time}
            </span>
            {isOutbound && <StatusIcon status={status} compact={compact} />}
          </div>
        </div>

        {actionButtons.length > 0 && (
          <div className={`border-t border-[#e9edef] ${shellClass}`}>
            {actionButtons.map((btn, index) => (
              <div
                key={`${btn.id}-${index}`}
                className={`flex w-full items-center justify-center gap-2 border-[#c5e8c0] py-2.5 font-medium text-[#008069] ${
                  index < actionButtons.length - 1 ? 'border-b' : ''
                } ${compact ? 'text-[13px]' : 'text-[14px]'}`}
              >
                {index === 0 ? ctaIcon : null}
                <span>{btn.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WhatsAppInteractivePreview({
  mode,
  header,
  body,
  footer,
  buttons,
  ctaLabel,
  listButtonLabel,
  listSections,
  couponCode,
  direction = 'outbound',
  compact = false,
  className = '',
  time,
  status,
  showSurface = true,
}: WhatsAppInteractivePreviewProps) {
  const card = (
    <WhatsAppInteractiveCard
      mode={mode}
      header={header}
      body={body}
      footer={footer}
      buttons={buttons}
      ctaLabel={ctaLabel}
      listButtonLabel={listButtonLabel}
      listSections={listSections}
      couponCode={couponCode}
      direction={direction}
      compact={compact}
      time={time}
      status={status}
    />
  );

  if (!showSurface) return <div className={className}>{card}</div>;

  return (
    <WhatsAppChatSurface compact={compact} className={className}>
      {card}
    </WhatsAppChatSurface>
  );
}
