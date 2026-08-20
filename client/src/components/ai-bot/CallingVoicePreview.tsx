import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react';
import { socketBaseUrl } from '../../services/utils';
import { ensureFreshAccessToken } from '../../services/api';
import { getAccessToken, getRefreshToken } from '../../utils/authStorage';
import { getActiveWhatsappNumberId } from '../../services/api';
import { MicPcmCapture } from '../../utils/micPcmCapture';
import AppButton from '../ui/AppButton';
import { toastError } from '../../utils/toast';

type PreviewPhase = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

type TranscriptLine = { role: 'user' | 'assistant' | 'partial'; text: string };

export interface CallingVoicePreviewProps {
  botId?: string;
  name: string;
  instructions: string;
  voiceGreeting?: string;
  voiceSpeaker?: string;
  voiceLanguage?: string;
  previewKnowledge?: Array<{ title: string; content: string }>;
  disabled?: boolean;
}

function playBase64Audio(
  audioBase64: string,
  contentType: string,
  previous?: HTMLAudioElement | null
): HTMLAudioElement {
  previous?.pause();
  if (previous?.src.startsWith('blob:')) URL.revokeObjectURL(previous.src);
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: contentType || 'audio/wav' }));
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  audio.onerror = () => URL.revokeObjectURL(url);
  return audio;
}

function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export default function CallingVoicePreview({
  botId,
  name,
  instructions,
  voiceGreeting,
  voiceSpeaker,
  voiceLanguage,
  previewKnowledge,
  disabled = false,
}: CallingVoicePreviewProps) {
  const [phase, setPhase] = useState<PreviewPhase>('idle');
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const micRef = useRef<MicPcmCapture | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef(false);

  const stopSession = useCallback(async () => {
    activeRef.current = false;
    micRef.current?.setMuted(false);
    await micRef.current?.stop();
    micRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    socketRef.current?.emit('calling-preview:stop');
    socketRef.current?.disconnect();
    socketRef.current = null;
    setPhase('idle');
  }, []);

  useEffect(() => {
    return () => {
      void stopSession();
    };
  }, [stopSession]);

  const startSession = async () => {
    if (activeRef.current || disabled) return;
    if (!name.trim()) {
      toastError('Add a bot name in About first.');
      return;
    }
    if (instructions.trim().length < 8) {
      toastError('Add business details in About, or write a personality.');
      return;
    }
    if (!getAccessToken() && !getRefreshToken()) {
      toastError('Sign in again to use live preview.');
      return;
    }

    setError(null);
    setLines([]);
    setPhase('connecting');
    activeRef.current = true;

    try {
      await ensureFreshAccessToken();
      const socket = io(socketBaseUrl, {
        auth: {
          token: getAccessToken() || '',
          whatsappNumberId: getActiveWhatsappNumberId() || undefined,
        },
        withCredentials: true,
        transports: import.meta.env.DEV ? ['polling', 'websocket'] : ['websocket', 'polling'],
        reconnection: false,
      });
      socketRef.current = socket;

      socket.on('calling-preview:ready', async () => {
        if (!activeRef.current) return;
        try {
          const mic = new MicPcmCapture();
          micRef.current = mic;
          await mic.start((samples, sampleRate) => {
            if (!activeRef.current) return;
            socket.emit('calling-preview:audio', {
              pcmBase64: int16ToBase64(samples),
              sampleRate,
            });
          });
          setPhase('listening');
        } catch {
          setError('Microphone access is required for live preview.');
          setPhase('error');
          void stopSession();
        }
      });

      socket.on('calling-preview:partial', ({ text }: { text: string }) => {
        if (!activeRef.current) return;
        setLines((prev) => {
          const withoutPartial = prev.filter((line) => line.role !== 'partial');
          return [...withoutPartial, { role: 'partial', text }];
        });
      });

      socket.on('calling-preview:user', ({ text }: { text: string }) => {
        if (!activeRef.current) return;
        setLines((prev) => [
          ...prev.filter((line) => line.role !== 'partial'),
          { role: 'user', text },
        ]);
      });

      socket.on('calling-preview:assistant', async (payload: {
        text: string;
        audioBase64: string;
        contentType: string;
      }) => {
        if (!activeRef.current) return;
        setLines((prev) => [...prev.filter((line) => line.role !== 'partial'), { role: 'assistant', text: payload.text }]);
        setPhase('speaking');
        micRef.current?.setMuted(true);
        try {
          const audio = playBase64Audio(payload.audioBase64, payload.contentType, audioRef.current);
          audioRef.current = audio;
          await audio.play();
          socket.emit('calling-preview:playback-ended');
        } catch {
          socket.emit('calling-preview:playback-ended');
        } finally {
          micRef.current?.setMuted(false);
          if (activeRef.current) setPhase('listening');
        }
      });

      socket.on('calling-preview:state', ({ phase: next }: { phase: 'listening' | 'thinking' | 'speaking' }) => {
        if (!activeRef.current) return;
        if (next === 'thinking') setPhase('thinking');
        else if (next === 'listening') setPhase('listening');
        else if (next === 'speaking') setPhase('speaking');
      });

      socket.on('calling-preview:error', ({ message }: { message: string }) => {
        setError(message);
        setPhase('error');
        toastError(message);
      });

      socket.on('connect_error', () => {
        setError('Could not connect for live preview.');
        setPhase('error');
        void stopSession();
      });

      socket.on('disconnect', () => {
        if (activeRef.current) {
          activeRef.current = false;
          setPhase('idle');
        }
      });

      await new Promise<void>((resolve, reject) => {
        if (socket.connected) {
          resolve();
          return;
        }
        const timer = window.setTimeout(() => reject(new Error('Socket connect timeout')), 12_000);
        socket.once('connect', () => {
          window.clearTimeout(timer);
          resolve();
        });
        socket.once('connect_error', (err) => {
          window.clearTimeout(timer);
          reject(err);
        });
      });

      socket.emit('calling-preview:start', {
        botId,
        name: name.trim(),
        instructions: instructions.trim(),
        voiceGreeting: voiceGreeting?.trim() || null,
        voiceSpeaker: voiceSpeaker || null,
        voiceLanguage: voiceLanguage || null,
        previewKnowledge,
        whatsappNumberId: getActiveWhatsappNumberId() || undefined,
      });
    } catch {
      setError('Could not start live preview.');
      setPhase('error');
      await stopSession();
    }
  };

  const statusLabel =
    phase === 'connecting'
      ? 'Connecting…'
      : phase === 'listening'
        ? 'Listening — speak naturally'
        : phase === 'thinking'
          ? 'Thinking…'
          : phase === 'speaking'
            ? 'Agent speaking'
            : phase === 'error'
              ? 'Stopped'
              : 'Ready';

  const live =
    phase === 'listening' || phase === 'thinking' || phase === 'speaking';

  return (
    <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-4 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-theme-fg">Talk live</p>
          <p className="mt-0.5 text-[11px] font-medium text-theme-muted">
            Real voice test — same Sarvam STT, brain, and voice as live WhatsApp calls.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!live ? (
            <AppButton
              type="button"
              size="sm"
              icon={<Mic className="h-3.5 w-3.5" />}
              disabled={disabled || phase === 'connecting'}
              loading={phase === 'connecting'}
              onClick={() => void startSession()}
            >
              Start talking
            </AppButton>
          ) : (
            <AppButton
              type="button"
              size="sm"
              variant="secondary"
              icon={<PhoneOff className="h-3.5 w-3.5" />}
              onClick={() => void stopSession()}
            >
              End
            </AppButton>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-theme-border/70 bg-white/70 px-3 py-2 dark:bg-neutral-900/50">
        {phase === 'thinking' || phase === 'connecting' ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
        ) : live ? (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        ) : (
          <MicOff className="h-4 w-4 shrink-0 text-theme-muted" />
        )}
        <p className="text-[12px] font-semibold text-theme-secondary">{statusLabel}</p>
      </div>

      {error ? (
        <p className="mt-2 text-[12px] font-medium text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}

      {lines.length > 0 ? (
        <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-theme-border/60 bg-white/60 p-2.5 dark:bg-neutral-900/40">
          {lines.map((line, index) => (
            <li
              key={`${line.role}-${index}`}
              className={`text-[12px] leading-relaxed ${
                line.role === 'user'
                  ? 'text-right font-medium text-theme-fg'
                  : line.role === 'partial'
                    ? 'italic text-theme-muted'
                    : 'text-theme-secondary'
              }`}
            >
              {line.role === 'assistant' ? `Agent: ${line.text}` : line.role === 'user' ? `You: ${line.text}` : line.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
