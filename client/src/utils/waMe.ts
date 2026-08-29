export function digitsOnlyPhone(input: string): string {
  return String(input || '').replace(/\D/g, '');
}

export function buildWaMeUrl(phone: string, text = ''): string {
  const digits = digitsOnlyPhone(phone);
  if (!digits) return '';
  const trimmed = text.trim();
  if (!trimmed) return `https://wa.me/${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(trimmed)}`;
}

export function buildWaMeSnippet(options: {
  phone: string;
  label?: string;
  text?: string;
  color?: string;
  position?: 'br' | 'bl';
}): string {
  const href = buildWaMeUrl(options.phone, options.text || '');
  const label = options.label?.trim() || 'Chat on WhatsApp';
  const color = options.color || '#25D366';
  const position = options.position === 'bl' ? 'left:16px' : 'right:16px';
  return `<!-- Samyoj WhatsApp button. Official wa.me link. No Meta application credentials. -->
<a href="${href}" target="_blank" rel="noopener noreferrer" style="position:fixed;bottom:16px;${position};z-index:9999;background:${color};color:#fff;font:600 14px/1 system-ui,sans-serif;padding:12px 16px;border-radius:999px;text-decoration:none;box-shadow:0 8px 24px rgba(15,23,42,.18);">${label}</a>`;
}
