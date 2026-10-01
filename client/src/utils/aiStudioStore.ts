import type { Draft, Pack } from '../components/ai-studio/data/types';

/**
 * Client-side persistence for AI Studio drafts and generation history.
 *
 * Production-ready behaviour without a hard backend dependency: drafts and
 * history survive refresh (localStorage). The API layer can additionally sync
 * server-side when the AI Studio endpoints exist (see aiStudioApi).
 */

const STORE_KEY = 'samyoj-ai-studio-v1';
const HISTORY_LIMIT = 60;

export type HistoryOrigin = 'generation' | 'draft' | 'handoff';

export interface HistoryEntry {
  id: string;
  name: string;
  pack: Pack;
  savedAt: number;
  origin: HistoryOrigin;
}

interface StudioStore {
  version: 1;
  drafts: Draft[];
  history: HistoryEntry[];
}

const EMPTY_STORE: StudioStore = { version: 1, drafts: [], history: [] };

export function readStudioStore(): StudioStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...EMPTY_STORE, drafts: [], history: [] };
    const parsed = JSON.parse(raw) as Partial<StudioStore>;
    return {
      version: 1,
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { ...EMPTY_STORE, drafts: [], history: [] };
  }
}

function writeStore(store: StudioStore): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or unavailable — in-memory state keeps working */
  }
}

/* ------------------------------ drafts ------------------------------ */

export function loadStoredDrafts(): Draft[] {
  return readStudioStore().drafts;
}

export function persistDrafts(drafts: Draft[]): void {
  writeStore({ ...readStudioStore(), drafts });
}

export function deleteStoredDraft(id: string): Draft[] {
  const drafts = loadStoredDrafts().filter((d) => d.id !== id);
  persistDrafts(drafts);
  return drafts;
}

/* ------------------------------ history ------------------------------ */

export function loadStoredHistory(): HistoryEntry[] {
  return readStudioStore().history;
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const history = [entry, ...loadStoredHistory().filter((h) => h.id !== entry.id)].slice(0, HISTORY_LIMIT);
  writeStore({ ...readStudioStore(), history });
  return history;
}

export function persistHistory(history: HistoryEntry[]): void {
  writeStore({ ...readStudioStore(), history });
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  const history = loadStoredHistory().filter((h) => h.id !== id);
  writeStore({ ...readStudioStore(), history });
  return history;
}

export function clearStoredHistory(): HistoryEntry[] {
  writeStore({ ...readStudioStore(), history: [] });
  return [];
}

const WORKSPACE_KEY = 'samyoj-ai-studio-workspace';

export function loadWorkspace(): { pack: Pack; screen: 'review' | 'saved' } | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { pack?: Pack; screen?: string };
    if (!parsed.pack?.id || !parsed.pack.brief) return null;
    return { pack: parsed.pack, screen: parsed.screen === 'saved' ? 'saved' : 'review' };
  } catch {
    return null;
  }
}

export function saveWorkspace(pack: Pack, screen: 'review' | 'saved'): void {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ pack, screen }));
  } catch {
    /* storage full */
  }
}

export function clearWorkspace(): void {
  try {
    localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    /* ignore */
  }
}
