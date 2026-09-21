/**
 * Helmet CSP for the customer SPA (served from the API origin in production).
 * Razorpay Checkout.js must load from checkout.razorpay.com — `'self'` alone
 * blocks billing upgrades (script-src-elem falls back to script-src).
 */
const RAZORPAY = 'https://*.razorpay.com';
const GOOGLE_FONTS = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_STATIC = 'https://fonts.gstatic.com';
/** FB.login / Embedded Signup (connect.facebook.net is not *.facebook.com). */
const FACEBOOK_SDK = 'https://connect.facebook.net';
const FACEBOOK = 'https://*.facebook.com';
const FACEBOOK_CDN = 'https://*.fbcdn.net';

export function helmetContentSecurityPolicyDirectives(useHttps: boolean) {
  const scriptSrc = ["'self'", "'unsafe-inline'", RAZORPAY, FACEBOOK_SDK];
  return {
    upgradeInsecureRequests: useHttps ? ([] as string[]) : null,
    scriptSrc,
    scriptSrcElem: scriptSrc,
    mediaSrc: ["'self'", 'data:', 'blob:'],
    imgSrc: ["'self'", 'data:', 'blob:', RAZORPAY, FACEBOOK, FACEBOOK_SDK, FACEBOOK_CDN],
    connectSrc: ["'self'", RAZORPAY, FACEBOOK, FACEBOOK_SDK],
    frameSrc: ["'self'", RAZORPAY, FACEBOOK, FACEBOOK_SDK],
    formAction: ["'self'", RAZORPAY],
    styleSrc: ["'self'", "'unsafe-inline'", GOOGLE_FONTS],
    fontSrc: ["'self'", 'data:', GOOGLE_FONTS, GOOGLE_FONTS_STATIC],
    workerSrc: ["'self'", 'blob:'],
  };
}
