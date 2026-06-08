function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chunkText(text: string, maxChars = 2000): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + maxChars, cleaned.length);
    if (end < cleaned.length) {
      const breakAt = cleaned.lastIndexOf('. ', end);
      if (breakAt > start + maxChars * 0.5) end = breakAt + 1;
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

export async function fetchUrlText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'WhatsAppBot/1.0 (Knowledge Ingest)' },
    });
    if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);

    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();

    if (contentType.includes('text/html')) {
      return stripHtml(body);
    }
    return body.trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return (result.text || '').replace(/\s+/g, ' ').trim();
  } finally {
    await parser.destroy();
  }
}
