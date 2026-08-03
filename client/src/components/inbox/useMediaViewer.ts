import { useMemo, useState } from 'react';
import { getMediaUrl } from './AuthenticatedMedia';
import { messageHasMedia } from './inboxUtils';
import type { MediaViewerItem } from './MediaViewer';
import { toastError } from '../../utils/toast';
import type { Message } from '../../types';

export function useMediaViewer(messages: Message[]) {
  const [mediaViewer, setMediaViewer] = useState<MediaViewerItem | null>(null);

  const mediaGallery = useMemo(
    () =>
      messages.filter(
        (m) =>
          messageHasMedia(m) && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(m.type?.toUpperCase() || '')
      ),
    [messages]
  );

  const index = mediaViewer ? mediaGallery.findIndex((m) => m.id === mediaViewer.messageId) : -1;

  const navigate = async (direction: 'prev' | 'next') => {
    const nextMsg = mediaGallery[direction === 'prev' ? index - 1 : index + 1];
    if (!nextMsg) return;
    try {
      const url = await getMediaUrl(nextMsg.id);
      setMediaViewer({
        messageId: nextMsg.id,
        type: nextMsg.type?.toUpperCase() as MediaViewerItem['type'],
        url,
        filename: nextMsg.metadata?.filename,
      });
    } catch {
      toastError('Could not load media');
    }
  };

  return {
    mediaViewer,
    openMediaViewer: setMediaViewer,
    closeMediaViewer: () => setMediaViewer(null),
    navigateMedia: navigate,
    hasPrev: index > 0,
    hasNext: index >= 0 && index < mediaGallery.length - 1,
  };
}
