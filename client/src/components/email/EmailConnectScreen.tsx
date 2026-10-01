import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info, Lock, Mail, Send, ShieldCheck, UserRound, Users } from 'lucide-react';
import GmailGlyph from './GmailGlyph';
import { gmailApi, type GmailStatus } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';
import { gmailCallbackErrorFromSearch } from './emailData';

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

export default function EmailConnectScreen({ connectionStatus = 'disconnected' }: { connectionStatus?: GmailStatus['status'] }) {
  const [searchParams] = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(() => gmailCallbackErrorFromSearch(searchParams.toString()));

  useEffect(() => {
    const fromCallback = gmailCallbackErrorFromSearch(searchParams.toString());
    if (fromCallback) setError(fromCallback);
  }, [searchParams]);

  const connect = async () => {
    setConnecting(true);
    setError('');
    try {
      const response = await gmailApi.connect();
      window.location.assign(response.data.data.url);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Gmail could not start connecting.'));
      setConnecting(false);
    }
  };

  return (
    <div className="ema-gate">
      <header className="ema-gate__head">
        <h1>Gmail</h1>
        <p>Connect and manage your Gmail mailbox for sending emails.</p>
      </header>

      <ConnectionPane
        connectionStatus={connectionStatus}
        connecting={connecting}
        error={error}
        onConnect={() => void connect()}
      />
    </div>
  );
}

function ConnectionPane({
  connecting,
  error,
  onConnect,
  connectionStatus,
}: {
  connecting: boolean;
  error: string;
  onConnect: () => void;
  connectionStatus: GmailStatus['status'];
}) {
  return (
    <div className="ema-gate__stack">
      <section className="ema-gate__hero">
        <div className="ema-gate__hero-inner">
          <div className="ema-gate__pitch">
          <span className="ema-gate__status">
            <i /> {connectionStatus === 'reconnect-required' ? 'Reconnect required' : 'Not connected'}
          </span>
          <h2>{connectionStatus === 'reconnect-required' ? 'Reconnect your Gmail' : 'Connect your Gmail'}</h2>
          <p>{connectionStatus === 'reconnect-required'
            ? 'Google access needs to be renewed before Samyoj can send again. Your sent history stays.'
            : 'Send email as your Gmail or Google Workspace mailbox. Samyoj does not read your inbox.'}</p>
          <button type="button" className="ema-gate__cta" onClick={onConnect} disabled={connecting}>
            <span className="ema-gate__g">
              <GoogleMark />
            </span>
            {connecting ? 'Opening Google…' : 'Connect Gmail'}
          </button>
          {error ? <p className="ema-notice ema-notice--fail" role="alert">{error}</p> : null}
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
