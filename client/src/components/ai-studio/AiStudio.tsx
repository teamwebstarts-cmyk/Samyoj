import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { useMetaMock } from "../../contexts/MetaMockContext";
import { useWhatsAppNumber } from "../../contexts/WhatsAppNumberContext";
import { useMetaChannelStatus } from "../layout/MetaChannelChips";
import { useGmailChannelAvailable } from "../email/emailData";
import { aiStudioApi } from "../../services/api";
import type { Channel, Draft, Language, OutputId, Pack, Photo, VisualSet } from "./data/types";
import {
  EXAMPLE_IDEAS,
  buildHandoff,
  buildHandoffState,
  clonePack,
  generateStudioPack,
  mockDrafts,
  refinePack,
  regenerateAll,
  uid,
} from "./data/mock";
import { Compose } from "./Compose";
import { GenerationError, GenerationProgress } from "./Generating";
import { PackView } from "./PackView";
import type { PackTab } from "./PackView";
import { DraftDrawer, ToastHost } from "./Overlays";
import type { ToastItem } from "./Overlays";
import { HandoffModal, NewPackModal, RefineModal } from "./Modals";
import type { HandoffState } from "./Modals";
import { slideToPngFile, slidesToPngUrls } from "../../utils/aiStudioPoster";
import {
  addHistoryEntry,
  clearStoredHistory,
  loadStoredDrafts,
  loadStoredHistory,
  persistDrafts,
  removeHistoryEntry,
  type HistoryEntry,
} from "../../utils/aiStudioStore";
import "../../styles/ai-studio.css";

/**
 * Studio state model (single page, one workspace):
 *   screen: compose (EMPTY / BRIEF_FILLED) → generating → review (GENERATED_REVIEW)
 *           → review edits (regenerate/variant only) → saved (SAVED_DRAFT) ; error (ERROR)
 *   overlays: drafts+history drawer, handoff (warning / opening), refine, new
 *
 * Data model: with Sample data ON the mock engine generates packs; with it OFF
 * the studio calls aiStudioApi and shows a clear error state when the service
 * isn't connected yet. Drafts + history persist in localStorage either way.
 */
type Screen = "compose" | "generating" | "error" | "review" | "saved";
type Overlay = null | "drafts" | "refine" | "new";

const DEFAULT_OUTPUTS: OutputId[] = ["ig_carousel"];

const OPENING_TEXT: Record<Channel, (p: Pack) => string> = {
  instagram: (p) => `Opening Instagram Posts with your ${p.carousel ? "carousel" : "image"}...`,
  whatsapp: () => "Opening WhatsApp Templates with your template draft...",
  email: () => "Opening Email Compose with your content...",
};
const CHANNEL_NAME: Record<Channel, string> = { instagram: "Instagram", whatsapp: "WhatsApp", email: "Gmail" };
/** Deep-link routes that actually receive the hand-off payload. */
const HANDOFF_ROUTE: Record<Channel, string> = {
  instagram: "/instagram/posts",
  whatsapp: "/templates/new",
  email: "/email/compose",
};

export default function AiStudio() {
  const navigate = useNavigate();
  const { enabled: mockEnabled } = useMetaMock();
  const { hasConnectedNumber } = useWhatsAppNumber();
  const { instagram } = useMetaChannelStatus();
  const emailConnected = useGmailChannelAvailable();

  const [screen, setScreen] = useState<Screen>("compose");
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState<Language>("English");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [outputs, setOutputs] = useState<OutputId[]>(DEFAULT_OUTPUTS);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [pack, setPack] = useState<Pack | null>(null);
  const [tab, setTab] = useState<PackTab>("all");
  const [active, setActiveState] = useState<Record<VisualSet, number>>({ carousel: 0, image: 0 });
  const [drafts, setDrafts] = useState<Draft[]>(() => loadStoredDrafts());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadStoredHistory());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [connections, setConnections] = useState<Record<Channel, boolean>>({ instagram: false, whatsapp: false, email: false });
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const genToken = useRef({ cancelled: false });
  const handoffTimer = useRef<number | undefined>(undefined);
  const toastId = useRef(0);
  const seededRef = useRef(false);

  /* ------------------------------ toasts ------------------------------ */
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, tone: ToastItem["tone"] = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    window.setTimeout(() => dismissToast(id), 3200);
  }, [dismissToast]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  useEffect(() => {
    setConnections({
      instagram: instagram?.connected === true,
      whatsapp: hasConnectedNumber,
      email: emailConnected,
    });
  }, [emailConnected, hasConnectedNumber, instagram?.connected]);

  /* Real packs from the API when sample data is off. localStorage stays the offline copy. */
  useEffect(() => {
    if (mockEnabled) return;
    let active = true;
    void aiStudioApi.listPacks()
      .then(({ data }) => {
        if (!active) return;
        const rows = (data.data?.packs || []) as Array<{ id: string; name: string; updatedAt?: string; packData?: Pack }>;
        const restored: Draft[] = rows
          .map((row) => {
            const pack = row.packData;
            if (!pack?.brief) return null;
            return {
              id: pack.id || row.id,
              name: row.name || pack.name,
              pack,
              savedAt: row.updatedAt ? new Date(row.updatedAt).getTime() : Date.now(),
            };
          })
          .filter((row): row is Draft => Boolean(row));
        if (restored.length === 0) return;
        setDrafts(restored);
        persistDrafts(restored);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [mockEnabled]);

  /* Seed sample drafts once, only while sample data is on and nothing is stored. */
  useEffect(() => {
    if (!mockEnabled || seededRef.current) return;
    seededRef.current = true;
    setDrafts((ds) => {
      if (ds.length > 0) return ds;
      persistDrafts(mockDrafts);
      return mockDrafts;
    });
  }, [mockEnabled]);

  const logHistory = useCallback((p: Pack, origin: HistoryEntry["origin"]) => {
    const entry: HistoryEntry = { id: uid(), name: p.name, pack: clonePack(p), savedAt: Date.now(), origin };
    setHistory(addHistoryEntry(entry));
  }, []);

  /* ------------------------------ generation ------------------------------ */
  const generate = async () => {
    if (!brief.trim()) {
      setBriefError("Please describe your idea first.");
      document.getElementById("brief")?.focus();
      return;
    }
    if (outputs.length === 0) return;
    const token = { cancelled: false };
    genToken.current = token;
    setBriefError(null);
    setStep(0);
    setScreen("generating");
    try {
      let result: Pack;
      if (mockEnabled) {
        result = await generateStudioPack({ brief, language, outputs, photos }, setStep, token);
      } else {
        // Production path — until /ai-studio/generate is deployed this lands in
        // the error state with an explainer instead of silently faking data.
        const { data } = await aiStudioApi.generate({
          brief,
          language,
          outputs: outputs as unknown as string[],
          photoNames: photos.map((photo) => photo.name).filter(Boolean),
        });
        const payload = data.data as { pack?: Pack };
        if (!payload?.pack) throw new Error("No pack returned");
        result = payload.pack;
      }
      if (token.cancelled) return;
      setStep(4);
      setPack(result);
      setTab("all");
      setActiveState({ carousel: 0, image: 0 });
      setScreen("review");
      logHistory(result, "generation");
      toast("Content pack generated");
      if (!mockEnabled) {
        // Best-effort server sync; local state remains the source of truth.
        aiStudioApi.savePack(result as unknown as Record<string, unknown>).catch(() => undefined);
      }
    } catch (err) {
      if (token.cancelled || (err instanceof Error && err.message === "cancelled")) return;
      setScreen("error");
    }
  };

  const cancelGeneration = () => {
    genToken.current.cancelled = true;
    setScreen("compose");
  };

  /* ------------------------------ pack mutations ------------------------------ */
  const update = useCallback((fn: (p: Pack) => Pack) => {
    setPack((p) => (p ? fn(p) : p));
    setScreen((s) => (s === "saved" ? "review" : s));
  }, []);

  const regenAll = () => {
    if (!pack) return;
    setBusy(true);
    window.setTimeout(() => {
      update((p) => regenerateAll(p));
      setBusy(false);
      toast("Content pack regenerated");
    }, 1000);
  };

  const refine = (instruction: string) => {
    setOverlay(null);
    setBusy(true);
    window.setTimeout(() => {
      update((p) => refinePack(p, instruction));
      setBusy(false);
      toast("Copy refined for each channel");
    }, 800);
  };

  /* ------------------------------ drafts ------------------------------ */
  const saveDraft = (name: string, thenNew = false) => {
    if (!pack) return;
    const named = { ...pack, name };
    setPack(named);
    setDrafts((ds) => {
      const d: Draft = { id: named.id, name, pack: clonePack(named), savedAt: Date.now() };
      const next = ds.some((x) => x.id === named.id) ? [d, ...ds.filter((x) => x.id !== named.id)] : [d, ...ds];
      persistDrafts(next);
      return next;
    });
    toast("Draft saved");
    if (thenNew) resetStudio();
    else setScreen("saved");
  };

  const openDraft = (d: Draft) => {
    const restored = { ...clonePack(d.pack), id: d.id, name: d.name };
    setBrief(restored.brief);
    setLanguage(restored.language);
    setOutputs(restored.outputs);
    setPhotos(restored.photos);
    setPack(restored);
    setTab("all");
    setActiveState({ carousel: 0, image: 0 });
    setOverlay(null);
    setScreen("review");
    toast(`Restored “${d.name}”`);
  };

  const deleteDraft = (d: Draft) => {
    setDrafts((ds) => {
      const next = ds.filter((x) => x.id !== d.id);
      persistDrafts(next);
      return next;
    });
    toast("Draft deleted", "info");
    if (!mockEnabled) aiStudioApi.deletePack(d.id).catch(() => undefined);
  };

  const openHistory = (entry: HistoryEntry) => {
    const restored = { ...clonePack(entry.pack) };
    setBrief(restored.brief);
    setLanguage(restored.language);
    setOutputs(restored.outputs);
    setPhotos(restored.photos);
    setPack(restored);
    setTab("all");
    setActiveState({ carousel: 0, image: 0 });
    setOverlay(null);
    setScreen("review");
    toast(`Opened from history: “${entry.name}”`, "info");
  };

  function resetStudio() {
    setBrief("");
    setLanguage("English");
    setPhotos([]);
    setOutputs(DEFAULT_OUTPUTS);
    setBriefError(null);
    setPack(null);
    setOverlay(null);
    setScreen("compose");
  }

  const requestNew = () => {
    if (pack && screen === "review") setOverlay("new");
    else resetStudio();
  };

  /* ------------------------------ hand-off ------------------------------ */
  const runHandoff = (channel: Channel, p: Pack) => {
    window.clearTimeout(handoffTimer.current);
    setHandoff({ channel, phase: "opening", payload: buildHandoff(p, channel), openingText: OPENING_TEXT[channel](p) });

    // Build the real navigation payload. Instagram carries rendered PNG media;
    // Email carries the generated poster as an attachable File.
    const baseState = buildHandoffState(p, channel);
    const mediaWork: Promise<Record<string, unknown>> = (async () => {
      if (channel === "instagram") {
        const slides = p.carousel ?? (p.image ? [p.image.options[p.image.selected]] : []);
        if (slides.length === 0) return {};
        const mediaUrls = await slidesToPngUrls(slides, `studio-${p.id}`);
        return { mediaUrls };
      }
      if (channel === "email") {
        const slide = p.carousel?.[0] ?? p.image?.options[p.image.selected];
        if (!slide) return {};
        const attachmentFile = await slideToPngFile(slide, `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-poster.png`);
        return { attachmentFile };
      }
      return {};
    })();

    const minDelay = new Promise<void>((r) => {
      handoffTimer.current = window.setTimeout(r, 1100);
    });

    void Promise.all([mediaWork, minDelay])
      .then(([extra]) => {
        setHandoff(null);
        // Persist hand-off state before leaving the page.
        setPack((cur) => {
          const next = cur ? { ...cur, handedOff: { ...cur.handedOff, [channel]: true } } : cur;
          if (next) logHistory(next, "handoff");
          return next;
        });
        if (!mockEnabled) aiStudioApi.logHandoff({ packId: p.id, channel, payload: buildHandoff(p, channel).data }).catch(() => undefined);
        navigate(HANDOFF_ROUTE[channel], { state: { ...baseState, ...extra } });
      })
      .catch(() => {
        setHandoff(null);
        toast("Couldn't prepare the hand-off. Try again.", "error");
      });
  };

  const startHandoff = (channel: Channel) => {
    if (!pack) return;
    if (!connections[channel]) {
      setHandoff({ channel, phase: "warning", payload: buildHandoff(pack, channel), openingText: "" });
      return;
    }
    runHandoff(channel, pack);
  };

  const closeHandoff = () => {
    window.clearTimeout(handoffTimer.current);
    setHandoff(null);
  };

  const connect = (channel: Channel) => {
    setConnections((c) => ({ ...c, [channel]: true }));
    toast(`${CHANNEL_NAME[channel]} connected in Settings.`);
    if (pack) runHandoff(channel, pack);
  };

  /* ------------------------------ examples ------------------------------ */
  const useExample = (id: string) => {
    const ex = EXAMPLE_IDEAS.find((e) => e.id === id);
    if (!ex) return;
    setBrief(ex.brief);
    setOutputs(ex.outputs);
    setBriefError(null);
    toast("Example loaded — tweak it or generate right away", "info");
    window.setTimeout(() => document.getElementById("brief")?.focus(), 0);
  };

  /* ------------------------------ render ------------------------------ */
  const reviewing = pack && (screen === "review" || screen === "saved");

  return (
    <div className="ai-studio min-h-full">
      <main className="mx-auto w-full max-w-[1280px]" id="main">
        {screen === "compose" && (
          <>
            {mockEnabled && (
              <p className="mb-3 flex items-center gap-2 rounded-xl border border-[#e6defb] bg-[#f4efff] px-3 py-2 text-[12px] font-medium text-[var(--text-muted)]" role="status">
                <Info size={14} className="flex-none text-[var(--ai-primary)]" />
                Sample data is on — Studio uses the mock generation engine until AI services are connected. Switch it off in Settings to use the real pipeline.
              </p>
            )}
            <Compose
              brief={brief}
              setBrief={setBrief}
              language={language}
              setLanguage={setLanguage}
              photos={photos}
              setPhotos={setPhotos}
              outputs={outputs}
              setOutputs={setOutputs}
              error={briefError}
              setError={setBriefError}
              onGenerate={generate}
              onExample={useExample}
              hasPack={!!pack}
              onBackToPack={() => setScreen("review")}
            />
          </>
        )}
        {screen === "generating" && (
          <GenerationProgress step={step} hasVisuals={outputs.includes("ig_carousel") || outputs.includes("ig_image")} onCancel={cancelGeneration} />
        )}
        {screen === "error" && (
          <GenerationError
            onRetry={generate}
            onEdit={() => setScreen("compose")}
            hint={mockEnabled ? undefined : "AI generation service isn't connected yet. Turn on Sample data to explore Studio with the mock engine."}
          />
        )}
        {reviewing && pack && (
          <PackView
            key={pack.id}
            pack={pack}
            saved={screen === "saved"}
            busy={busy}
            tab={tab}
            setTab={setTab}
            active={active}
            setActive={(set, i) => setActiveState((a) => ({ ...a, [set]: i }))}
            update={update}
            onRegenerateAll={regenAll}
            onRefine={() => setOverlay("refine")}
            onSaveDraft={(name) => saveDraft(name)}
            onViewDrafts={() => setOverlay("drafts")}
            onNew={requestNew}
            onEditBrief={() => setScreen("compose")}
            onHandoff={startHandoff}
            onToast={toast}
          />
        )}
      </main>

      <DraftDrawer
        open={overlay === "drafts"}
        drafts={drafts}
        history={history}
        onClose={() => setOverlay(null)}
        onOpenDraft={openDraft}
        onDeleteDraft={deleteDraft}
        onOpenHistory={openHistory}
        onDeleteHistory={(entry) => {
          setHistory(removeHistoryEntry(entry.id));
          toast("Removed from history", "info");
        }}
        onClearHistory={() => {
          setHistory(clearStoredHistory());
          toast("History cleared", "info");
        }}
        onNew={() => {
          setOverlay(null);
          requestNew();
        }}
      />
      <RefineModal open={overlay === "refine"} onClose={() => setOverlay(null)} onApply={refine} />
      <NewPackModal
        open={overlay === "new"}
        onClose={() => setOverlay(null)}
        onDiscard={resetStudio}
        onSaveAndNew={() => pack && saveDraft(pack.name, true)}
      />
      <HandoffModal state={handoff} onClose={closeHandoff} onConnect={connect} />
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
