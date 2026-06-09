import { config } from '../config';
import logger from '../utils/logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const { smtpHost, smtpUser, smtpPass, from } = config.email;

  if (!smtpHost) {
    logger.info('Email (dev — SMTP not configured)', {
      source: 'email',
      to: options.to,
      subject: options.subject,
      preview: options.text.slice(0, 200),
    });
    return true;
  }

  let nodemailer: { createTransport: (opts: Record<string, unknown>) => { sendMail: (opts: Record<string, unknown>) => Promise<unknown> } };
  try {
    nodemailer = await import('nodemailer') as typeof nodemailer;
  } catch {
    logger.warn('nodemailer not installed — logging email instead', {
      source: 'email',
      to: options.to,
      subject: options.subject,
    });
    return true;
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: config.email.smtpPort,
    secure: config.email.smtpSecure,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  await transport.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html || options.text.replace(/\n/g, '<br>'),
  });

  return true;
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  return sendEmail({
    to: email,
    subject: 'Reset your password',
    text: `You requested a password reset.\n\nOpen this link to set a new password (expires in 1 hour):\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>You requested a password reset.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
  });
}

export async function sendTeamInviteEmail(
  email: string,
  inviteUrl: string,
  companyName: string,
  inviterName: string
) {
  return sendEmail({
    to: email,
    subject: `You're invited to ${companyName}`,
    text: `${inviterName} invited you to join ${companyName} on WhatsApp Platform.\n\nAccept your invite:\n${inviteUrl}\n\nThis link expires in 7 days.`,
    html: `<p><strong>${inviterName}</strong> invited you to join <strong>${companyName}</strong>.</p><p><a href="${inviteUrl}">Accept invite</a></p><p>This link expires in 7 days.</p>`,
  });
}
