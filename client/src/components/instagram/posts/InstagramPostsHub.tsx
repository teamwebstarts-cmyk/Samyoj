import { Hash, ImagePlus, Sparkles } from 'lucide-react';
import MetaChannelSideHub from '../../meta/MetaChannelSideHub';

type Props = {
  onNewPost: () => void;
  className?: string;
};

export default function InstagramPostsHub({ onNewPost, className }: Props) {
  return (
    <MetaChannelSideHub
      className={className}
      heading="What do you want to do?"
      subheading="Pick an option — your posts list stays on the left."
      options={[
        {
          key: 'create',
          title: 'Create a new post',
          description: 'Image, Reel or carousel — schedule or publish now.',
          icon: ImagePlus,
          accent: 'instagram',
          onClick: onNewPost,
        },
        {
          key: 'studio',
          title: 'Generate in AI Studio',
          description: 'Create visuals and copy, then open here to publish.',
          icon: Sparkles,
          accent: 'instagram',
          to: '/ai-studio',
        },
        {
          key: 'comments',
          title: 'Comment automation',
          description: 'Set up keyword replies and DMs from Comments.',
          icon: Hash,
          accent: 'instagram',
          to: '/instagram/comments',
        },
      ]}
    />
  );
}
