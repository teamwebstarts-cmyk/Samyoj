export {
  GMAIL_MOCK_MAILBOX,
  GMAIL_MOCK_PREVIEW_BLOCK,
  getGmailMockContacts,
  getGmailMockSends,
  getGmailMockStatus,
  getGmailMockTemplates,
} from '../../utils/gmailMockData';
export { useGmailWorkspace, useGmailChannelAvailable } from '../../components/email/emailData';
export type {
  GmailContact as EmailContact,
  GmailSend as EmailRecentSend,
  GmailTemplate as EmailTemplate,
} from '../../services/api';
