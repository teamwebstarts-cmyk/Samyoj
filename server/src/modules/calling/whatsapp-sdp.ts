/**
 * WhatsApp Cloud Calling SDP must be RFC 8866 with CRLF, a SHA-256 fingerprint,
 * a single audio stream, and no extra DTLS hash lines.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/calling
 */

export type WhatsAppSdpRole = 'offer' | 'answer';

function splitLines(sdp: string): string[] {
  return sdp.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function isIceCandidateLine(line: string): boolean {
  return /^a=candidate:/i.test(line);
}

/** Drop mDNS, TCP, and IPv6 ICE candidates — Meta often rejects them as invalid SDP. */
export function isUsableWhatsAppIceCandidate(line: string): boolean {
  if (!isIceCandidateLine(line)) return true;
  const rest = line.slice('a=candidate:'.length).trim();
  const parts = rest.split(/\s+/);
  if (parts.length < 6) return false;
  const protocol = (parts[2] || '').toUpperCase();
  const address = parts[4] || '';
  if (protocol !== 'UDP' && protocol !== 'UDP4' && protocol !== 'UDP6') return false;
  if (/\.local$/i.test(address)) return false;
  if (address.includes(':')) return false;
  if (/\btcptype\b/i.test(line)) return false;
  return true;
}

function mediaKind(section: string[]): 'audio' | 'video' | 'application' | 'other' {
  const m = section.find((l) => l.startsWith('m='));
  if (!m) return 'other';
  if (m.startsWith('m=audio')) return 'audio';
  if (m.startsWith('m=video')) return 'video';
  if (m.startsWith('m=application')) return 'application';
  return 'other';
}

function hasSend(section: string[]): boolean {
  return section.some((l) => /^a=sendrecv$/i.test(l) || /^a=sendonly$/i.test(l));
}

function midOf(section: string[]): string | null {
  const line = section.find((l) => /^a=mid:/i.test(l));
  if (!line) return null;
  return line.slice(line.indexOf(':') + 1).trim();
}

function splitSections(lines: string[]): { session: string[]; media: string[][] } {
  const session: string[] = [];
  const media: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (line.startsWith('m=')) {
      current = [line];
      media.push(current);
      continue;
    }
    if (current) current.push(line);
    else session.push(line);
  }
  return { session, media };
}

function rewriteBundle(session: string[], media: string[][]): string[] {
  const mids = media.map(midOf).filter((m): m is string => Boolean(m));
  const bundle = `a=group:BUNDLE ${mids.join(' ')}`.trim();
  let replaced = false;
  const out = session.map((line) => {
    if (/^a=group:BUNDLE\b/i.test(line)) {
      replaced = true;
      return mids.length ? bundle : line;
    }
    return line;
  });
  if (!replaced && mids.length) {
    const msidAt = out.findIndex((l) => /^a=msid-semantic:/i.test(l));
    if (msidAt >= 0) out.splice(msidAt, 0, bundle);
    else out.push(bundle);
  }
  return out;
}

function sanitizeLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (/^a=extmap-allow-mixed$/i.test(line)) continue;
    if (/^a=fingerprint:sha-384\b/i.test(line)) continue;
    if (/^a=fingerprint:sha-512\b/i.test(line)) continue;
    if (/^a=fingerprint:sha-256\b/i.test(line)) {
      out.push(line.replace(/^a=fingerprint:sha-256/i, 'a=fingerprint:SHA-256'));
      continue;
    }
    if (isIceCandidateLine(line) && !isUsableWhatsAppIceCandidate(line)) continue;
    out.push(line);
  }
  return out;
}

function ensureAudioPtime(section: string[]): string[] {
  if (mediaKind(section) !== 'audio') return section;
  if (section.some((l) => /^a=ptime:/i.test(l))) return section;
  const rtpmapAt = section.findIndex((l) => /^a=rtpmap:.*opus/i.test(l));
  const insertAt = rtpmapAt >= 0 ? rtpmapAt + 1 : section.length;
  const next = [...section];
  next.splice(insertAt, 0, 'a=ptime:20');
  return next;
}

/**
 * Normalize an SDP string for WhatsApp Cloud Calling Graph `session.sdp`.
 * Offers may drop extra audio/video m-lines. Answers only rewrite attributes
 * so they still match Meta's offer.
 */
export function sanitizeWhatsAppSdp(sdp: string, role: WhatsAppSdpRole = 'offer'): string {
  const trimmed = sdp.trim();
  if (!trimmed) return sdp;

  const { session, media } = splitSections(splitLines(trimmed));
  let keptMedia = media;

  if (role === 'offer') {
    const audio = media.filter((m) => mediaKind(m) === 'audio');
    const preferred = audio.find(hasSend) || audio[0];
    keptMedia = preferred ? [preferred] : [];
  }

  const sessionClean = rewriteBundle(sanitizeLines(session), keptMedia.map(sanitizeLines).map(ensureAudioPtime));
  const mediaClean = keptMedia.map((section) => ensureAudioPtime(sanitizeLines(section)));

  const lines = [...sessionClean, ...mediaClean.flat()];
  return `${lines.join('\r\n')}\r\n`;
}
