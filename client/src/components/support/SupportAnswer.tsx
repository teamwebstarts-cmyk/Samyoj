import { Fragment, type ReactNode } from 'react';

function inlineNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(<Fragment key={key++}>{text.slice(last, match.index)}</Fragment>);
    }
    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key++} className="font-extrabold text-theme-fg">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <code
          key={key++}
          className="rounded-md bg-theme-subtle px-1 py-0.5 font-mono text-[12px] font-semibold text-theme-secondary"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  }
  return nodes;
}

function stripNumber(line: string) {
  return line.replace(/^\s*\d+\.\s+/, '');
}

function stripBullet(line: string) {
  return line.replace(/^\s*[-*]\s+/, '');
}

function isNumbered(line: string) {
  return /^\s*\d+\.\s+\S/.test(line);
}

function isBullet(line: string) {
  return /^\s*[-*]\s+\S/.test(line);
}

/** Renders Help Center replies: numbered points, bold labels, no raw ** stars. */
export default function SupportAnswer({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (isNumbered(line)) {
      const items: string[] = [];
      while (i < lines.length && isNumbered(lines[i])) {
        items.push(stripNumber(lines[i]));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="mt-2 list-decimal space-y-1.5 pl-4 marker:font-bold marker:text-theme-muted">
          {items.map((item, idx) => (
            <li key={idx} className="pl-1">
              {inlineNodes(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(stripBullet(lines[i]));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="mt-2 list-disc space-y-1.5 pl-4 marker:text-theme-muted">
          {items.map((item, idx) => (
            <li key={idx} className="pl-1">
              {inlineNodes(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isNumbered(lines[i]) && !isBullet(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className={blocks.length === 0 ? undefined : 'mt-2'}>
        {inlineNodes(para.join(' '))}
      </p>
    );
  }

  return <div className="text-[13.5px] font-medium leading-relaxed text-theme-fg">{blocks}</div>;
}
