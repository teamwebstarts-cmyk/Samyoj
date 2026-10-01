import { PrismaClient } from '@prisma/client';
import { buildStudioSystemPrompt } from '../src/modules/ai-studio/studio-prompts';
import { fetchStudioPackFromLlm } from '../src/modules/ai-studio/studio-llm';
import { assembleStudioPack } from '../src/modules/ai-studio/assemble-studio-pack';
import { generateHunyuanImage } from '../src/modules/ai-studio/hunyuan-image';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ select: { id: true } });
  if (!org) throw new Error('no org');
  const brief = 'Diwali 20% off Jaipur store. 3-slide Instagram carousel and WhatsApp template.';
  const outputs = ['ig_carousel', 'whatsapp'];
  const systemPrompt = buildStudioSystemPrompt(brief, 'English', outputs, null, []);
  const t0 = Date.now();
  const { pack: raw } = await fetchStudioPackFromLlm({
    organizationId: org.id,
    systemPrompt,
    brief,
  });
  console.log('llm_ms', Date.now() - t0, 'keys', Object.keys(raw));
  const pack = assembleStudioPack(raw, {
    brief,
    language: 'English',
    outputs,
    packId: 'pack_e2e',
  });
  console.log('carousel_slides', (pack.carousel as unknown[])?.length);
  const imgT = Date.now();
  const img = await generateHunyuanImage({
    prompt: String(raw.imagePrompt || brief),
    quality: 'standard',
  });
  console.log('image_ms', Date.now() - imgT, 'size', img.width, img.height, 'ok');
}

main().finally(() => prisma.$disconnect());
