import { mkdirSync, writeFileSync } from 'fs';
import { generateHunyuanImage } from '../src/modules/ai-studio/hunyuan-image';

const outDir = '/workspaces/Samyoj/.run/studio-posters';
mkdirSync(outDir, { recursive: true });

const prompts = [
  'Premium Diwali skincare poster photograph, square. A glass serum bottle on warm marble, gold diyas and marigold petals, soft golden light, rich maroon and cream, no text, no letters, no logo, no watermark.',
  'Jaipur store weekend sale photograph, square. Elegant skincare bottles arranged with a silk gift box and fresh flowers, festive but clean, natural window light, no text, no letters, no logo, no watermark.',
];

async function save(i: number, prompt: string) {
  const started = Date.now();
  const generated = await generateHunyuanImage({ prompt, quality: 'standard' });
  const file = await fetch(generated.url);
  if (!file.ok) throw new Error(`download ${file.status}`);
  const path = `${outDir}/poster-${i}.png`;
  writeFileSync(path, Buffer.from(await file.arrayBuffer()));
  console.log(JSON.stringify({ i, ms: Date.now() - started, width: generated.width, height: generated.height, path }));
}

Promise.all(prompts.map((prompt, i) => save(i + 1, prompt))).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
