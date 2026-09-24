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
  product: 'WhatsApp' | 'Facebook Page' = 'WhatsApp',
): string | null {
  if (location.protocol === 'https:') return null;

  const action = product === 'WhatsApp' ? 'WhatsApp Connect' : 'Facebook Page connect';
  const button = product === 'WhatsApp' ? 'Connect WhatsApp' : 'Connect Page';
  const origin = codespaceHttpsOrigin.replace(/\/$/, '');
  if (isLocalHost(location.hostname) && origin) {
    const port = httpPort(location);
    if (port !== DEV_CLIENT_PORT) {
      return `Facebook will not finish ${action} on this http://localhost tab (port forwarding). Open ${origin} then click ${button}.`;
    }
    return `Facebook will not finish ${action} on http://. Open ${origin} (HTTPS preview), then click ${button} again.`;
  }
  if (isLocalHost(location.hostname)) {
    return `Facebook will not finish ${action} on http://. In Ports, open port 3000 with the HTTPS preview URL, then try ${button} again.`;
  }
  return `Facebook will not finish ${action} on an insecure http page. Open Samyoj over https and try again.`;
}
