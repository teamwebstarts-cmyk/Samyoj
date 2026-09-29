import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ExternalLink,
  Info,
  Lock,
  Mail,
  Ban,
  Send,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import GmailGlyph from './GmailGlyph';

type GateTab = 'connection' | 'limits' | 'help';

const HAPPENS = [
  { icon: Send, tone: 'green', text: 'You will be redirected to Google to allow access.' },
  { icon: Lock, tone: 'blue', text: 'Samyoj will only be able to send emails from your mailbox.' },
  { icon: Mail, tone: 'red', text: 'We do not read, store or access your inbox emails.' },
  { icon: ShieldCheck, tone: 'violet', text: 'Only owners or admins can connect Gmail.' },
  { icon: Users, tone: 'amber', text: 'One mailbox per organization. You cannot switch mailboxes yet.' },
] as const;

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.4 14.4A7.2 7.2 0 0 1 5 12c0-.8.1-1.6.4-2.4V6.5H1.4A12 12 0 0 0 0 12c0 1.9.5 3.8 1.4 5.5l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.8 8.9 4.8 12 4.8z" />
    </svg>
  );
}

export default function EmailConnectScreen() {
  const [tab, setTab] = useState<GateTab>('connection');

  return (
    <div className="ema-gate">
      <header className="ema-gate__head">
        <h1>Gmail</h1>
        <p>Connect and manage your Gmail mailbox for sending emails.</p>
      </header>

      <div className="ema-gate__tabs" role="tablist" aria-label="Gmail connection">
        {(
          [
            ['connection', 'Connection'],
            ['limits', 'Sending Limits'],
            ['help', 'Help & Support'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? 'is-on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'connection' ? <ConnectionPane onLimits={() => setTab('limits')} /> : null}
      {tab === 'limits' ? <LimitsPane /> : null}
      {tab === 'help' ? <HelpPane /> : null}
    </div>
  );
}

function ConnectionPane({ onLimits }: { onLimits: () => void }) {
  return (
    <div className="ema-gate__stack">
      <section className="ema-gate__hero">
        <div className="ema-gate__hero-inner">
          <div className="ema-gate__pitch">
          <span className="ema-gate__status">
            <i /> Not connected
          </span>
          <h2>Connect your Gmail</h2>
          <p>Send email as your Gmail or Google Workspace mailbox. Samyoj does not read your inbox.</p>
          <Link to="/settings?tab=channels" className="ema-gate__cta">
            <span className="ema-gate__g">
              <GoogleMark />
            </span>
            Connect Gmail
          </Link>
          <p className="ema-gate__note">
            <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            If your company Google admin blocks apps, ask them to allow Samyoj.
          </p>
        </div>
          <ConnectArt />
        </div>
      </section>

      <section className="ema-gate__aside">
        <h3>What happens when you connect?</h3>
        <ul>
          {HAPPENS.map((item) => (
            <li key={item.text}>
              <span className={`ema-gate__tick ema-gate__tick--${item.tone}`}>
                <item.icon className="h-3.5 w-3.5" strokeWidth={2.3} />
              </span>
              {item.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="ema-gate__limits">
        <GmailGlyph className="h-7 w-7 shrink-0" />
        <div>
          <strong>Important information about sending limits</strong>
          <ul>
            <li>Google limits this mailbox — about 500 emails a day on free Gmail, about 2,000 emails a day on paid Workspace.</li>
            <li>If sending stops, wait up to 24 hours.</li>
            <li>This is a sending-only channel. Samyoj does not read your inbox.</li>
          </ul>
        </div>
        <button type="button" className="ema-gate__more" onClick={onLimits}>
          Learn more <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </section>
    </div>
  );
}

function ConnectArt() {
  return (
    <div className="ema-gate__art" aria-hidden="true">
      <span className="ema-gate__orbit" />
      <span className="ema-gate__mark">
        <GmailGlyph className="h-12 w-12" />
      </span>
      <span className="ema-gate__float ema-gate__float--mail">
        <Mail className="h-4 w-4" />
      </span>
      <span className="ema-gate__float ema-gate__float--plane">
        <Send className="h-4 w-4" />
      </span>
      <span className="ema-gate__float ema-gate__float--user">
        <UserRound className="h-4 w-4" />
      </span>
      <span className="ema-gate__float ema-gate__float--shield">
        <ShieldCheck className="h-4 w-4" />
      </span>
    </div>
  );
}

function LimitsPane() {
  return (
    <section className="ema-gate__panel">
      <h2>Sending limits</h2>
      <p>Google counts every email Samyoj sends from the connected mailbox. There is no remaining-quota number to show.</p>
      <ul className="ema-gate__facts">
        <li><Check className="h-4 w-4" /> About 500 emails a day on free Gmail.</li>
        <li><Check className="h-4 w-4" /> About 2,000 emails a day on paid Google Workspace.</li>
        <li><Check className="h-4 w-4" /> The limit rolls over 24 hours. If Google pauses sending, wait up to 24 hours.</li>
        <li><Ban className="h-4 w-4" /> No attachments in this version. Each person gets their own email.</li>
      </ul>
    </section>
  );
}

function HelpPane() {
  return (
    <section className="ema-gate__panel">
      <h2>Help & Support</h2>
      <ul className="ema-gate__facts">
        <li><ShieldCheck className="h-4 w-4" /> Only an owner or admin can connect the mailbox.</li>
        <li><Mail className="h-4 w-4" /> One Gmail or Workspace mailbox per organization.</li>
        <li><Lock className="h-4 w-4" /> Samyoj can send. It cannot read, store, or open the inbox.</li>
        <li><Info className="h-4 w-4" /> If Google blocks the app, a Workspace admin has to allow Samyoj first.</li>
      </ul>
      <Link to="/settings?tab=channels" className="ema-gate__cta ema-gate__cta--inline">
        <span className="ema-gate__g">
          <GoogleMark />
        </span>
        Connect Gmail
      </Link>
    </section>
  );
}
