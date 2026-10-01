import { generateHunyuanImage } from './hunyuan-image';

async function main() {
  const started = Date.now();
  const out = await generateHunyuanImage({
    prompt: 'A small ceramic tea cup on a linen table, soft morning light, no text, product photo',
    quality: 'standard',
  });
  console.log(JSON.stringify({
    ok: out.url.startsWith('https://'),
    ms: Date.now() - started,
    width: out.width ?? null,
    height: out.height ?? null,
    requestId: out.requestId ?? null,
  }));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
