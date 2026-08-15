import { describe, expect, it } from 'vitest';
import { isUsableWhatsAppIceCandidate, sanitizeWhatsAppSdp } from './whatsapp-sdp';

const chromeOffer = [
  'v=0',
  'o=- 1 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0 1',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111 126',
  'c=IN IP4 0.0.0.0',
  'a=rtcp:9 IN IP4 0.0.0.0',
  'a=ice-ufrag:abcd',
  'a=ice-pwd:abcdefghijklmnopqrstuvwx',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 AA:BB:CC',
  'a=fingerprint:sha-384 DD:EE:FF',
  'a=setup:actpass',
  'a=mid:0',
  'a=sendrecv',
  'a=rtcp-mux',
  'a=rtpmap:111 opus/48000/2',
  'a=rtpmap:126 telephone-event/8000',
  'a=candidate:1 1 udp 2130706431 192.168.1.5 54000 typ host',
  'a=candidate:2 1 udp 2130706430 2001:db8::1 54001 typ host',
  'a=candidate:3 1 tcp 1518280447 192.168.1.5 9 typ host tcptype active',
  'a=candidate:4 1 udp 1686052863 abcdef.local 54000 typ host',
  'a=end-of-candidates',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'a=mid:1',
  'a=recvonly',
  'a=rtpmap:111 opus/48000/2',
  'm=video 9 UDP/TLS/RTP/SAVPF 96',
  'a=mid:2',
  'a=inactive',
  '',
].join('\n');

describe('WhatsApp SDP sanitize', () => {
  it('keeps a single sendrecv audio m-line with CRLF and SHA-256 fingerprint', () => {
    const out = sanitizeWhatsAppSdp(chromeOffer, 'offer');
    expect(out.endsWith('\r\n')).toBe(true);
    expect(out).toContain('\r\n');
    expect(out).toContain('a=fingerprint:SHA-256 AA:BB:CC');
    expect(out).not.toMatch(/sha-384/i);
    expect(out).not.toMatch(/extmap-allow-mixed/i);
    expect(out.match(/^m=audio /gm)?.length).toBe(1);
    expect(out).not.toMatch(/^m=video /m);
    expect(out).toContain('a=group:BUNDLE 0');
    expect(out).toContain('a=ptime:20');
    expect(out).toContain('a=sendrecv');
    expect(out).not.toContain('recvonly');
  });

  it('drops mDNS, TCP, and IPv6 ICE candidates', () => {
    const out = sanitizeWhatsAppSdp(chromeOffer, 'offer');
    expect(out).toContain('192.168.1.5');
    expect(out).not.toContain('.local');
    expect(out).not.toContain('2001:db8');
    expect(out).not.toMatch(/\btcp\b/i);
    expect(isUsableWhatsAppIceCandidate('a=candidate:4 1 udp 1 abcdef.local 9 typ host')).toBe(false);
    expect(isUsableWhatsAppIceCandidate('a=candidate:1 1 udp 1 1.2.3.4 9 typ host')).toBe(true);
  });

  it('does not drop extra m-lines on answers so they still match Meta offers', () => {
    const answer = [
      'v=0',
      'o=- 1 2 IN IP4 127.0.0.1',
      's=-',
      't=0 0',
      'm=audio 9 UDP/TLS/RTP/SAVPF 111',
      'a=mid:0',
      'a=sendrecv',
      'a=fingerprint:sha-256 AA:BB',
      '',
    ].join('\n');
    const out = sanitizeWhatsAppSdp(answer, 'answer');
    expect(out).toContain('m=audio');
    expect(out).toContain('a=fingerprint:SHA-256 AA:BB');
    expect(out).toContain('\r\n');
  });
});
