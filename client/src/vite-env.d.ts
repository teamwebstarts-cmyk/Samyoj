/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_APP_NAME?: string;
  /** Intro / hero video — YouTube, Vimeo, or direct .mp4/.webm path (e.g. /dashboard/videos/intro.mp4) */
  readonly VITE_PRECONNECT_VIDEO_URL?: string;
  readonly VITE_PRECONNECT_VIDEO_API?: string;
  readonly VITE_PRECONNECT_VIDEO_HOW?: string;
  readonly VITE_PRECONNECT_VIDEO_BENEFITS?: string;
  readonly VITE_PRECONNECT_VIDEO_NEXT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
