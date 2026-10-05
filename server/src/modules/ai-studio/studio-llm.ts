// ponytail: AI Studio is intentionally off the SaaS credit ledger (product decision).
import { createChatCompletion, type ChatMessage, type ChatCompletionResult } from '../ai/chat-completion.service';
import { AppError } from '../../utils/response';
import { extractJsonObject } from './studio-prompts';

export async function fetchStudioPackFromLlm(options: {
  organizationId: string;
  systemPrompt: string;
  brief: string;
  whatsappNumberId?: string | null;
}): Promise<{ pack: Record<string, unknown>; result: ChatCompletionResult }> {
  const base: ChatMessage[] = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.brief },
  ];

  const call = (messages: ChatMessage[], temperature: number) =>
    createChatCompletion({
      organizationId: options.organizationId,
      messages,
      maxTokens: 8000,
      temperature,
      usageAction: 'ai_studio',
      whatsappNumberId: options.whatsappNumberId ?? undefined,
      skipCreditCheck: true,
    });

  const first = await call(base, 0.35);
  try {
    return { pack: extractJsonObject(first.content), result: first };
  } catch {
    const repair = await call(
      [
        ...base,
        { role: 'assistant', content: first.content },
        {
          role: 'user',
          content:
            'That reply was not valid JSON. Output exactly one JSON object matching the schema from the system message. No markdown, no code fences, no text before or after the object.',
        },
      ],
      0.15,
    );
    try {
      return { pack: extractJsonObject(repair.content), result: repair };
    } catch {
      throw new AppError(
        502,
        'AI text step returned invalid JSON twice. Try a shorter brief or fewer output types, then generate again.',
      );
    }
  }
}
