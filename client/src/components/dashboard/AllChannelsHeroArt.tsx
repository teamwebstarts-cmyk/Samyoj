import flowArt from './all-channels-flow.svg?raw';

/** Product illustration for the All Channels dashboard. Artwork is fixed; live numbers stay in the cards below. */
export default function AllChannelsHeroArt() {
  const html = flowArt.replace('<svg', '<svg class="all-channels-hero__svg"');
  return (
    <div className="dashboard-channel-hero-decor dashboard-channel-hero-decor--all" aria-hidden>
      <div className="all-channels-hero__frame" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
