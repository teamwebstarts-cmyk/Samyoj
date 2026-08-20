function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i] ?? 0));
    out[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return out;
}

function resamplePcm(samples: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const srcIndex = Math.min(samples.length - 1, Math.floor(i * ratio));
    out[i] = samples[srcIndex] ?? 0;
  }
  return out;
}

export class MicPcmCapture {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muted = false;

  async start(onChunk: (samples: Int16Array, sampleRate: number) => void): Promise<void> {
    await this.stop();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    const context = new AudioContext({ latencyHint: 'interactive' });
    await context.resume();

    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const targetRate = 16000;

    processor.onaudioprocess = (event) => {
      if (this.muted) return;
      const channel = event.inputBuffer.getChannelData(0);
      let pcm = floatToInt16(channel);
      if (context.sampleRate !== targetRate) {
        pcm = resamplePcm(pcm, context.sampleRate, targetRate);
      }
      onChunk(pcm, targetRate);
    };

    source.connect(processor);
    processor.connect(context.destination);

    this.stream = stream;
    this.context = context;
    this.source = source;
    this.processor = processor;
    this.muted = false;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  async stop(): Promise<void> {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.context) {
      await this.context.close().catch(() => undefined);
    }
    this.context = null;
    this.muted = false;
  }
}
