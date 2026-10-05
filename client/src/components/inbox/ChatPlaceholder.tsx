import { MessageSquarePlus } from 'lucide-react';
import { Hash, ImagePlus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyStateHeroImage from '../ui/EmptyStateHeroImage';
import MetaChannelSideHub from '../meta/MetaChannelSideHub';

interface ChatPlaceholderProps {
  onNewChat?: () => void;
  platform?: 'whatsapp' | 'facebook' | 'instagram';
}

/** Right pane when no chat is open — hero illustration + onboarding copy. */
export default function ChatPlaceholder({ onNewChat, platform = 'whatsapp' }: ChatPlaceholderProps) {
  const navigate = useNavigate();
  const accent = {
    whatsapp: {
      dot: 'bg-whatsapp-500',
      button: 'border-whatsapp-500/35 text-whatsapp-600 hover:border-whatsapp-500/55 hover:bg-whatsapp-50/80 dark:border-whatsapp-500/30 dark:text-whatsapp-400 dark:hover:bg-whatsapp-950/30',
    },
    facebook: {
      dot: 'bg-[#1877F2]',
      button: 'border-[#1877F2]/35 text-[#1877F2] hover:border-[#1877F2]/55 hover:bg-[#1877F2]/5 dark:border-[#1877F2]/30 dark:text-[#69a7ff] dark:hover:bg-[#1877F2]/15',
    },
    instagram: {
      dot: 'bg-[#E4405F]',
      button: 'border-[#E4405F]/35 text-[#d6335a] hover:border-[#E4405F]/55 hover:bg-[#E4405F]/5 dark:border-[#E4405F]/30 dark:text-[#ff7b99] dark:hover:bg-[#E4405F]/15',
    },
  }[platform];
  const heroId =
    platform === 'instagram'
      ? 'instagram-inbox-empty-hero'
      : platform === 'facebook'
        ? 'messenger-inbox-empty-hero'
        : 'inbox-empty-hero';
  const heroSize =
    platform === 'instagram' || platform === 'facebook'
      ? { width: 1536, height: 1024 }
      : { width: 1280, height: 853 };
  const copy = {
    whatsapp: {
      title: 'Your inbox is ready!',
      body: 'All your conversations, AI replies and automations in one smart place.',
      hint: 'Select a conversation to begin replying',
    },
    facebook: {
      title: 'Messenger inbox is ready',
      body: 'Page messages land here after a customer writes the Page. Comments and lead ads are not this inbox.',
      hint: 'Pick a chat on the left to reply',
    },
    instagram: {
      title: 'Instagram DMs are ready',
      body: 'Comments stay under Comments. Direct messages appear here only after someone DMs this account.',
      hint: 'Select a conversation to begin replying',
    },
  }[platform];

  const metaHub =
    platform === 'instagram'
      ? (
          <div className="hidden h-full min-h-0 w-full max-w-[22rem] shrink-0 flex-col border-l border-rose-100/80 bg-white/60 p-3 dark:border-rose-950/40 dark:bg-neutral-950/40 lg:flex lg:max-w-[min(24rem,34%)] xl:max-w-[26rem]">
            <MetaChannelSideHub
              className="h-full min-h-0 flex-1 !rounded-xl !shadow-none"
              heading="Instagram on Samyoj"
              subheading="DMs are here. Use these for posts, comments and content."
              options={[
                {
                  key: 'posts',
                  title: 'Posts',
                  description: 'Create, schedule and publish to your connected account.',
                  icon: ImagePlus,
                  accent: 'instagram',
                  to: '/instagram/posts',
                },
                {
                  key: 'comments',
                  title: 'Comments',
                  description: 'Reply, hide and automate comment workflows.',
                  icon: Hash,
                  accent: 'instagram',
                  to: '/instagram/comments',
                },
                {
                  key: 'studio',
                  title: 'AI Studio',
                  description: 'Generate visuals and copy for Instagram and WhatsApp.',
                  icon: Sparkles,
                  accent: 'instagram',
                  to: '/ai-studio',
                },
              ]}
            />
          </div>
        )
      : platform === 'facebook'
        ? (
            <div className="hidden h-full min-h-0 w-full max-w-[22rem] shrink-0 flex-col border-l border-blue-100/80 bg-white/60 p-3 dark:border-blue-950/40 dark:bg-neutral-950/40 lg:flex lg:max-w-[min(24rem,34%)]">
              <MetaChannelSideHub
                className="h-full min-h-0 flex-1 !rounded-xl !shadow-none"
                heading="Facebook on Samyoj"
                subheading="Messenger chats are on the left. More tools:"
                options={[
                  {
                    key: 'ads',
                    title: 'Ads',
                    description: 'Review lead ads and campaign tools.',
                    icon: Sparkles,
                    accent: 'facebook',
                    to: '/facebook/ads',
                  },
                  {
                    key: 'posts',
                    title: 'Instagram Posts',
                    description: 'Create and schedule Instagram content.',
                    icon: ImagePlus,
                    accent: 'instagram',
                    to: '/instagram/posts',
                  },
                  {
                    key: 'studio',
                    title: 'AI Studio',
                    description: 'Generate campaign creative and copy.',
                    icon: Sparkles,
                    accent: 'facebook',
                    to: '/ai-studio',
                  },
                ]}
              />
            </div>
          )
        : null;

  return (
    <div
      className="inbox-placeholder-bg relative flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
      role="status"
      aria-live="polite"
      aria-label="Your inbox is ready"
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-white/50 backdrop-blur-md dark:bg-[#0b141a]/40 dark:backdrop-blur-sm"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_42%,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.28)_48%,transparent_82%)] dark:bg-[radial-gradient(ellipse_90%_80%_at_50%_42%,rgba(255,255,255,0.1)_0%,transparent_72%)]"
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4 sm:py-4">
        <div className="inbox-placeholder-enter flex h-full min-h-0 w-full max-w-[42rem] flex-col items-center justify-center mx-auto">
          <div className="flex min-h-0 w-full max-w-[38rem] flex-[1.15] items-center justify-center">
            <EmptyStateHeroImage id={heroId} width={heroSize.width} height={heroSize.height} />
          </div>

          <div className="flex w-full shrink-0 flex-col items-center text-center">
            <h2
              className="inbox-placeholder-card text-[18px] font-bold leading-tight tracking-tight text-[#1e293b] dark:text-white sm:text-[21px]"
              style={{ animationDelay: '60ms' }}
            >
              {copy.title}
            </h2>

            <p
              className="inbox-placeholder-card mt-1.5 max-w-[17.5rem] text-[11.5px] font-medium leading-snug text-slate-500 dark:text-slate-400 sm:mt-2 sm:max-w-[22rem] sm:text-[12.5px]"
              style={{ animationDelay: '120ms' }}
            >
              {copy.body}
            </p>

            <div
              className="inbox-placeholder-card relative my-3 w-full max-w-[11rem] sm:my-3.5"
              style={{ animationDelay: '180ms' }}
              aria-hidden
            >
              <div className="h-px w-full bg-slate-200/90 dark:bg-slate-700/80" />
              <span className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${accent.dot} shadow-[0_0_0_3px_rgba(255,255,255,0.95)] dark:shadow-[0_0_0_3px_rgba(15,23,42,0.95)]`} />
            </div>

            <p
              className="inbox-placeholder-card text-[11.5px] font-medium text-slate-400 dark:text-slate-500 sm:text-[12px]"
              style={{ animationDelay: '240ms' }}
            >
              {copy.hint}
            </p>

            {onNewChat ? (
              <button
                type="button"
                onClick={onNewChat}
                className={`inbox-placeholder-card mt-3 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-[12.5px] font-semibold shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition ${accent.button} dark:bg-neutral-900 sm:mt-3.5 sm:py-2.5 sm:text-[13px]`}
                style={{ animationDelay: '300ms' }}
              >
                <MessageSquarePlus className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                + New chat
              </button>
            ) : null}
            {(platform === 'instagram' || platform === 'facebook') && (
              <div className="inbox-placeholder-card mt-4 w-full max-w-md border-t border-slate-200/80 pt-4 dark:border-slate-700 lg:hidden">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  More on Samyoj
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {platform === 'instagram' ? (
                    <>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-3 py-1.5 text-[12px] font-bold text-rose-700"
                        onClick={() => navigate('/instagram/posts')}
                      >
                        Posts
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-3 py-1.5 text-[12px] font-bold text-rose-700"
                        onClick={() => navigate('/instagram/comments')}
                      >
                        Comments
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-violet-200 px-3 py-1.5 text-[12px] font-bold text-violet-700"
                        onClick={() => navigate('/ai-studio')}
                      >
                        AI Studio
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded-full border border-blue-200 px-3 py-1.5 text-[12px] font-bold text-blue-700"
                        onClick={() => navigate('/facebook/ads')}
                      >
                        Ads
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 px-3 py-1.5 text-[12px] font-bold text-rose-700"
                        onClick={() => navigate('/instagram/posts')}
                      >
                        Instagram Posts
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {metaHub}
    </div>
  );
}
