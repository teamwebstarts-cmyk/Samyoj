export function shouldServeSpaShell(method: string, requestPath: string) {
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (
    requestPath.startsWith('/api') ||
    requestPath === '/health' ||
    requestPath.startsWith('/socket.io')
  ) {
    return false;
  }
  return true;
}
