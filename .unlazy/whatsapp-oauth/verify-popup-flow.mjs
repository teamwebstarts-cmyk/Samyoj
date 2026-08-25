import fs from 'node:fs';

const root = new URL('../../', import.meta.url);

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, root), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const oauth = read('client/src/utils/whatsappOAuth.ts');
const app = read('client/src/App.tsx');
const callback = read('client/src/pages/WhatsappCallbackPage.tsx');
const state = read('server/src/modules/whatsapp/connect-oauth-state.ts');
const callers = [
  read('client/src/hooks/useWhatsAppConnectOAuth.ts'),
  read('client/src/components/dashboard/WhatsAppConnectGuide.tsx'),
  read('client/src/pages/SettingsPage.tsx'),
];

assert(oauth.includes("WA_OAUTH_POPUP_CALLBACK_PATH = '/settings/whatsapp/callback/popup'"), 'popup callback path missing');
assert(oauth.includes('window.location.pathname === WA_OAUTH_POPUP_CALLBACK_PATH'), 'popup path is not used for context detection');
assert(oauth.includes('WA_OAUTH_POPUP_MARKER_KEY'), 'popup lifecycle marker missing');
assert(oauth.includes('setPopupMarker();'), 'popup marker is not set before opening');
assert(oauth.includes('clearPopupMarker();'), 'popup marker cleanup missing');
assert(oauth.includes('window.close()'), 'popup close behavior missing');
assert(oauth.includes('window.opener.postMessage'), 'opener result delivery missing');
assert(app.includes('path="/settings/whatsapp/callback/popup"'), 'popup callback route missing');
assert(state.includes("'/settings/whatsapp/callback/popup'"), 'server redirect allowlist missing popup route');
assert(callback.includes("finishOAuthFlow({ status: 'success'"), 'success result is not published');
assert(callback.includes("finishOAuthFlow({ status: 'error'"), 'error result is not published');
assert(callback.includes("status: 'cancel'"), 'cancel result is not represented');
assert(callers.every((source) => source.includes('getWhatsAppOAuthRedirectUri')), 'a connect caller bypasses the shared popup callback helper');

if (process.argv.includes('--negative')) {
  assert(state.includes('if (parsed.search || parsed.hash) return false;'), 'redirect query/hash rejection missing');
  assert(!oauth.includes("window.location.pathname === '/settings/whatsapp/callback'"), 'base callback is incorrectly treated as popup');
  console.log('oauth-popup-negative-flow-ok');
} else {
  console.log('oauth-popup-flow-ok');
}
