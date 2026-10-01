export function thumbnailFetchUrl(sourceUrl: string, pageAccessToken: string): string {
  const url = new URL(sourceUrl);
  const host = url.hostname.toLowerCase();
  const isGraph = host === 'graph.facebook.com' || host.endsWith('.facebook.com');
  const isCdn = host.includes('cdninstagram') || host.includes('fbcdn.net');
  if (isCdn) return sourceUrl;
  if (isGraph && !url.searchParams.has('access_token')) {
    url.searchParams.set('access_token', pageAccessToken);
    return url.toString();
  }
  return sourceUrl;
}
