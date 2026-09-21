import { describe, expect, it } from 'vitest';
import { helmetContentSecurityPolicyDirectives } from './csp';

describe('helmetContentSecurityPolicyDirectives', () => {
  it('allows Razorpay checkout script, iframe, and API calls', () => {
    const d = helmetContentSecurityPolicyDirectives(true);
    expect(d.scriptSrc).toContain('https://*.razorpay.com');
    expect(d.scriptSrcElem).toContain('https://*.razorpay.com');
    expect(d.frameSrc).toContain('https://*.razorpay.com');
    expect(d.fontSrc).toContain('https://fonts.gstatic.com');
    expect(d.styleSrc).toContain('https://fonts.googleapis.com');
    expect(d.workerSrc).toContain('blob:');
    expect(d.connectSrc).toContain("'self'");
    expect(d.connectSrc).toContain('https://*.razorpay.com');
  });

  it('allows Facebook JS SDK (Embedded Signup) script, XHR, and frames', () => {
    const d = helmetContentSecurityPolicyDirectives(true);
    expect(d.scriptSrc).toContain('https://connect.facebook.net');
    expect(d.scriptSrcElem).toContain('https://connect.facebook.net');
    expect(d.connectSrc).toContain('https://connect.facebook.net');
    expect(d.connectSrc).toContain('https://*.facebook.com');
    expect(d.frameSrc).toContain('https://connect.facebook.net');
    expect(d.frameSrc).toContain('https://*.facebook.com');
  });

  it('does not force HTTPS upgrades on HTTP deploys', () => {
    expect(helmetContentSecurityPolicyDirectives(false).upgradeInsecureRequests).toBeNull();
    expect(helmetContentSecurityPolicyDirectives(true).upgradeInsecureRequests).toEqual([]);
  });
});
