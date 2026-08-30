const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DEV_CLIENT_PORT = '3000';

type PageLocation = Pick<Location, 'protocol' | 'hostname'> & { port?: string };

function isLocalHost(hostname: string): boolean {
  return LOCAL_HTTP_HOSTS.has(hostname);
}

function httpPort(location: PageLocation): string {
  if (location.port) return location.port;
  return location.protocol === 'https:' ? '443' : '80';
}

/** FB.login() (Embedded Signup v4) only works on https. */
export function canUseFacebookJsSdk(location: PageLocation): boolean {
  return location.protocol === 'https:';
}

export function facebookLoginHttpsBlockedReason(
  location: PageLocation,
  codespaceHttpsOrigin = '',
): string | null {
  if (location.protocol === 'https:') return null;

  const origin = codespaceHttpsOrigin.replace(/\/$/, '');
  if (isLocalHost(location.hostname) && origin) {
    const port = httpPort(location);
    if (port !== DEV_CLIENT_PORT) {
      return `Facebook will not finish WhatsApp Connect on this http://localhost tab (port forwarding). Open ${origin} then click Connect WhatsApp.`;
    }
    return `Facebook will not finish WhatsApp Connect on http://. Open ${origin} (HTTPS preview), then click Connect WhatsApp again.`;
  }
  if (isLocalHost(location.hostname)) {
    return 'Facebook will not finish WhatsApp Connect on http://. In Ports, open port 3000 with the HTTPS preview URL, then try Connect again.';
  }
  return 'Facebook will not finish WhatsApp Connect on an insecure http page. Open Samyoj over https and try again.';
}
