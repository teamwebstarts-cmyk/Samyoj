import type { ReactNode } from 'react';
import InfoTip from '../ui/InfoTip';
import type { ContactConsentDisplay } from '../../utils/contactConsent';

function ConsentTipBody({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2 text-[12px] font-medium leading-relaxed text-neutral-950">
      {children}
    </div>
  );
}

/** Full explainer — campaigns vs Inbox, all badge meanings. */
export function ContactConsentInfoTip({ className = '' }: { className?: string }) {
  return (
    <InfoTip
      className={className}
      label="Campaign message consent"
      content={
        <ConsentTipBody>
          <p className="font-bold text-neutral-900">Campaign consent (not Inbox chat)</p>
          <p>
            This badge shows who can be added to <strong>WhatsApp campaigns</strong> and bulk
            marketing templates. You can always reply to anyone in Inbox — that is separate.
          </p>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <strong>Gets messages</strong> — included in campaign audiences.
            </li>
            <li>
              <strong>Not on list</strong> — may be chatting with you, but not on bulk lists until
              you allow messages or they message you first.
            </li>
            <li>
              <strong>Stopped</strong> — opted out of marketing (STOP, unsubscribe, or you turned it
              off). Inbox chat still works.
            </li>
          </ul>
          <p className="text-[11px] text-neutral-600">
            To add someone: open their contact → <strong>Allow messages</strong>, or they can reply{' '}
            <strong>START</strong> on WhatsApp.
          </p>
        </ConsentTipBody>
      }
    />
  );
}

export function contactConsentStatusTip(status: ContactConsentDisplay): ReactNode {
  if (status === 'eligible') {
    return (
      <ConsentTipBody>
        <p className="font-bold text-neutral-900">Gets messages</p>
        <p>
          This contact is on your campaign list. Bulk templates and campaigns can include them.
          Regular Inbox replies are always allowed.
        </p>
      </ConsentTipBody>
    );
  }

  if (status === 'stopped') {
    return (
      <ConsentTipBody>
        <p className="font-bold text-neutral-900">Stopped</p>
        <p>
          They opted out of <strong>marketing</strong> messages — for example STOP, unsubscribe, or
          you chose Stop messages. Campaigns will skip them.
        </p>
        <p>You can still chat with them in Inbox. They can reply START to opt back in.</p>
      </ConsentTipBody>
    );
  }

  return (
    <ConsentTipBody>
      <p className="font-bold text-neutral-900">Not on list</p>
      <p>
        They are <strong>not</strong> on campaign bulk lists yet. This does not block Inbox chat —
        you may already be talking to them.
      </p>
      <p>
        Use <strong>Allow messages</strong> on their contact, or wait for them to message your
        WhatsApp number first.
      </p>
    </ConsentTipBody>
  );
}

/** Info icon beside a consent badge — shows status-specific help. */
export function ContactConsentBadgeInfo({
  status,
  className = '',
}: {
  status: ContactConsentDisplay;
  className?: string;
}) {
  return (
    <InfoTip
      className={className}
      label="Campaign consent for this contact"
      content={contactConsentStatusTip(status)}
    />
  );
}
