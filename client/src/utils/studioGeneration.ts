import type { Pack } from '../components/ai-studio/data/types';

/**
 * AI Studio generation lives outside the page component so it keeps running
 * when the user switches screens. The open page subscribes and paints the result.
 */
export type StudioJob = {
  status: 'running' | 'done' | 'error';
  inPlace: boolean;
  step: number;
  error?: string;
  pack?: Pack;
};

type Listener = () => void;

let job: StudioJob | null = null;
let signal = { cancelled: false };
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getStudioJob(): StudioJob | null {
  return job;
}

export function subscribeStudioJob(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function cancelStudioJob() {
  signal.cancelled = true;
  job = null;
  emit();
}

export function acknowledgeStudioJob() {
  if (!job || job.status === 'running') return;
  job = null;
  emit();
}

export function startStudioJob(
  inPlace: boolean,
  run: (isCancelled: () => boolean, reportStep: (step: number) => void) => Promise<Pack>,
) {
  signal.cancelled = true;
  signal = { cancelled: false };
  const mine = signal;
  job = { status: 'running', inPlace, step: 0 };
  emit();
  void run(
    () => mine.cancelled,
    (step) => {
      if (mine.cancelled || signal !== mine) return;
      job = { status: 'running', inPlace, step };
      emit();
    },
  )
    .then((pack) => {
      if (mine.cancelled || signal !== mine) return;
      job = { status: 'done', inPlace, step: 4, pack };
      emit();
    })
    .catch((error: unknown) => {
      if (mine.cancelled || signal !== mine) return;
      if (error instanceof Error && error.message === 'cancelled') {
        job = null;
        emit();
        return;
      }
      job = {
        status: 'error',
        inPlace,
        step: 0,
        error: error instanceof Error ? error.message : 'Generation failed',
      };
      emit();
    });
}
