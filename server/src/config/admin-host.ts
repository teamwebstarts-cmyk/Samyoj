export function isPlatformAdminHost(hostHeader: string | undefined, platformAdminUrl: string): boolean {
  if (!hostHeader) return false;
  let admin: URL;
  let incoming: URL;
  try {
    admin = new URL(platformAdminUrl);
    incoming = hostHeader.includes('://')
      ? new URL(hostHeader)
      : new URL(`${admin.protocol}//${hostHeader}`);
  } catch {
    return false;
  }

  if (incoming.hostname.toLowerCase() !== admin.hostname.toLowerCase()) {
    return false;
  }

  const incomingPort = incoming.port || (incoming.protocol === 'https:' ? '443' : '80');
  const adminPort = admin.port || (admin.protocol === 'https:' ? '443' : '80');
  return incomingPort === adminPort;
}
