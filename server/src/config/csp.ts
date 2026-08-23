/**
 * Helmet CSP for the customer SPA (served from the API origin in production).
 * Razorpay Checkout.js must load from checkout.razorpay.com — `'self'` alone
 * blocks billing upgrades (script-src-elem falls back to script-src).
 */
const RAZORPAY = 'https://*.razorpay.com';
const GOOGLE_FONTS = 'https://fonts.googleapis.com';
const GOOGLE_FONTS_STATIC = 'https://fonts.gstatic.com';

export function helmetContentSecurityPolicyDirectives(useHttps: boolean) {
  const scriptSrc = ["'self'", "'unsafe-inline'", RAZORPAY];
  return {
    upgradeInsecureRequests: useHttps ? ([] as string[]) : null,
    scriptSrc,
    scriptSrcElem: scriptSrc,
    mediaSrc: ["'self'", 'data:', 'blob:'],
    imgSrc: ["'self'", 'data:', 'blob:', RAZORPAY],
    connectSrc: ["'self'", RAZORPAY],
    frameSrc: ["'self'", RAZORPAY],
    formAction: ["'self'", RAZORPAY],
    styleSrc: ["'self'", "'unsafe-inline'", GOOGLE_FONTS],
    fontSrc: ["'self'", 'data:', GOOGLE_FONTS, GOOGLE_FONTS_STATIC],
    workerSrc: ["'self'", 'blob:'],
  };
}
