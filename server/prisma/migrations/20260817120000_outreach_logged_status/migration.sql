-- Additive: outreach may record LOGGED when SMTP is unset so operators
-- never see SENT without a real mailbox send.

ALTER TYPE "PlatformOutreachStatus" ADD VALUE 'LOGGED';
