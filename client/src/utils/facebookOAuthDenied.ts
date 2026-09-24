/** Facebook sends the user back with error= when the dialog never issues a code. */
export function facebookOAuthDeniedMessage(params: {
  error?: string | null;
  error_description?: string | null;
  error_message?: string | null;
}): string | null {
  const code = (params.error || '').trim();
  const raw = (params.error_description || params.error_message || '').trim();
  if (!code && !raw) return null;

  let text = raw.replace(/\+/g, ' ');
  try {
    text = decodeURIComponent(text);
  } catch {
    /* keep the plus-decoded string */
  }

  if (/invalid scopes/i.test(text) || /invalid scopes/i.test(code)) {
    return 'Facebook has not granted Page, Instagram, or Ads read on this app yet. WhatsApp still works. Add those use cases on the Meta app, then connect again.';
  }
  if (code === 'access_denied') {
    return 'Facebook connect was cancelled. Start again when you are ready.';
  }
  return text || 'Facebook did not finish the connection. Start again from Settings.';
}
