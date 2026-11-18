import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  RefreshCw,
  BookOpen,
  AlertCircle,
  Loader2,
  Eye,
  Volume2,
} from 'lucide-react';
import { SYSTEM_COMPONENTS, getComponentById } from './data/components';
import { SUPPORTED_LANGUAGES, getLanguageByCode } from './data/languages';
import type {
  CustomLessonSource,
  LocalizationFetchResult,
  LocalizedContent,
  TranslateResponse,
  TtsResponse,
} from './types/localization';
import { AudioPlayerBar, ComponentStage } from './components/ComponentStage';
import { CustomMaterialPanel } from './components/CustomMaterialPanel';
import { DoubtTutorSection } from './components/DoubtTutorSection';
import { SavedLibraryDrawer } from './components/SavedLibraryDrawer';
import { TechnicalGuide } from './components/TechnicalGuide';

const STORAGE_COMPONENT_KEY = 'skillos:lastComponentId';
const STORAGE_LANG_KEY = 'skillos:lastLangCode';

function getInitialSelection(): { componentId: string; langCode: string } {
  if (typeof window === 'undefined') {
    return { componentId: 'alu', langCode: 'en' };
  }
  const params = new URLSearchParams(window.location.search);
  const urlComp = params.get('component');
  const urlLang = params.get('lang');
  const savedComp = localStorage.getItem(STORAGE_COMPONENT_KEY);
  const savedLang = localStorage.getItem(STORAGE_LANG_KEY);

  const candidateComp = urlComp || savedComp || 'alu';
  const validComp =
    SYSTEM_COMPONENTS.some((c) => c.id === candidateComp) ||
    candidateComp === 'custom-new' ||
    candidateComp.startsWith('custom-')
      ? candidateComp
      : 'alu';
  const validLang = SUPPORTED_LANGUAGES.some((l) => l.code === (urlLang || savedLang))
    ? (urlLang || savedLang)!
    : 'en';

  return { componentId: validComp, langCode: validLang };
}

export default function App() {
  const initial = getInitialSelection();
  const [selectedComponentId, setSelectedComponentId] = useState<string>(
    initial.componentId
  );
  const [selectedLang, setSelectedLang] = useState<string>(initial.langCode);

  const [localization, setLocalization] = useState<LocalizedContent | null>(null);
  const [savedItems, setSavedItems] = useState<LocalizedContent[]>([]);
  const [customItems, setCustomItems] = useState<CustomLessonSource[]>([]);
  const [isLoadingText, setIsLoadingText] = useState<boolean>(false);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<boolean>(false);
  const [textOrigin, setTextOrigin] = useState<
    'source' | 'loaded-saved' | 'newly-translated'
  >('source');
  const [audioOrigin, setAudioOrigin] = useState<
    'none' | 'loaded-saved' | 'newly-generated'
  >('none');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEnglishCompare, setShowEnglishCompare] = useState<boolean>(false);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadedAudioUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const isCustomMode =
    selectedComponentId === 'custom-new' ||
    selectedComponentId.startsWith('custom-');
  const activeCustomItem =
    customItems.find((item) => item.id === selectedComponentId) ?? null;
  const activeComponent = getComponentById(selectedComponentId);
  const activeLanguage = getLanguageByCode(selectedLang);

  const refreshSavedLibrary = useCallback(async () => {
    try {
      const [locRes, customRes] = await Promise.all([
        fetch('/api/localizations'),
        fetch('/api/custom-items'),
      ]);
      if (locRes.ok) {
        const data = (await locRes.json()) as { items?: LocalizedContent[] };
        if (Array.isArray(data.items)) {
          setSavedItems(data.items);
        }
      }
      if (customRes.ok) {
        const customData = (await customRes.json()) as {
          items?: CustomLessonSource[];
        };
        if (Array.isArray(customData.items)) {
          setCustomItems(customData.items);
        }
      }
    } catch {
      // Non-blocking background sync
    }
  }, []);

  const syncAudioSource = useCallback((url: string | null) => {
    const el = audioRef.current;
    if (!el) return;
    if (!url) {
      if (loadedAudioUrlRef.current !== null) {
        loadedAudioUrlRef.current = null;
        el.removeAttribute('src');
        el.load();
      }
      return;
    }
    if (loadedAudioUrlRef.current !== url) {
      loadedAudioUrlRef.current = url;
      el.src = url;
      el.load();
    }
  }, []);

  const stopAudioPlayback = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    syncAudioSource(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [syncAudioSource]);

  // Persist user's active component + language so reopening the app restores it
  useEffect(() => {
    localStorage.setItem(STORAGE_COMPONENT_KEY, selectedComponentId);
    localStorage.setItem(STORAGE_LANG_KEY, selectedLang);
    const url = new URL(window.location.href);
    url.searchParams.set('component', selectedComponentId);
    url.searchParams.set('lang', selectedLang);
    window.history.replaceState({}, '', url.toString());
  }, [selectedComponentId, selectedLang]);

  useEffect(() => {
    refreshSavedLibrary();
  }, [refreshSavedLibrary]);

  // Load saved text & audio when component or language changes (or on reopen)
  useEffect(() => {
    let cancelled = false;
    stopAudioPlayback();
    setErrorMessage(null);

    if (selectedComponentId === 'custom-new') {
      setLocalization(null);
      setAudioOrigin('none');
      setIsLoadingText(false);
      setIsTranslating(false);
      return;
    }

    async function loadOrTranslate() {
      setIsLoadingText(true);
      try {
        const lookupRes = await fetch(
          `/api/components/${encodeURIComponent(selectedComponentId)}/localization?lang=${encodeURIComponent(selectedLang)}`
        );
        if (!lookupRes.ok) {
          const errBody = (await lookupRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(errBody.error || 'Failed to load lesson content.');
        }

        const lookupData = (await lookupRes.json()) as LocalizationFetchResult;
        if (cancelled) return;

        if (lookupData.found && lookupData.localization) {
          setLocalization(lookupData.localization);
          setTextOrigin(selectedLang === 'en' ? 'source' : 'loaded-saved');
          setAudioOrigin(
            lookupData.localization.audioUrl ? 'loaded-saved' : 'none'
          );
          setIsLoadingText(false);
          return;
        }

        // Not saved yet for this language -> translate using Gemini text model and save
        setIsLoadingText(false);
        setIsTranslating(true);
        const transRes = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            componentId: selectedComponentId,
            langCode: selectedLang,
          }),
        });

        const transBody = (await transRes.json().catch(() => ({}))) as
          | TranslateResponse
          | { error?: string };

        if (!transRes.ok || !('localization' in transBody)) {
          throw new Error(
            ('error' in transBody && transBody.error) ||
              `Translation into ${activeLanguage.name} failed.`
          );
        }

        if (cancelled) return;
        setLocalization(transBody.localization);
        setTextOrigin(transBody.cached ? 'loaded-saved' : 'newly-translated');
        setAudioOrigin(transBody.localization.audioUrl ? 'loaded-saved' : 'none');
        refreshSavedLibrary();
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setIsLoadingText(false);
          setIsTranslating(false);
        }
      }
    }

    loadOrTranslate();
    return () => {
      cancelled = true;
    };
  }, [
    selectedComponentId,
    selectedLang,
    activeLanguage.name,
    stopAudioPlayback,
    refreshSavedLibrary,
  ]);

  const handleRegenerateTranslation = async () => {
    if (selectedLang === 'en') return;
    stopAudioPlayback();
    setErrorMessage(null);
    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: selectedComponentId,
          langCode: selectedLang,
          force: true,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | TranslateResponse
        | { error?: string };
      if (!res.ok || !('localization' in body)) {
        throw new Error(
          ('error' in body && body.error) || 'Failed to regenerate translation.'
        );
      }
      setLocalization(body.localization);
      setTextOrigin('newly-translated');
      setAudioOrigin(body.localization.audioUrl ? 'loaded-saved' : 'none');
      refreshSavedLibrary();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    syncAudioSource(localization?.audioUrl ?? null);
  }, [localization?.audioUrl, syncAudioSource]);

  const handleListenToggle = async () => {
    const el = audioRef.current;
    if (!localization) return;

    // If audio is already saved/loaded, play or pause immediately
    if (localization.audioUrl && el) {
      if (isPlaying) {
        el.pause();
        setIsPlaying(false);
      } else {
        try {
          syncAudioSource(localization.audioUrl);
          el.playbackRate = playbackRate;
          await el.play();
          setIsPlaying(true);
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      }
      return;
    }

    // Otherwise synthesize via Gemini TTS, save on server, and play
    setErrorMessage(null);
    setIsGeneratingAudio(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: selectedComponentId,
          langCode: selectedLang,
          text: localization.spokenScript,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | TtsResponse
        | { error?: string };

      if (!res.ok || !('audioUrl' in body)) {
        throw new Error(
          ('error' in body && body.error) || 'Failed to generate audio.'
        );
      }

      syncAudioSource(body.audioUrl);
      setLocalization(body.localization);
      setAudioOrigin(body.cached ? 'loaded-saved' : 'newly-generated');
      refreshSavedLibrary();

      if (el) {
        el.playbackRate = playbackRate;
        await el.play();
        setIsPlaying(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDeleteSaved = async (componentId: string, langCode: string) => {
    try {
      await fetch(
        `/api/components/${encodeURIComponent(componentId)}/localization?lang=${encodeURIComponent(langCode)}`,
        { method: 'DELETE' }
      );
      await refreshSavedLibrary();
      if (componentId === selectedComponentId && langCode === selectedLang) {
        stopAudioPlayback();
        setSelectedLang('en');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSeek = (time: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = time;
    setCurrentTime(time);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleReplay = async () => {
    const el = audioRef.current;
    if (!el || !localization?.audioUrl) return;
    el.currentTime = 0;
    el.playbackRate = playbackRate;
    await el.play();
    setIsPlaying(true);
  };

  const primaryLanguages = SUPPORTED_LANGUAGES.slice(0, 4); // English, Tamil, Hindi, Telugu
  const extraLanguages = SUPPORTED_LANGUAGES.slice(4);

  const savedForCurrentComponent = savedItems.filter(
    (item) => item.componentId === selectedComponentId && item.langCode !== 'en'
  );

  const statusLine = (() => {
    if (selectedComponentId === 'custom-new') {
      return 'Upload a PDF, JPEG/PNG, or paste text to generate a lesson';
    }
    if (isLoadingText) return `Checking saved ${activeLanguage.name} lesson...`;
    if (isTranslating) return `Translating explanation into ${activeLanguage.name}...`;
    if (selectedLang === 'en') {
      return localization?.audioUrl
        ? 'English source · Saved audio ready'
        : 'English source';
    }
    if (textOrigin === 'loaded-saved') {
      return localization?.audioUrl
        ? `Loaded saved ${activeLanguage.name} text & audio`
        : `Loaded saved ${activeLanguage.name} text`;
    }
    return localization?.audioUrl
      ? `Translated & saved in ${activeLanguage.name} · Audio saved`
      : `Translated & saved in ${activeLanguage.name}`;
  })();

  const audioStatusText = (() => {
    if (isGeneratingAudio) return 'Synthesizing & saving WAV...';
    if (audioOrigin === 'loaded-saved') return 'Loaded saved WAV';
    if (audioOrigin === 'newly-generated') return 'Saved WAV ready';
    return 'Click Listen to generate & save';
  })();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Hidden managed audio element */}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#lab-stage"
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SkillOS
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#lab-stage"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Lab Stage
            </a>
            <a
              href="#concept-deck"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Explanation
            </a>
            <a
              href="#workflow"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#tech-guide"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Tech Guide
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 tabular-nums"
            >
              Saved Library ({savedItems.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Component Selector Bar */}
        <section aria-label="Component selector" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 text-balance">
                Interactive Systems & Hardware Lab
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Explore a component, switch languages to translate and save its explanation, then listen anytime.
              </p>
            </div>
            {!isCustomMode && savedForCurrentComponent.length > 0 && (
              <div className="text-xs text-slate-600">
                <span>Saved languages for {activeComponent.shortTitle}:</span>{' '}
                <span className="font-medium text-slate-900">
                  {savedForCurrentComponent
                    .map((item) => getLanguageByCode(item.langCode).name)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Hardware components and custom upload"
            className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 p-1.5 bg-slate-200/70 rounded-xl"
          >
            {SYSTEM_COMPONENTS.map((comp) => {
              const active = comp.id === selectedComponentId;
              const compSaved = savedItems.filter(
                (i) => i.componentId === comp.id && i.langCode !== 'en'
              );
              return (
                <button
                  key={comp.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setSelectedComponentId(comp.id)}
                  className={`px-3.5 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <div className="text-xs font-semibold truncate">
                    {comp.shortTitle}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {comp.category}
                    {compSaved.length > 0 ? ` · ${compSaved.length} saved` : ''}
                  </div>
                </button>
              );
            })}

            <button
              role="tab"
              type="button"
              aria-selected={isCustomMode}
              onClick={() => setSelectedComponentId('custom-new')}
              className={`px-3.5 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                isCustomMode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <div className="text-xs font-semibold truncate text-sky-800">
                Upload PDF / JPEG
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                Custom Material{customItems.length > 0 ? ` · ${customItems.length}` : ''}
              </div>
            </button>
          </div>
        </section>

        {/* Two-Zone Sandbox Split: Stage (7 cols, or 12 cols for UNO R3 3-Pane Studio) + Concept & Audio Deck */}
        <section
          id="lab-stage"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Left Stage */}
          <div
            className={`${
              selectedComponentId === 'uno-r3' ? 'lg:col-span-12' : 'lg:col-span-7'
            } bg-white border border-slate-200 rounded-2xl p-6 space-y-6`}
          >
            {isCustomMode ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs text-slate-500">
                      <span>Multimodal Upload</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>PDF, JPEG, PNG, WebP, or Text</span>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 mt-0.5">
                      {activeCustomItem ? activeCustomItem.title : 'Upload Study Material'}
                    </h2>
                  </div>
                  {activeCustomItem && (
                    <button
                      type="button"
                      onClick={() => setSelectedComponentId('custom-new')}
                      className="text-xs font-medium text-sky-700 hover:text-sky-900 cursor-pointer whitespace-nowrap"
                    >
                      New Upload
                    </button>
                  )}
                </div>

                <CustomMaterialPanel
                  selectedLang={selectedLang}
                  customItems={customItems}
                  activeCustomId={activeCustomItem?.id ?? null}
                  onSelectCustomItem={(item) => setSelectedComponentId(item.id)}
                  onIngestComplete={({ customItem, localization: newLoc }) => {
                    setErrorMessage(null);
                    setCustomItems((prev) => [
                      customItem,
                      ...prev.filter((i) => i.id !== customItem.id),
                    ]);
                    setSelectedComponentId(customItem.id);
                    setLocalization(newLoc);
                    setTextOrigin(
                      selectedLang === 'en' ? 'source' : 'newly-translated'
                    );
                    setAudioOrigin('none');
                    refreshSavedLibrary();
                  }}
                  onError={(msg) => setErrorMessage(msg)}
                />
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="text-xs text-slate-500">
                      <span>{activeComponent.category}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{activeComponent.stageLabel}</span>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 mt-0.5">
                      {activeComponent.title}
                    </h2>
                  </div>
                  <div className="text-xs font-mono text-slate-500">
                    Interactive Simulation
                  </div>
                </div>

                <ComponentStage componentId={selectedComponentId} />

                {/* Technical Specs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
                  {activeComponent.specs.map((spec) => (
                    <div key={spec.label}>
                      <div className="text-xs text-slate-500">{spec.label}</div>
                      <div className="text-sm font-medium font-mono tabular-nums text-slate-900 mt-0.5">
                        {spec.value}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Multilingual Concept & Audio Deck */}
          <div
            id="concept-deck"
            className={`${
              selectedComponentId === 'uno-r3' ? 'lg:col-span-12' : 'lg:col-span-5'
            } bg-white border border-slate-200 rounded-2xl p-6 space-y-5`}
          >
            {/* Language Controls */}
            <div className="space-y-3 border-b border-slate-100 pb-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <Globe className="w-4 h-4 text-sky-700" />
                  <span>Explanation Language</span>
                </div>

                {selectedLang !== 'en' && (
                  <button
                    type="button"
                    onClick={() => setShowEnglishCompare((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showEnglishCompare ? 'Hide English' : 'Compare English'}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg flex-wrap">
                  {primaryLanguages.map((lang) => {
                    const isSelected = lang.code === selectedLang;
                    const isSaved = savedItems.some(
                      (i) =>
                        i.componentId === selectedComponentId &&
                        i.langCode === lang.code
                    );
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setSelectedLang(lang.code)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          isSelected
                            ? 'bg-sky-700 text-white shadow-sm'
                            : 'text-slate-700 hover:text-slate-900 hover:bg-white/70'
                        }`}
                      >
                        {lang.name}
                        {lang.code !== 'en' ? ` (${lang.nativeName})` : ''}
                        {isSaved && !isSelected ? ' · Saved' : ''}
                      </button>
                    );
                  })}
                </div>

                <select
                  aria-label="More languages"
                  value={
                    extraLanguages.some((l) => l.code === selectedLang)
                      ? selectedLang
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) setSelectedLang(e.target.value);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 cursor-pointer"
                >
                  <option value="" disabled>
                    More languages...
                  </option>
                  {extraLanguages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status line (unboxed, clean icon + text) */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 min-w-0">
                  {isLoadingText || isTranslating ? (
                    <Loader2 className="w-3.5 h-3.5 text-sky-700 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate">{statusLine}</span>
                </div>

                {selectedLang !== 'en' && !isTranslating && localization && (
                  <button
                    type="button"
                    onClick={handleRegenerateTranslation}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retranslate</span>
                  </button>
                )}
              </div>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-900 text-xs flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">Unable to complete request</p>
                  <p className="text-red-700">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Audio Listen & Persistence Bar */}
            <AudioPlayerBar
              audioRef={audioRef}
              audioUrl={localization?.audioUrl ?? null}
              disabled={!localization}
              isPlaying={isPlaying}
              isGeneratingAudio={isGeneratingAudio}
              audioStatusText={audioStatusText}
              currentTime={currentTime}
              duration={duration}
              playbackRate={playbackRate}
              onTogglePlay={handleListenToggle}
              onSeek={handleSeek}
              onChangeRate={handleRateChange}
              onReplay={handleReplay}
              languageLabel={activeLanguage.name}
            />

            {/* Explanation Body */}
            {isTranslating || isLoadingText ? (
              <div className="py-10 text-center space-y-2.5">
                <Loader2 className="w-6 h-6 text-sky-700 animate-spin mx-auto" />
                <p className="text-sm font-medium text-slate-800">
                  {isTranslating
                    ? `Translating ${activeComponent.shortTitle} into ${activeLanguage.name}...`
                    : 'Loading saved lesson...'}
                </p>
                <p className="text-xs text-slate-500">
                  {isTranslating
                    ? 'Using Gemini to translate and save the explanation for future sessions.'
                    : 'Checking saved text and audio storage.'}
                </p>
              </div>
            ) : localization ? (
              <article className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500">
                    {activeLanguage.name} ({activeLanguage.nativeName})
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mt-0.5 leading-snug">
                    {localization.title}
                  </h3>
                </div>

                <div className="space-y-3 text-sm leading-relaxed text-slate-700">
                  <p>{localization.summary}</p>

                  <div className="pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-900 mb-1">
                      How It Works
                    </h4>
                    <p>{localization.mechanism}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-900 mb-1">
                      Where You Use It
                    </h4>
                    <p>{localization.realWorld}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-900 mb-1">
                      Key Takeaway
                    </h4>
                    <p className="text-slate-900 font-medium">
                      {localization.keyTakeaway}
                    </p>
                  </div>
                </div>

                {showEnglishCompare && selectedLang !== 'en' && (
                  <div className="pt-4 border-t border-slate-200 space-y-2 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      <span>Original English Reference</span>
                    </div>
                    <p>{activeCustomItem ? activeCustomItem.summary : activeComponent.summary}</p>
                    <p>{activeCustomItem ? activeCustomItem.mechanism : activeComponent.mechanism}</p>
                  </div>
                )}

                <DoubtTutorSection
                  componentId={selectedComponentId}
                  langCode={selectedLang}
                  onStopMainAudio={() => {
                    if (audioRef.current && isPlaying) {
                      audioRef.current.pause();
                      setIsPlaying(false);
                    }
                  }}
                  onError={(msg) => setErrorMessage(msg || null)}
                />
              </article>
            ) : selectedComponentId === 'custom-new' ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  Ready for PDF, JPEG, PNG, or Text
                </p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Upload a PDF document or JPEG/PNG image on the left to extract its concepts, translate into {activeLanguage.name}, and save audio narration.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        {/* How SkillOS Works Section */}
        <section
          id="workflow"
          className="border-t border-slate-200 pt-8 pb-4 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="space-y-1.5">
            <div className="text-xs font-mono text-sky-700">01. Translate & Save</div>
            <h3 className="text-sm font-semibold text-slate-900">
              Select a language like Tamil
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              SkillOS translates text, PDFs, or JPEG/PNG diagrams with Gemini and saves the lesson so it is ready whenever you return.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-mono text-sky-700">02. Speak & Persist</div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-sky-700" />
              <span>Click Listen</span>
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              SkillOS sends your saved Tamil text to Gemini TTS, stores the synthesized audio file on disk, and begins playback right away.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-mono text-sky-700">03. Instant Reopen</div>
            <h3 className="text-sm font-semibold text-slate-900">
              Open it again anytime
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Refreshing the page or revisiting from Saved Library loads your saved Tamil text and audio immediately without repeating generation.
            </p>
          </div>
        </section>

        <TechnicalGuide />
      </main>

      <SavedLibraryDrawer
        open={libraryOpen}
        items={savedItems}
        customItems={customItems}
        onClose={() => setLibraryOpen(false)}
        onSelectLesson={(componentId, langCode) => {
          setSelectedComponentId(componentId);
          setSelectedLang(langCode);
        }}
        onDeleteLesson={handleDeleteSaved}
      />
    </div>
  );
}
