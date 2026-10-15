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
      'Meta App Secret does not match this App ID. The platform administrator must set META_APP_ID and META_APP_SECRET in the server environment.'
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
      'OAuth redirect URI mismatch. Add the exact callback URL to Meta → Facebook Login → Valid OAuth Redirect URIs (e.g. http://localhost:3000/settings/whatsapp/callback/popup).'
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
      'WhatsApp is not configured on this server. The platform administrator must set META_APP_ID and META_APP_SECRET in the server environment.'
    );
  }

  if (lower.includes('2655122') || lower.includes("don't have any existing")) {
    return new AppError(
      400,
      'This number is already registered on the app itself, so it cannot be chosen here. Connect a number from your own Meta Business account.'
    );
  }

  if (lower.includes('3441045') || lower.includes('further activity')) {
    return new AppError(
      400,
      'This number is not eligible for the phone-app connection yet. Keep using it in the WhatsApp Business app, then try again.'
    );
  }

  if (lower.includes('3441030')) {
    return new AppError(
      400,
      'This number is already on Cloud API. Choose Cloud API, not the phone-app option.'
    );
  }

  if (lower.includes('3441049') || lower.includes('2655094') || lower.includes('already connected')) {
    return new AppError(
      400,
      'This number is already linked to a business platform. In the WhatsApp Business app, open Settings, Account, Business platform, disconnect, wait 15 minutes, then connect again.'
    );
  }

  if (lower.includes('4563015') || lower.includes('out of date')) {
    return new AppError(400, 'Update the WhatsApp Business app on the phone, then connect again.');
  }

  if (lower.includes('2655095') || lower.includes('2655048')) {
    return new AppError(
      400,
      'This number is not on the WhatsApp Business app. Use Cloud API, or register it in the app first.'
    );
  }

  if (lower.includes('not_verified') || lower.includes('verification code')) {
    return new AppError(
      400,
      'This number still needs the code from the Facebook window. Enter that code, then click Connect again.'
    );
  }

  if (lower.includes('payment') || lower.includes('funding')) {
    return new AppError(
      400,
      'Add a payment card in WhatsApp Manager before template messages can send.'
    );
  }

  if (/developers\.facebook\.com|fbtrace|oauthexception|\(#\d{3,}\)|graph api/i.test(raw)) {
    return new AppError(502, 'WhatsApp did not finish connecting. Close the window and click Connect again.');
  }

  return new AppError(502, 'WhatsApp did not finish connecting. Close the window and click Connect again.');
}
