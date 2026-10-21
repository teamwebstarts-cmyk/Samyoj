export interface ChatManualSnapshotEntry {
  botId: string;
}

export interface ChatNumberSettings {
  /** Global AI chat on/off for this WhatsApp number workspace. */
  aiEnabled: boolean;
  /** Chat bot applied when global AI is on. */
  botId: string | null;
  /**
   * Personal MANUAL-on chats remembered before global ON overwrote them.
   * Restored when global turns OFF.
   */
  manualSnapshot?: Record<string, ChatManualSnapshotEntry>;
}

export interface OrgChatSettings {
  byNumber: Record<string, ChatNumberSettings>;
  /** Instagram / Messenger channel workspaces (Channel.id). */
  byChannel?: Record<string, ChatNumberSettings>;
}

export const DEFAULT_CHAT_NUMBER_SETTINGS: ChatNumberSettings = {
  aiEnabled: false,
  botId: null,
  manualSnapshot: {},
};
