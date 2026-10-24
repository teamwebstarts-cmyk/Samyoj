/**
 * Live gate for the PRODUCTION path: import the compiled-logic fetch via a
 * stubbed createSarvamChatCompletion? Simpler: call the real HTTP once, run the
 * reply through the REAL extractJsonObject + extractDraftFragments +
 * normalizeDraft + draftSchema — the exact chain fetchTemplateDraftsFromLlm uses
 * (only the LLM call itself is re-implemented here).
 * Usage: npx tsx scripts/probe-ai-draft-e2e.mjs [prompt] [runs]
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../server/.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const userPrompt = process.argv[2] || 'create a diwali offer message for ecommerce customer';
const runs = Number(process.argv[3] || 6);

// Pull the REAL parsing/normalizing code from the module under test, plus the
// REAL system prompt so the probe mirrors production messages exactly.
const mod = await import('../server/src/modules/platform/ai-draft.ts');
const { extractJsonObject, extractDraftFragments, normalizeDraft, libraryTemplateAiDraftSchema, SYSTEM_PROMPT } = mod;

const parseReply = (raw) => {
  try {
    const parsed = extractJsonObject(raw);
    if (Array.isArray(parsed.clarify) && parsed.clarify.length > 0) return { clarify: parsed.clarify };
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed.drafts) ? parsed.drafts : [parsed];
    return { list };
  } catch {
    return { list: extractDraftFragments(raw) };
  }
};

let totalOk = 0;
let totalDrafts = 0;
let totalClarify = 0;
for (let i = 1; i <= runs; i += 1) {
  const res = await fetch(`${env.SARVAM_CHAT_ENDPOINT || 'https://api.sarvam.ai/v1'}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SARVAM_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.SARVAM_CHAT_MODEL || 'sarvam-105b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 4000,
      frequency_penalty: 0.1,
      reasoning_effort: null,
    }),
  });
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? '';
  const reply = parseReply(content);
  if (reply.clarify) {
    totalClarify += 1;
    console.log(`#${i} CLARIFY (${reply.clarify.length}q): ${reply.clarify.join(' | ')}`);
    continue;
  }
  const list = reply.list;
  if (list.length === 0) {
    // Diagnostic: show what actually came back so failures aren't silent.
    console.log(`#${i} EMPTY reply head: ${JSON.stringify(content.slice(0, 300))}`);
  }
  const valid = list.map((d) => libraryTemplateAiDraftSchema.safeParse(normalizeDraft(d))).filter((r) => r.success);
  totalOk += valid.length > 0 ? 1 : 0;
  totalDrafts += valid.length;
  console.log(`#${i} rawDrafts=${list.length} valid=${valid.length}`);
}
console.log(`SUMMARY runs=${runs} runSurvived=${totalOk} totalValidDrafts=${totalDrafts} clarifyRuns=${totalClarify}`);
