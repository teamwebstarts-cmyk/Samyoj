/**
 * Sarvam (and some prompts) sometimes emit XML-style tool markup as plain text
 * instead of structured tool_calls. Never speak that to the customer.
 */

export interface ParsedInlineTool {
  name: string;
  arguments: Record<string, unknown>;
}

const TOOL_BLOCK_RE =
  /<tool_call>\s*([a-zA-Z0-9_]+)([\s\S]*?)<\/tool_call>/gi;

const ARG_RE = /<arg_key>\s*([^<]+?)\s*<\/arg_key>\s*<arg_value>\s*([\s\S]*?)\s*<\/arg_value>/gi;

export function hasOpenToolCallMarkup(text: string): boolean {
  const open = (text.match(/<tool_call>/gi) || []).length;
  const close = (text.match(/<\/tool_call>/gi) || []).length;
  return open > close || /<tool_call>(?![\s\S]*<\/tool_call>)/i.test(text);
}

export function extractInlineToolCalls(text: string): {
  cleanText: string;
  tools: ParsedInlineTool[];
} {
  const tools: ParsedInlineTool[] = [];
  const cleanText = text
    .replace(TOOL_BLOCK_RE, (_full, name: string, body: string) => {
      const args: Record<string, unknown> = {};
      let m: RegExpExecArray | null;
      ARG_RE.lastIndex = 0;
      while ((m = ARG_RE.exec(body)) !== null) {
        const key = m[1].trim();
        const value = m[2].trim();
        args[key] = value;
        // Aliases used by voice agent
        if (key === 'callback_time' || key === 'when') args.when = value;
        if (key === 'reason') args.reason = value;
      }
      tools.push({ name: String(name).trim(), arguments: args });
      return ' ';
    })
    .replace(/<\/?tool_call>/gi, ' ')
    .replace(/<\/?arg_key>/gi, ' ')
    .replace(/<\/?arg_value>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { cleanText, tools };
}

/** Replace professional-brain template tokens before prompting the LLM. */
export function applyBrainPlaceholders(
  text: string,
  vars: { businessName?: string | null; teamName?: string | null }
): string {
  const business = (vars.businessName || '').trim() || 'our business';
  const team = (vars.teamName || '').trim() || 'our team';
  return text
    .replace(/\[BUSINESS_NAME\]/gi, business)
    .replace(/\[TEAM_NAME\]/gi, team);
}
