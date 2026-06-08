import wrtc from '@roamhq/wrtc';
import { createModuleLogger } from '../../utils/logger';
import { pcmBytesToInt16 } from './google-tts.service';

const log = createModuleLogger('webrtc-bridge');

const { RTCPeerConnection, RTCSessionDescription } = wrtc;
const { RTCAudioSource, RTCAudioSink } = wrtc.nonstandard;

type MediaStreamTrack = ReturnType<InstanceType<typeof RTCAudioSource>['createTrack']>;
type MediaStream = { getAudioTracks(): MediaStreamTrack[] };

interface AudioSinkData {
  samples: Int16Array;
  sampleRate: number;
  bitsPerSample?: number;
  channelCount?: number;
  numberOfFrames?: number;
}

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export type AudioFrameHandler = (samples: Int16Array, sampleRate: number) => void;

function waitForIceGathering(pc: InstanceType<typeof RTCPeerConnection>, timeoutMs = 5000): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      resolve();
    }, timeoutMs);

    const onChange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', onChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onChange);
  });
}

function normalizeSdpFingerprint(sdp: string): string {
  return sdp.replace(/a=fingerprint:sha-256/gi, 'a=fingerprint:SHA-256');
}

function toMonoInt16(samples: Int16Array, channelCount: number, numberOfFrames?: number): Int16Array {
  if (channelCount <= 1) return samples;

  const frames = numberOfFrames ?? Math.floor(samples.length / channelCount);
  const mono = new Int16Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let ch = 0; ch < channelCount; ch++) {
      sum += samples[i * channelCount + ch] ?? 0;
    }
    mono[i] = Math.max(-32768, Math.min(32767, Math.round(sum / channelCount)));
  }
  return mono;
}

function normalizeInboundSamples(data: AudioSinkData): Int16Array {
  const raw = data.samples;
  let samples: Int16Array;

  if (raw instanceof Int16Array && raw.byteOffset % 2 === 0) {
    samples = raw;
  } else {
    samples = pcmBytesToInt16(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength));
  }

  const channels = data.channelCount ?? 1;
  return toMonoInt16(samples, channels, data.numberOfFrames);
}

export class WhatsAppWebRtcBridge {
  private pc: InstanceType<typeof RTCPeerConnection> | null = null;
  private audioSource: InstanceType<typeof RTCAudioSource> | null = null;
  private audioSink: InstanceType<typeof RTCAudioSink> | null = null;
  private onAudioFrame: AudioFrameHandler | null = null;
  private playbackQueue: Int16Array[] = [];
  private playbackInterval: ReturnType<typeof setInterval> | null = null;
  private inboundFrames = 0;
  private readonly sampleRate = 48000;
  /** @roamhq/wrtc RTCAudioSource requires exactly 10ms frames (480 samples @ 48kHz). */
  private readonly frameSize = 480;
  private readonly frameIntervalMs = 10;

  setAudioHandler(handler: AudioFrameHandler): void {
    this.onAudioFrame = handler;
  }

  async createOffer(): Promise<string> {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.audioSource = new RTCAudioSource();
    const outboundTrack = this.audioSource.createTrack();
    this.pc.addTrack(outboundTrack);

    this.pc.ontrack = (event: { track: MediaStreamTrack; streams: MediaStream[] }) => {
      const [track] = event.streams[0]?.getAudioTracks() || [event.track];
      if (!track) return;

      this.audioSink?.stop();
      this.audioSink = new RTCAudioSink(track);
      this.audioSink.ondata = (data: AudioSinkData) => {
        const samples = normalizeInboundSamples(data);
        this.inboundFrames += 1;
        this.onAudioFrame?.(samples, data.sampleRate);
      };
    };

    const offer = await (this.pc as unknown as { createOffer: () => Promise<{ type: string; sdp?: string }> }).createOffer();
    await this.pc.setLocalDescription(offer);
    await waitForIceGathering(this.pc);

    const localSdp = this.pc.localDescription?.sdp;
    if (!localSdp) throw new Error('Failed to generate WebRTC SDP offer');

    this.startPlaybackLoop();
    return normalizeSdpFingerprint(localSdp);
  }

  async createAnswerFromOffer(sdpOffer: string): Promise<string> {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.audioSource = new RTCAudioSource();
    const outboundTrack = this.audioSource.createTrack();
    this.pc.addTrack(outboundTrack);

    this.pc.ontrack = (event: { track: MediaStreamTrack; streams: MediaStream[] }) => {
      const [track] = event.streams[0]?.getAudioTracks() || [event.track];
      if (!track) return;

      this.audioSink?.stop();
      this.audioSink = new RTCAudioSink(track);
      this.audioSink.ondata = (data: AudioSinkData) => {
        const samples = normalizeInboundSamples(data);
        this.inboundFrames += 1;
        if (this.inboundFrames === 1 || this.inboundFrames % 500 === 0) {
          log.debug('Inbound caller audio', {
            frames: this.inboundFrames,
            sampleRate: data.sampleRate,
            channelCount: data.channelCount ?? 1,
            samples: samples.length,
          });
        }
        this.onAudioFrame?.(samples, data.sampleRate);
      };
      log.debug('Inbound audio track attached');
    };

    this.pc.onconnectionstatechange = () => {
      log.debug('WebRTC connection state', { state: this.pc?.connectionState });
    };

    await this.pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: sdpOffer })
    );
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await waitForIceGathering(this.pc);

    const localSdp = this.pc.localDescription?.sdp;
    if (!localSdp) {
      throw new Error('Failed to generate WebRTC SDP answer');
    }

    this.startPlaybackLoop();
    return normalizeSdpFingerprint(localSdp);
  }

  private startPlaybackLoop(): void {
    if (this.playbackInterval) return;

    this.playbackInterval = setInterval(() => {
      if (!this.audioSource) return;

      try {
        let frame: Int16Array;
        if (this.playbackQueue.length > 0) {
          frame = this.playbackQueue.shift()!;
        } else {
          frame = new Int16Array(this.frameSize);
        }

        if (frame.length !== this.frameSize) {
          const padded = new Int16Array(this.frameSize);
          padded.set(frame.subarray(0, Math.min(frame.length, this.frameSize)));
          frame = padded;
        }

        this.audioSource.onData({
          samples: frame,
          sampleRate: this.sampleRate,
          bitsPerSample: 16,
          channelCount: 1,
          numberOfFrames: this.frameSize,
        });
      } catch (err) {
        log.error('Audio playback frame failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }, this.frameIntervalMs);
  }

  async playPcm(samples: Int16Array, sampleRate: number): Promise<void> {
    const targetRate = this.sampleRate;
    let pcm = samples;
    if (sampleRate !== targetRate) {
      const ratio = sampleRate / targetRate;
      const outLen = Math.floor(samples.length / ratio);
      const resampled = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        resampled[i] = samples[Math.floor(i * ratio)] ?? 0;
      }
      pcm = resampled;
    }

    for (let offset = 0; offset < pcm.length; offset += this.frameSize) {
      const chunk = pcm.subarray(offset, offset + this.frameSize);
      const frame = new Int16Array(this.frameSize);
      frame.set(chunk);
      this.playbackQueue.push(frame);
    }

    const durationMs = (pcm.length / targetRate) * 1000;
    await new Promise((resolve) => setTimeout(resolve, durationMs + 100));
  }

  close(): void {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    this.playbackQueue = [];
    this.audioSink?.stop();
    this.audioSink = null;
    this.pc?.close();
    this.pc = null;
    this.audioSource = null;
    log.debug('WebRTC bridge closed', { inboundFrames: this.inboundFrames });
  }
}
