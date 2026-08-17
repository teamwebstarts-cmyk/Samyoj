/** Copy PCM bytes into an aligned Int16Array (Buffer views may have odd byteOffset). */
export function pcmBytesToInt16(data: Buffer | Uint8Array): Int16Array {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const byteLength = buffer.byteLength - (buffer.byteLength % 2);
  if (byteLength === 0) return new Int16Array(0);

  const samples = new Int16Array(byteLength / 2);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = buffer.readInt16LE(i * 2);
  }
  return samples;
}

/** RMS energy for PCM Int16 — used to detect caller barge-in while the bot speaks. */
export function pcmRms(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] ?? 0;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
}

/** Simple linear resampler for PCM Int16 buffers. */
export function resamplePcm(
  input: Int16Array,
  inputRate: number,
  outputRate: number
): Int16Array {
  if (inputRate === outputRate || input.length === 0) return input;
  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    output[i] = input[srcIndex] ?? 0;
  }
  return output;
}
