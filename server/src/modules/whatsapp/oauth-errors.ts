import { AppError } from '../../utils/response';

/**
 * Map Meta OAuth / Graph errors into clear, actionable AppErrors for the Connect flow.
 */
export function mapWhatsAppOAuthError(err: unknown): AppError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('validating client secret') || lower.includes('client_secret')) {
    return new AppError(
      400,
      'Meta App Secret is wrong for this App ID. Open Settings → WhatsApp → Configure Meta app and paste the App Secret from Meta → Settings → Basic.'
    );
  }

  if (lower.includes('authorization code has been used') || lower.includes('code has been used')) {
    return new AppError(
      409,
      'This Facebook login was already completed. Close the popup and check Settings — your number may already be connected. If not, click Connect WhatsApp again.'
    );
  }

  if (lower.includes('redirect_uri') || lower.includes('redirect uri')) {
    return new AppError(
      400,
      'OAuth redirect URI mismatch. Add the exact callback URL to Meta → Facebook Login → Valid OAuth Redirect URIs (e.g. http://localhost:3000/settings/whatsapp/callback).'
    );
  }

  if (lower.includes('expired') || lower.includes('code was invalid')) {
    return new AppError(
      400,
      'Facebook login expired. Click Connect WhatsApp again and finish the popup without refreshing.'
    );
  }

  if (lower.includes('meta app credentials are not configured')) {
    return new AppError(
      400,
      'Meta App ID / Secret not configured. Save them in Settings → WhatsApp → Configure Meta app first.'
    );
  }

  return new AppError(502, raw || 'WhatsApp connection failed. Please try Connect WhatsApp again.');
}
