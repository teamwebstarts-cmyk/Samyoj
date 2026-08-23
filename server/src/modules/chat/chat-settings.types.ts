export interface ChatNumberSettings {
  /** Global AI chat on/off for this WhatsApp number workspace. */
  aiEnabled: boolean;
  /** Chat bot applied when global AI is on. */
  botId: string | null;
}

export interface OrgChatSettings {
  byNumber: Record<string, ChatNumberSettings>;
}

export const DEFAULT_CHAT_NUMBER_SETTINGS: ChatNumberSettings = {
  aiEnabled: false,
  botId: null,
};
