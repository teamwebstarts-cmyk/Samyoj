import { useEffect, useMemo, useState } from 'react';
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

  // Prefetch neighbors (WhatsApp-smooth swipe) while the viewer is open.
  useEffect(() => {
    if (index < 0) return;
    const neighbors = [mediaGallery[index - 1], mediaGallery[index + 1]].filter(Boolean) as Message[];
    for (const msg of neighbors) {
      void getMediaUrl(msg.id).catch(() => {
        /* warm cache best-effort */
      });
    }
  }, [index, mediaGallery]);

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
        mimeType: nextMsg.metadata?.mimeType,
        loopMuted: Boolean(nextMsg.metadata?.isGif),
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
