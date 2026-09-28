import { ArrowRight, Images, Instagram, Lock, Send, Sparkles } from 'lucide-react';
import { POST_AFTER_CONNECT, POST_CONNECT_BENEFITS } from './PostsChrome';

type ConnectScreenProps = {
  canConnect: boolean;
  busy: boolean;
  onConnect: () => void;
};

const TONE_CLASS: Record<'pink' | 'violet' | 'amber' | 'green', string> = {
  pink: 'igp-explore__icon--pink',
  violet: 'igp-explore__icon--violet',
  amber: 'igp-explore__icon--amber',
  green: 'igp-explore__icon--green',
};

const BENEFIT_ICON: Record<'pink' | 'violet' | 'amber', string> = {
  pink: 'igp-stat__icon--pink',
  violet: 'igp-stat__icon--blue',
  amber: 'igp-stat__icon--amber',
};

/**
 * Connected-state screen shown when the org has no active Instagram channel.
 * Uses the existing Facebook Page OAuth connect path — no Meta technical fields.
 */
export default function ConnectScreen({ canConnect, busy, onConnect }: ConnectScreenProps) {
  return (
    <>
      <section className="igp-connect">
        <div className="igp-connect__art" aria-hidden>
          <span className="igp-connect__thumb igp-connect__thumb--a">
            <Images className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <span className="igp-connect__thumb igp-connect__thumb--b">
            <Send className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <span className="igp-connect__thumb igp-connect__thumb--c">
            <Sparkles className="h-6 w-6" strokeWidth={1.8} />
          </span>
          <span className="igp-connect__plane">
            <Send className="h-5 w-5" />
          </span>

          <div className="igp-connect__phone">
            <span className="igp-connect__mark">
              <Instagram className="h-7 w-7" strokeWidth={1.8} />
            </span>
            <span className="igp-connect__line" />
            <span className="igp-connect__line igp-connect__line--short" />
            <span className="igp-connect__line" />
          </div>
        </div>

        <div>
          <p className="igp-eyebrow">Connect Instagram</p>
          <h2 className="igp-connect__title">Connect your Instagram Professional Account</h2>

          <div className="igp-benefits">
            {POST_CONNECT_BENEFITS.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.title} className="igp-benefit">
                  <span className={`igp-benefit__icon ${BENEFIT_ICON[row.tone]}`}>
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  <span>
                    <strong>{row.title}</strong>
                    <span>{row.body}</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="igp-connect__cta">
            <button
              type="button"
              className="igp-btn igp-btn--primary igp-btn--lg"
              disabled={!canConnect || busy}
              onClick={onConnect}
            >
              <Instagram className="h-4 w-4" strokeWidth={2.2} />
              {busy ? 'Connecting…' : canConnect ? 'Connect Instagram' : 'Ask an admin'}
              {canConnect && !busy ? <ArrowRight className="h-4 w-4" /> : null}
            </button>
          </div>

          <p className="igp-connect__secure">
            <Lock className="h-3.5 w-3.5" />
            Secure connection via Meta (Facebook)
            <a
              href="https://developers.facebook.com/docs/instagram-platform"
              target="_blank"
              rel="noreferrer noopener"
            >
              Learn more
            </a>
          </p>
        </div>
      </section>

      <section className="igp-after">
        <p className="igp-after__label">What you can do after connecting</p>
        <div className="igp-after__grid">
          {POST_AFTER_CONNECT.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.title} className="igp-explore__card">
                <span className={`igp-explore__icon ${TONE_CLASS[row.tone]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <strong>{row.title}</strong>
                  <span>{row.body}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
