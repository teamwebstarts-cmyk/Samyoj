declare module '@roamhq/wrtc' {
  export class RTCPeerConnection {
    constructor(config?: { iceServers?: Array<{ urls: string }> });
    iceGatheringState: string;
    connectionState: string;
    localDescription: RTCSessionDescription | null;
    ontrack: ((event: RTCTrackEvent) => void) | null;
    onconnectionstatechange: (() => void) | null;
    addTrack(track: MediaStreamTrack): void;
    setRemoteDescription(desc: RTCSessionDescription): Promise<void>;
    createAnswer(): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void>;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
    close(): void;
  }

  export class RTCSessionDescription {
    constructor(init: RTCSessionDescriptionInit);
    type: RTCSdpType;
    sdp: string;
  }

  export interface RTCSessionDescriptionInit {
    type: RTCSdpType;
    sdp?: string;
  }

  export type RTCSdpType = 'offer' | 'answer' | 'pranswer' | 'rollback';

  export interface RTCTrackEvent {
    track: MediaStreamTrack;
    streams: MediaStream[];
  }

  export interface MediaStream {
    getAudioTracks(): MediaStreamTrack[];
  }

  export interface MediaStreamTrack {
    kind: string;
  }

  export namespace nonstandard {
    export class RTCAudioSource {
      createTrack(): MediaStreamTrack;
      onData(data: {
        samples: Int16Array;
        sampleRate: number;
        bitsPerSample: number;
        channelCount: number;
        numberOfFrames: number;
      }): void;
    }

    export class RTCAudioSink {
      constructor(track: MediaStreamTrack);
      ondata: ((data: { samples: Int16Array; sampleRate: number }) => void) | null;
      stop(): void;
    }
  }

  const wrtc: {
    RTCPeerConnection: typeof RTCPeerConnection;
    RTCSessionDescription: typeof RTCSessionDescription;
    nonstandard: typeof nonstandard;
  };

  export default wrtc;
}
