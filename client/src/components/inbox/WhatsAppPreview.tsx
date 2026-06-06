import { AlertCircle, Check, CheckCheck, ExternalLink, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MessageTemplate, TemplateButton, TemplateLibraryEntry } from '../../types';
import { getTemplateButtons } from '../../utils/templateForm';

export type WhatsAppBubbleDirection = 'inbound' | 'outbound';

type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

function StatusIcon({ status, compact }: { status?: MessageStatus; compact?: boolean }) {
  const size = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';

  if (status === 'failed') {
    return <AlertCircle className={`${size} text-red-500`} strokeWidth={2.5} />;
  }
  if (status === 'read') {
    return <CheckCheck className={`${size} text-[#53bdeb]`} strokeWidth={2.5} />;
  }
  if (status === 'delivered') {
    return <CheckCheck className={`${size} text-[#8696a0]`} strokeWidth={2.5} />;
  }
  return <Check className={`${size} text-[#8696a0]`} strokeWidth={2.5} />;
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
  const textSize = compact ? 'text-[11px]' : 'text-[13.5px]';
  const metaSize = compact ? 'text-[9px]' : 'text-[11px]';
  const hasMedia = Boolean(children);

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} ${className}`}>
      <div
        className={`relative max-w-full shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          compact ? 'max-w-[220px]' : 'max-w-[85%] sm:max-w-[75%]'
        } ${
          hasMedia ? 'overflow-hidden p-0' : compact ? 'px-2 py-1.5' : 'px-3 py-2'
        } ${
          isOutbound
            ? isFailed
              ? 'rounded-lg rounded-br-[2px] bg-[#ffeaea] text-[#111b21]'
              : 'rounded-lg rounded-br-[2px] bg-[#d9fdd3] text-[#111b21]'
            : 'rounded-lg rounded-bl-[2px] bg-white text-[#111b21]'
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
              <p className={`whitespace-pre-wrap break-words leading-[1.35] ${textSize}`}>{content}</p>
            )}

            {footer && (
              <p className={`mt-1 leading-snug text-[#8696a0] ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
                {footer}
              </p>
            )}
          </div>
        )}

        {!hasMedia && !content && !header && !footer && children}

        <div className={`flex items-end justify-end gap-1 ${hasMedia ? 'px-3 pb-2' : 'mt-0.5'}`}>
          <span className={`${metaSize} font-normal tabular-nums text-[#667781]`}>{time}</span>
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
  if (type === 'URL') return <ExternalLink className="h-3.5 w-3.5 text-[#008069]" strokeWidth={2.25} />;
  if (type === 'PHONE_NUMBER') return <Phone className="h-3.5 w-3.5 text-[#008069]" strokeWidth={2.25} />;
  return null;
}

/** WhatsApp template message card (white bubble + stacked action buttons). */
export function WhatsAppTemplateCard({
  header,
  body,
  footer,
  buttons = [],
  compact = false,
  className = '',
  time = '12:30',
}: {
  header?: string;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  compact?: boolean;
  className?: string;
  time?: string;
}) {
  return (
    <div className={`flex justify-end ${className}`}>
      <div
        className={`overflow-hidden rounded-lg bg-white text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
          compact ? 'w-full max-w-[280px]' : 'w-full max-w-[min(100%,340px)]'
        }`}
      >
        <div className={compact ? 'px-2.5 pt-2.5 pb-1' : 'px-3.5 pt-3 pb-1.5'}>
          {header && (
            <p
              className={`font-semibold leading-snug text-[#111b21] ${
                compact ? 'text-[13px]' : 'text-[15px]'
              }`}
            >
              {header}
            </p>
          )}
          <p
            className={`whitespace-pre-wrap break-words leading-[1.45] text-[#111b21] ${
              compact ? 'text-[12.5px]' : 'text-[14.5px]'
            } ${header ? 'mt-1' : ''}`}
          >
            {body}
          </p>
          {footer && (
            <p
              className={`mt-2 leading-snug text-[#8696a0] ${
                compact ? 'text-[10px]' : 'text-[12px]'
              }`}
            >
              {footer}
            </p>
          )}
        </div>

        {buttons.length > 0 && (
          <div className="border-t border-[#e9edef]">
            {buttons.map((btn, i) => (
              <button
                key={`${btn.type}-${btn.text}-${i}`}
                type="button"
                className={`flex w-full items-center justify-center gap-2 border-[#e9edef] bg-white py-3 text-[#008069] transition hover:bg-[#f5f6f6] ${
                  i < buttons.length - 1 ? 'border-b' : ''
                } ${compact ? 'py-2.5 text-[13px]' : 'text-[14px] font-medium'}`}
              >
                <ButtonIcon type={btn.type} />
                <span>{btn.text || btn.type}</span>
              </button>
            ))}
          </div>
        )}

        <div className={`flex justify-end gap-1 ${compact ? 'px-2 pb-1.5 pt-0.5' : 'px-3 pb-2 pt-0.5'}`}>
          <span className={`tabular-nums text-[#667781] ${compact ? 'text-[9px]' : 'text-[11px]'}`}>
            {time}
          </span>
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
  const header =
    template.header ?? components.find((c) => c.type === 'HEADER')?.text;
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
    body: bodyText || '—',
    footer,
    buttons: getTemplateButtons(template),
    category: template.category,
  };
}

interface WhatsAppTemplatePreviewProps {
  header?: string;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
  variant?: 'default' | 'compact' | 'inline';
  className?: string;
}

export function WhatsAppTemplatePreview({
  header,
  body,
  footer,
  buttons = [],
  variant = 'default',
  className = '',
}: WhatsAppTemplatePreviewProps) {
  const compact = variant === 'compact' || variant === 'inline';

  return (
    <WhatsAppChatSurface compact={compact} className={className}>
      <WhatsAppTemplateCard
        header={header}
        body={body}
        footer={footer}
        buttons={buttons}
        compact={compact}
      />
    </WhatsAppChatSurface>
  );
}
