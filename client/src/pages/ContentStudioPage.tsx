import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bookmark,
  ClipboardList,
  Eye,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import PageShell from '../components/ui/PageShell';
import MetaMockNotice from '../components/meta/MetaMockNotice';
import { studioApi, type StudioPack, type StudioSlideStyle } from '../services/api';
import { getErrorMessage } from '../utils/errors';
import { toastError, toastSuccess } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useMetaMock } from '../contexts/MetaMockContext';
import { getStudioMockPacks, isMetaMockId, mergeById } from '../utils/metaMockData';
import {
  STUDIO_SLIDES_MAX,
  STUDIO_SLIDES_MIN,
  formatDate,
  packName,
  slideThemeCss,
} from '../components/studio/studioModel';
import {
  StudioBriefForm,
  StudioExamples,
  StudioGenerating,
  StudioHero,
  StudioStepper,
  type StudioPhoto,
} from '../components/studio/StudioBrief';
import {
  StudioChannelColumns,
  StudioSlides,
} from '../components/studio/StudioReview';
import { StudioNextSteps, StudioSaveDraft, StudioVariations } from '../components/studio/StudioSidebar';
import '../components/studio/ai-studio.css';

type StudioPhase = 'brief' | 'generating' | 'review';

const HANDOFF_STATE_KEY = 'aiStudioHandoff';

/** Persist a pack for the destination page to pick up (?studioPack=<id>). */
export function buildHandoff(pack: StudioPack): void {
  try {
    sessionStorage.setItem(
      HANDOFF_STATE_KEY,
      JSON.stringify({
        packId: pack.id,
        caption: pack.caption || '',
        slides: pack.slides,
        photos: pack.photos,
        createdAt: Date.now(),
      })
    );
  } catch {
    /* storage unavailable — hand-off stays copy-only */
  }
}

export default function ContentStudioPage() {
  const navigate = useNavigate();
  const { orgRole } = useAuth();
  const { enabled: mockEnabled } = useMetaMock();
  const canEdit = orgRole === 'OWNER' || orgRole === 'ADMIN' || orgRole === 'SUPERVISOR';

  const [phase, setPhase] = useState<StudioPhase>('brief');
  const [brief, setBrief] = useState('');
  const [language, setLanguage] = useState('en');
  const [slides, setSlides] = useState(5);
  const [outputs, setOutputs] = useState({ carousel: true, waTemplate: true, email: true });
  const [photos, setPhotos] = useState<StudioPhoto[]>([]);

  const [pack, setPack] = useState<StudioPack | null>(null);
  const [drafts, setDrafts] = useState<StudioPack[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDrafts = useCallback(() => {
    setDraftsLoading(true);
    studioApi
      .list(8)
      .then(({ data }) => {
        // Real packs first; sample packs join behind them when mock preview is on.
        const samples = mockEnabled ? (getStudioMockPacks() as unknown as StudioPack[]) : [];
        setDrafts(mergeById(data.data.packs || [], samples));
      })
      .catch(() => {
        const samples = mockEnabled ? (getStudioMockPacks() as unknown as StudioPack[]) : [];
        setDrafts(samples);
      })
      .finally(() => setDraftsLoading(false));
  }, [mockEnabled]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const generate = () => {
    setError(null);
    setPhase('generating');
    if (mockEnabled) {
      const sample = getStudioMockPacks().find((row) => row.status === 'READY' && row.slides.length >= 4);
      window.setTimeout(() => {
        if (!sample) {
          setPhase('brief');
          setError('Sample pack is missing.');
          return;
        }
        setPack({
          ...(sample as unknown as StudioPack),
          brief: brief.trim() || sample.brief,
          language,
        });
        setPhase('review');
        toastSuccess('Your content pack is ready');
      }, 1100);
      return;
    }
    studioApi
      .generate({
        brief: brief.trim(),
        language,
        slides,
        carousel: outputs.carousel,
        waTemplate: outputs.waTemplate,
        email: outputs.email,
        photos,
      })
      .then(({ data }) => {
        setPack(data.data);
        setPhase('review');
        loadDrafts();
        toastSuccess('Your content pack is ready');
      })
      .catch((err) => {
        setPhase('brief');
        setError(getErrorMessage(err) || 'Could not generate the content pack. Try again.');
      });
  };

  /** Same brief, same options — spends one more generate (one more credit). */
  const regenerate = () => {
    if (!canEdit) {
      toastError('Only owners, admins, and supervisors can generate content packs.');
      return;
    }
    setPhase('brief');
    generate();
  };

  const saveCaption = (value: string) => {
    if (!pack) return;
    if (isMetaMockId(pack.id)) {
      setPack({ ...pack, caption: value });
      return;
    }
    const next = { ...pack, caption: value };
    setPack(next);
    studioApi
      .update(pack.id, { caption: value })
      .catch(() => toastError('Could not save the caption edit'));
  };

  const saveEmail = (subject: string, body: string) => {
    if (!pack) return;
    if (isMetaMockId(pack.id)) {
      setPack({ ...pack, email: { subject, body } });
      return;
    }
    const next = { ...pack, email: { subject, body } };
    setPack(next);
    studioApi
      .update(pack.id, { emailSubject: subject, emailBody: body })
      .catch(() => toastError('Could not save the email edit'));
  };

  const saveSlides = (updated: Array<{ title: string; body: string; photo?: string; style?: StudioSlideStyle }>) => {
    if (!pack) return;
    if (isMetaMockId(pack.id)) {
      setPack({ ...pack, slides: updated });
      toastSuccess('Slide saved');
      return;
    }
    const next = { ...pack, slides: updated };
    setPack(next);
    studioApi
      .update(pack.id, { slides: updated })
      .then(() => toastSuccess('Slide saved'))
      .catch(() => toastError('Could not save the slide edits'));
  };

  const removeDraft = (id: string) => {
    if (isMetaMockId(id)) {
      toastError('Sample packs cannot be deleted.');
      return;
    }
    studioApi
      .remove(id)
      .then(() => {
        if (pack?.id === id) {
          setPack(null);
          setPhase('brief');
        }
        loadDrafts();
      })
      .catch(() => toastError('Could not delete this pack'));
  };

  const openDraft = (id: string) => {
    if (isMetaMockId(id)) {
      const sample = getStudioMockPacks().find((row) => row.id === id);
      if (sample) {
        setError(null);
        setPack(sample as unknown as StudioPack);
        setBrief(sample.brief);
        setPhase('review');
        if (sample.status === 'FAILED') {
          toastError('This sample pack shows the failure state.');
        }
      }
      return;
    }
    setError(null);
    studioApi
      .get(id)
      .then(({ data }) => {
        setPack(data.data);
        setBrief(data.data.brief);
        setPhase('review');
      })
      .catch(() => toastError('Could not open this pack'));
  };

  const handOffToPosts = () => {
    if (!pack) return;
    buildHandoff(pack);
    navigate('/instagram/posts?studioPack=' + pack.id);
  };

  /** Map the brief language to a WhatsApp template language the wizard supports. */
  const templateLanguage = (lang: string): string => {
    if (lang === 'hi') return 'hi';
    if (lang === 'hinglish') return 'en_US';
    return 'en_US';
  };

  const handOffToTemplates = () => {
    if (!pack?.waTemplate) return;
    navigate('/templates/new', {
      state: {
        studioBody: pack.waTemplate.body,
        studioFooter: pack.waTemplate.footer || undefined,
        studioButtons: pack.waTemplate.buttons,
        studioName: pack.waTemplate.name || undefined,
        studioLanguage: templateLanguage(pack.language),
      },
    });
  };

  const handOffToEmail = () => {
    if (!pack?.email) return;
    navigate('/email/compose', {
      state: {
        studioSubject: pack.email.subject,
        studioBody: pack.email.body,
      },
    });
  };

  const startNew = () => {
    setPack(null);
    setBrief('');
    setPhotos([]);
    setSlides(5);
    setOutputs({ carousel: true, waTemplate: true, email: true });
    setError(null);
    setPhase('brief');
  };

  const readySlides = useMemo(
    () => (pack ? pack.slides.length >= STUDIO_SLIDES_MIN && pack.slides.length <= STUDIO_SLIDES_MAX : false),
    [pack]
  );

  return (
    <PageShell list>
      <div className="ais-page ais-shell">
        {mockEnabled ? <MetaMockNotice /> : null}

        {phase === 'brief' ? (
          <>
            <div className="ais-topbar">
              <span className="ais-topbar__spacer" aria-hidden />
              <StudioStepper phase={phase} />
              <span className="ais-topbar__spacer" aria-hidden />
            </div>

            <StudioHero />

            {!canEdit ? (
              <div className="ais-error">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Only owners, admins, and supervisors can generate content packs.
              </div>
            ) : null}
            {error ? (
              <div className="ais-error" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <StudioBriefForm
              brief={brief}
              onBriefChange={setBrief}
              language={language}
              onLanguageChange={setLanguage}
              slides={slides}
              onSlidesChange={setSlides}
              outputs={outputs}
              onOutputsChange={setOutputs}
              photos={photos}
              onPhotosChange={setPhotos}
              generating={false}
              onGenerate={() => {
                if (!canEdit) {
                  toastError('Only owners, admins, and supervisors can generate content packs.');
                  return;
                }
                generate();
              }}
            />

            <StudioExamples
              onPick={(exampleBrief, exampleSlides) => {
                setBrief(exampleBrief);
                setSlides(exampleSlides);
              }}
            />

            {/* My drafts */}
            <section className="ais-card" aria-label="Recent content packs">
              <div className="ais-card__head flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="ais-card__title">My drafts</h2>
                  <p className="ais-card__sub">Packs you generated recently. Open one to re-use or edit its copy.</p>
                </div>
                <button type="button" className="ais-btn ais-btn--ghost ais-btn--sm" onClick={loadDrafts}>
                  <RefreshCw className={`h-3.5 w-3.5 ${draftsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              {draftsLoading && drafts.length === 0 ? (
                <div className="ais-empty">
                  <p className="ais-empty__desc">Loading…</p>
                </div>
              ) : drafts.length === 0 ? (
                <div className="ais-empty">
                  <p className="ais-empty__title">No content packs yet</p>
                  <p className="ais-empty__desc">Describe an idea above — your generated packs land here.</p>
                </div>
              ) : (
                <div className="ais-drafts">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="flex items-center">
                      <button type="button" className="ais-draft flex-1" onClick={() => openDraft(draft.id)}>
                        {/* Mini slide thumb — first slide poster, like the design's draft cards */}
                        {draft.slides.length > 0 ? (
                          <span
                            className="ais-draft__thumb"
                            style={{ background: slideThemeCss(draft.slides[0].style).bg }}
                          >
                            {draft.slides[0].photo ? (
                              <img src={draft.slides[0].photo} alt="" />
                            ) : (
                              <span
                                className="ais-draft__thumb-fallback truncate px-1"
                                style={{ color: slideThemeCss(draft.slides[0].style).ink }}
                              >
                                {draft.slides[0].title}
                              </span>
                            )}
                          </span>
                        ) : draft.status === 'FAILED' ? (
                          <span className="ais-draft__thumb">
                            <span className="ais-draft__thumb-fallback" style={{ background: '#fef2f2', color: '#b91c1c' }}>
                              !
                            </span>
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="ais-draft__name block truncate">{packName(draft)}</span>
                          <span className="ais-draft__meta block">
                            {draft.slides.length > 0 ? `${draft.slides.length} slides · ` : ''}
                            {formatDate(draft.createdAt)}
                          </span>
                        </span>
                      </button>
                      {canEdit && !isMetaMockId(draft.id) ? (
                        <button
                          type="button"
                          className="ais-draft__del mr-3"
                          aria-label={`Delete ${packName(draft)}`}
                          onClick={() => removeDraft(draft.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}

        {phase === 'generating' ? (
          <>
            <StudioStepper phase={phase} />
            <StudioGenerating phase={1} />
          </>
        ) : null}

        {phase === 'review' && pack ? (
          <>
            {/* Saved header + stepper bar — Create New / My Drafts from the design */}
            <div className="ais-topbar">
              <button type="button" className="ais-topbar__new" onClick={startNew}>
                <Sparkles className="h-3.5 w-3.5" />
                Create New
              </button>
              <StudioStepper phase={phase} />
              <button
                type="button"
                className="ais-topbar__drafts"
                onClick={() => {
                  setPack(null);
                  setPhase('brief');
                }}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                My Drafts
              </button>
            </div>

            <div className="ais-review">
              {/* Main column */}
              <div className="flex min-w-0 flex-col gap-4">
                <section className="ais-card p-4">
                  <div className="ais-ready">
                    <span className="ais-ready__check">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                    <div>
                      <h2 className="ais-ready__title">
                        {isMetaMockId(pack.id) ? 'Sample pack opened' : 'Your content pack is ready!'}
                      </h2>
                      <p className="ais-ready__sub">Review, make final changes and use it in your channels.</p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        className="ais-btn ais-btn--outline ais-btn--sm"
                        onClick={regenerate}
                        title="Runs a fresh generate on the same brief — one more credit"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regenerate All
                      </button>
                    ) : null}
                  </div>
                  {pack.status === 'FAILED' ? (
                    <div className="ais-error mt-3" role="alert">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {pack.error || 'This pack failed to generate.'}
                    </div>
                  ) : null}
                  {pack.photos?.length ? (
                    <span className="ais-note ais-photos-note mt-3">
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                      {pack.photos.length} photo{pack.photos.length > 1 ? 's' : ''} attached — set them as slide
                      backgrounds below, then take them into Posts when you hand off.
                    </span>
                  ) : null}
                </section>

                {error ? (
                  <div className="ais-error" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    {error}
                  </div>
                ) : null}

                {readySlides ? (
                  <StudioSlides pack={pack} canEdit={canEdit} onSaveSlides={saveSlides} />
                ) : null}

                <section>
                  <div className="mb-2">
                    <h2 className="text-[15px] font-extrabold text-theme-fg">Channel-ready content</h2>
                    <p className="text-[12px] font-semibold text-theme-muted">
                      Review and edit the AI-generated copy for each channel.
                    </p>
                  </div>
                  <StudioChannelColumns
                    pack={pack}
                    onSaveCaption={canEdit ? saveCaption : undefined}
                    onSaveEmail={canEdit ? saveEmail : undefined}
                    onUseInPosts={canEdit && pack.caption ? handOffToPosts : undefined}
                    onOpenInTemplates={canEdit && pack.waTemplate ? handOffToTemplates : undefined}
                    onUseInEmail={canEdit && pack.email ? handOffToEmail : undefined}
                  />
                </section>
              </div>

              {/* Side rail — Next steps / Save pack / Variations (from the design) */}
              <aside className="ais-rail flex flex-col gap-3">
                <StudioNextSteps
                  onUseInPosts={canEdit && pack.caption ? handOffToPosts : undefined}
                  onOpenInTemplates={canEdit && pack.waTemplate ? handOffToTemplates : undefined}
                  onUseInEmail={canEdit && pack.email ? handOffToEmail : undefined}
                />
                {!isMetaMockId(pack.id) ? (
                  <StudioSaveDraft
                    defaultName={packName(pack)}
                    savedAt={formatDate(pack.updatedAt)}
                    onSave={(name) => toastSuccess(`"${name}" is already saved — packs save automatically.`)}
                  />
                ) : null}
                <StudioVariations onNewBrief={startNew} />
                <div className="ais-rail__hint">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>
                    <Bookmark className="mr-1 inline h-3 w-3" />
                    Packs save automatically — find them under My drafts.
                  </span>
                </div>
              </aside>
            </div>
          </>
        ) : null}

        {phase === 'review' && !pack ? (
          <div className="ais-error" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            This pack could not be loaded. Start a new brief.
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
