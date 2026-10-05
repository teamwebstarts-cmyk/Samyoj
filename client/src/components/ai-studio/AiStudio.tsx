import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { useMetaMock } from "../../contexts/MetaMockContext";
import { useWhatsAppNumber } from "../../contexts/WhatsAppNumberContext";
import { useMetaChannelStatus } from "../layout/MetaChannelChips";
import { useGmailChannelAvailable } from "../email/emailData";
import { aiStudioApi, inboxApi } from "../../services/api";
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
import { GenerationProgress } from "./Generating";
import { PackView } from "./PackView";
import type { PackTab } from "./PackView";
import { DraftDrawer, ToastHost } from "./Overlays";
import type { ToastItem } from "./Overlays";
import { HandoffModal, NewPackModal, RefineModal } from "./Modals";
import type { HandoffState } from "./Modals";
import { slideToPngFile, slidesToPngUrls, directSlideImageUrls } from "../../utils/aiStudioPoster";
import { aiBillingUserMessage, normalizeError } from "../../utils/errors";
import {
  addHistoryEntry,
  clearStoredHistory,
  clearWorkspace,
  loadStoredDrafts,
  loadStoredHistory,
  loadWorkspace,
  persistDrafts,
  persistHistory,
  removeHistoryEntry,
  saveWorkspace,
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
 * the studio calls aiStudioApi. Failures stay on the brief editor with the real
 * message. Drafts + history persist in localStorage either way.
 */
type Screen = "compose" | "generating" | "review" | "saved";
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

async function uploadReferencePhotos(photos: Photo[]): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos.slice(0, 5)) {
    const response = await fetch(photo.url);
    if (!response.ok) throw new Error(`Could not read reference image “${photo.name}”.`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const uploaded = await inboxApi.uploadMedia({
      mimeType: blob.type || 'image/jpeg',
      data: btoa(binary),
      filename: photo.name,
    });
    const publicUrl = (uploaded.data as { data?: { publicUrl?: string } }).data?.publicUrl;
    if (!publicUrl) throw new Error(`Reference image “${photo.name}” could not be uploaded.`);
    urls.push(publicUrl);
  }
  return urls;
}

export default function AiStudio() {
  const navigate = useNavigate();
  const { enabled: mockEnabled } = useMetaMock();
  const { activeNumber, hasConnectedNumber } = useWhatsAppNumber();
  const { instagram } = useMetaChannelStatus();
  const emailConnected = useGmailChannelAvailable();

  const restoredWorkspace = loadWorkspace();
  const usableWorkspace = !mockEnabled && restoredWorkspace?.pack.sample ? null : restoredWorkspace;
  const [screen, setScreen] = useState<Screen>(usableWorkspace?.screen ?? "compose");
  const [brief, setBrief] = useState(usableWorkspace?.pack.brief ?? "");
  const [language, setLanguage] = useState<Language>(usableWorkspace?.pack.language ?? "English");
  const [photos, setPhotos] = useState<Photo[]>(usableWorkspace?.pack.photos ?? []);
  const [outputs, setOutputs] = useState<OutputId[]>(usableWorkspace?.pack.outputs?.length ? usableWorkspace.pack.outputs : DEFAULT_OUTPUTS);
  const [imageQuality, setImageQuality] = useState<'standard' | 'high' | 'story'>('standard');
  const [imageCount, setImageCount] = useState<1 | 2 | 4>(1);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [pack, setPack] = useState<Pack | null>(usableWorkspace?.pack ?? null);
  const [tab, setTab] = useState<PackTab>("all");
  const [active, setActiveState] = useState<Record<VisualSet, number>>({ carousel: 0, image: 0 });
  const [drafts, setDrafts] = useState<Draft[]>(() => mockEnabled ? loadStoredDrafts() : loadStoredDrafts().filter((draft) => !draft.pack.sample));
  const [history, setHistory] = useState<HistoryEntry[]>(() => mockEnabled ? loadStoredHistory() : loadStoredHistory().filter((entry) => !entry.pack.sample));
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [handoff, setHandoff] = useState<HandoffState | null>(null);
  const [connections, setConnections] = useState<Record<Channel, boolean>>({ instagram: false, whatsapp: false, email: false });
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const genToken = useRef({ cancelled: false });
  const handoffTimer = useRef<number | undefined>(undefined);
  const handoffRunningRef = useRef(false);
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
    if (pack && (screen === "review" || screen === "saved")) saveWorkspace(pack, screen);
  }, [pack, screen]);

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

  useEffect(() => {
    if (mockEnabled) return;
    if (pack?.sample) {
      setPack(null);
      setScreen("compose");
      clearWorkspace();
    }
    setDrafts((current) => {
      const next = current.filter((draft) => !draft.pack.sample);
      if (next.length !== current.length) persistDrafts(next);
      return next;
    });
    setHistory((current) => {
      const next = current.filter((entry) => !entry.pack.sample);
      if (next.length !== current.length) persistHistory(next);
      return next;
    });
  }, [mockEnabled, pack?.sample]);

  const logHistory = useCallback((p: Pack, origin: HistoryEntry["origin"]) => {
    const entry: HistoryEntry = { id: uid(), name: p.name, pack: clonePack(p), savedAt: Date.now(), origin };
    setHistory(addHistoryEntry(entry));
  }, []);

  /* ------------------------------ generation ------------------------------ */
  const generate = async (briefOverride?: string, opts?: { inPlace?: boolean }) => {
    const idea = (typeof briefOverride === "string" ? briefOverride : brief).trim();
    if (!idea) {
      setBriefError("Please describe your idea first.");
      document.getElementById("brief")?.focus();
      return;
    }
    if (outputs.length === 0) return;
    const token = { cancelled: false };
    genToken.current = token;
    setBriefError(null);
    const stay = !!opts?.inPlace;
    if (stay) setBusy(true);
    else {
      setStep(0);
      setScreen("generating");
    }
    try {
      let result: Pack;
      if (mockEnabled) {
        result = await generateStudioPack({ brief: idea, language, outputs, photos }, setStep, token);
        result.sample = true;
      } else {
        const referenceUrls = photos.length ? await uploadReferencePhotos(photos) : [];
        // Live path: persist references first so the image provider can fetch them.
        const { data } = await aiStudioApi.generate({
          brief: idea,
          language,
          outputs: outputs as unknown as string[],
          photoNames: photos.map((photo) => photo.name).filter(Boolean),
          referenceUrls,
          imageQuality,
          imageCount,
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
      toast(stay ? "Content pack updated" : "Content pack generated");
      if (!mockEnabled) {
        // Persist before handoff so the asset and copy have a server-side owner.
        await aiStudioApi.savePack(result as unknown as Record<string, unknown>).catch(() => undefined);
      }
    } catch (err) {
      if (token.cancelled || (err instanceof Error && err.message === "cancelled")) return;
      const n = normalizeError(err);
      const message =
        aiBillingUserMessage(n.code, n.message) ||
        n.message ||
        "Generation failed. Try again.";
      if (stay) {
        toast(message, "error");
      } else {
        setBriefError(message);
        setScreen("compose");
        document.getElementById("brief")?.focus();
      }
    } finally {
      if (stay) setBusy(false);
    }
  };

  const cancelGeneration = () => {
    genToken.current.cancelled = true;
    setScreen("compose");
  };

  /* ------------------------------ pack mutations ------------------------------ */
  const update = useCallback((fn: (p: Pack) => Pack) => {
    setPack((p) => {
      if (!p) return p;
      const next = fn(p);
      const previousMedia = (p.mediaPaths ?? []).join("|");
      const nextMedia = (next.mediaPaths ?? []).join("|");
      if (!mockEnabled && previousMedia !== nextMedia) {
        void aiStudioApi.savePack(next as unknown as Record<string, unknown>).catch(() => undefined);
      }
      return next;
    });
    setScreen((s) => (s === "saved" ? "review" : s));
  }, [mockEnabled]);

  const regenAll = (nextBrief?: string) => {
    if (!pack) return;
    if (nextBrief) setBrief(nextBrief);
    if (!mockEnabled) {
      void generate(nextBrief, { inPlace: true });
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      update((p) => regenerateAll(nextBrief ? { ...p, brief: nextBrief, imagePrompt: nextBrief } : p));
      setBusy(false);
      toast("Content pack regenerated");
    }, 1000);
  };

  const refine = (instruction: string) => {
    setOverlay(null);
    if (!mockEnabled) {
      toast("Edit the copy on each card. Sample refine only runs when Sample data is on.", "info");
      return;
    }
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
    if (!mockEnabled) {
      void aiStudioApi.savePack(named as unknown as Record<string, unknown>).catch(() => undefined);
    }
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
    setOverlay(null);
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
    clearWorkspace();
  }

  const requestNew = () => {
    if (pack && (screen === "review" || screen === "saved")) setOverlay("new");
    else resetStudio();
  };

  /* ------------------------------ hand-off ------------------------------ */
  const runHandoff = (channel: Channel, p: Pack) => {
    if (handoffRunningRef.current) return;
    handoffRunningRef.current = true;
    window.clearTimeout(handoffTimer.current);
    const handoffPayload = buildHandoff(p, channel);
    if (channel === "whatsapp" && activeNumber?.id) {
      handoffPayload.data.whatsappNumberId = activeNumber.id;
    }
    setHandoff({ channel, phase: "opening", payload: handoffPayload, openingText: OPENING_TEXT[channel](p) });

    // Build the real navigation payload. Instagram carries rendered PNG media;
    // Email carries the generated poster as an attachable File.
    const baseState = buildHandoffState(p, channel);
    const mediaWork: Promise<Record<string, unknown>> = (async () => {
      if (channel === "instagram") {
        const slides = p.carousel ?? (p.image ? [p.image.options[p.image.selected]] : []);
        const picked = slides.length > 1 ? slides : slides.slice(0, 1);
        if (picked.length === 0) return {};
        const direct = directSlideImageUrls(picked);
        if (direct) return { mediaUrls: direct };
        const mediaUrls = await slidesToPngUrls(picked, `studio-${p.id}`);
        return { mediaUrls };
      }
      if (channel === "email") {
        const slide = p.carousel?.[0] ?? p.image?.options[p.image.selected];
        if (!slide) return {};
        const direct = directSlideImageUrls([slide]);
        if (direct) {
          const res = await fetch(direct[0], { credentials: "include" });
          if (!res.ok) throw new Error("Generated poster could not be loaded");
          const blob = await res.blob();
          const attachmentFile = new File([blob], `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-poster.png`, { type: blob.type || "image/png" });
          return { attachmentFile };
        }
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
        if (!mockEnabled) {
          aiStudioApi.logHandoff({ packId: p.id, channel, payload: handoffPayload.data }).catch(() => undefined);
        }
        navigate(HANDOFF_ROUTE[channel], { state: { ...baseState, ...extra } });
      })
      .catch(() => {
        setHandoff(null);
        toast("Couldn't prepare the hand-off. Try again.", "error");
      })
      .finally(() => {
        handoffRunningRef.current = false;
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
                Sample data is on — this uses sample copy and art, not the live text and image models. Turn it off in Settings for a real generation.
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
              imageQuality={imageQuality}
              setImageQuality={setImageQuality}
              imageCount={imageCount}
              setImageCount={setImageCount}
              error={briefError}
              setError={setBriefError}
              onGenerate={generate}
              onExample={useExample}
              hasPack={!!pack}
              onBackToPack={() => setScreen("review")}
              drafts={drafts}
              history={history}
              onOpenDraft={openDraft}
              onOpenHistory={openHistory}
              onViewAllSessions={() => setOverlay("drafts")}
            />
          </>
        )}
        {screen === "generating" && (
          <GenerationProgress
            step={step}
            hasVisuals={outputs.includes("ig_carousel") || outputs.includes("ig_image")}
            liveImages={!mockEnabled}
            onCancel={cancelGeneration}
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
            onBriefChange={setBrief}
            onHandoff={startHandoff}
            handoffBusy={handoff !== null}
            onToast={toast}
            useLiveImages={!mockEnabled}
            imageQuality={imageQuality}
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
