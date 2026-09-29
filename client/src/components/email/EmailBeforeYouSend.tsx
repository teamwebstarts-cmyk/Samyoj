import { Check, Info, Lock } from 'lucide-react';

export interface BeforeYouSendItem {
  text: string;
  detail?: string;
  kind: 'ok' | 'info' | 'lock';
}

/** "Before you send" checklist — mockups 1 & 2. */
export function EmailBeforeYouSendList({ items }: { items: BeforeYouSendItem[] }) {
  return (
    <ul className="ema-checklist" style={{ paddingTop: 12 }}>
      {items.map((item) => (
        <li key={item.text} className={`ema-check ema-check--${item.kind}`}>
          {item.kind === 'ok' ? (
            <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />
          ) : item.kind === 'lock' ? (
            <Lock className="h-[15px] w-[15px]" strokeWidth={2.2} />
          ) : (
            <Info className="h-[15px] w-[15px]" strokeWidth={2.2} />
          )}
          <span>
            {item.text}
            {item.detail ? <small>{item.detail}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Dashboard default checklist — mockup 1 (image.png). */
export const DASHBOARD_CHECKLIST: BeforeYouSendItem[] = [
  {
    text: 'Contact must have a valid email address',
    detail: 'Only contacts with an email can receive emails.',
    kind: 'ok',
  },
  {
    text: 'Email permission must be enabled',
    detail: 'Turn on "Can email this contact" in the contact profile.',
    kind: 'ok',
  },
  {
    text: 'You can only send from the connected mailbox',
    kind: 'info',
  },
  {
    text: 'Replies, opens and delivered status are not shown',
    kind: 'info',
  },
];
