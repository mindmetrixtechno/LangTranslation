import { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Send,
  Volume2,
  Pause,
  Loader2,
  Cable,
  MessageCircleQuestion,
} from 'lucide-react';
import { getLanguageByCode } from '../data/languages';
import type { DoubtEntry } from '../types/localization';
import { RealWorldWireDiagram } from './RealWorldWireDiagram';

interface DoubtTutorSectionProps {
  componentId: string;
  langCode: string;
  onStopMainAudio: () => void;
  onError: (message: string) => void;
}

const DOUBT_PROMPT_BY_LANG: Record<string, string> = {
  ta: 'உங்களுக்கு ஏதேனும் சந்தேகம் உள்ளதா? இப்போது கேளுங்கள்.',
  hi: 'क्या आपको कोई संदेह है? अभी पूछें।',
  te: 'మీకు ఏదైనా సందేహం ఉందా? ఇప్పుడే అడగండి.',
  kn: 'ನಿಮಗೆ ಯಾವುದೇ ಸಂದೇಹವಿದೆಯೇ? ಈಗಲೇ ಕೇಳಿ.',
  ml: 'നിങ്ങൾക്ക് എന്തെങ്കിലും സംശയമുണ്ടോ? ഇപ്പോൾ ചോദിക്കൂ.',
  es: '¿Tienes alguna duda? Pregunta ahora.',
  fr: 'Avez-vous un doute ? Demandez maintenant.',
  ja: '疑問はありますか？今すぐ質問してください。',
};

async function convertBlobToWav16kBase64(
  blob: Blob
): Promise<{ base64: string; mimeType: string }> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const decodeCtx = new AudioCtx();
    const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
    await decodeCtx.close();

    const targetRate = 16000;
    const frameCount = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const offline = new OfflineAudioContext(1, frameCount, targetRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    const samples = rendered.getChannelData(0);

    // Build 16-bit PCM RIFF WAV
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true
      );
      offset += 2;
    }

    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return { base64: btoa(binary), mimeType: 'audio/wav' };
  } catch {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read audio.'));
      reader.readAsDataURL(blob);
    });
    return {
      base64: base64Data,
      mimeType: blob.type || 'audio/webm',
    };
  }
}

export function DoubtTutorSection({
  componentId,
  langCode,
  onStopMainAudio,
  onError,
}: DoubtTutorSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [doubts, setDoubts] = useState<DoubtEntry[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [generatingDiagramId, setGeneratingDiagramId] = useState<string | null>(
    null
  );
  const [ttsLoadingKey, setTtsLoadingKey] = useState<string | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const meterTimerRef = useRef<number | null>(null);
  const meterCtxRef = useRef<AudioContext | null>(null);
  const doubtAudioRef = useRef<HTMLAudioElement | null>(null);
  const loadedDoubtAudioRef = useRef<string | null>(null);

  const lang = getLanguageByCode(langCode);

  const stopDoubtAudio = () => {
    const el = doubtAudioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlayingKey(null);
  };

  useEffect(() => {
    let cancelled = false;
    stopDoubtAudio();
    setQuestionInput('');

    if (!componentId || componentId === 'custom-new') {
      setDoubts([]);
      return;
    }

    async function loadDoubts() {
      try {
        const res = await fetch(
          `/api/components/${encodeURIComponent(componentId)}/doubts?lang=${encodeURIComponent(langCode)}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items?: DoubtEntry[] };
        if (!cancelled && Array.isArray(data.items)) {
          setDoubts(data.items);
          if (data.items.length > 0) {
            setIsOpen(true);
          }
        }
      } catch {
        // Non-blocking
      }
    }

    loadDoubts();
    return () => {
      cancelled = true;
    };
  }, [componentId, langCode]);

  const submitQuestion = async (textToAsk: string) => {
    const trimmed = textToAsk.trim();
    if (!trimmed) return;
    onError('');
    setIsAsking(true);
    try {
      const res = await fetch('/api/doubt/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId,
          langCode,
          question: trimmed,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        entry?: DoubtEntry;
        error?: string;
      };
      if (!res.ok || !body.entry) {
        throw new Error(body.error || 'Could not answer your doubt.');
      }
      setDoubts((prev) => [body.entry!, ...prev]);
      setQuestionInput('');
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAsking(false);
    }
  };

  const cleanupMicMeter = () => {
    if (meterTimerRef.current !== null) {
      window.clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
    if (meterCtxRef.current) {
      meterCtxRef.current.close().catch(() => {});
      meterCtxRef.current = null;
    }
    setMicLevel(0);
  };

  const handleToggleRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      cleanupMicMeter();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      onError(
        'Microphone recording is not supported in this browser. Please type your doubt below.'
      );
      return;
    }

    try {
      onError('');
      stopDoubtAudio();
      onStopMainAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Live mic level meter
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const meterCtx = new AudioCtx();
        const analyser = meterCtx.createAnalyser();
        analyser.fftSize = 256;
        const src = meterCtx.createMediaStreamSource(stream);
        src.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        meterCtxRef.current = meterCtx;
        meterTimerRef.current = window.setInterval(() => {
          analyser.getByteTimeDomainData(dataArray);
          let peak = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const dev = Math.abs(dataArray[i] - 128) / 128;
            if (dev > peak) peak = dev;
          }
          setMicLevel(Math.min(100, Math.round(peak * 220)));
        }, 80);
      } catch {
        // Ignore meter fallback if AudioContext is restricted
      }

      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        cleanupMicMeter();
        stream.getTracks().forEach((track) => track.stop());
        const rawMime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: rawMime });
        if (blob.size < 200) {
          onError(
            'Recording was too short. Hold or speak for at least 1 second before clicking Stop & Ask.'
          );
          return;
        }

        setIsTranscribing(true);
        try {
          const { base64, mimeType } = await convertBlobToWav16kBase64(blob);

          const res = await fetch('/api/doubt/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              langCode,
              audioBase64: base64,
              mimeType,
            }),
          });
          const rawText = await res.text();
          let body: { transcript?: string; error?: string } = {};
          try {
            body = JSON.parse(rawText) as { transcript?: string; error?: string };
          } catch {
            // Non-JSON response
          }
          if (!res.ok || !body.transcript) {
            throw new Error(
              body.error ||
                (rawText && !rawText.startsWith('<') ? rawText : '') ||
                `Voice transcription failed (HTTP ${res.status}). Please type your doubt or try again.`
            );
          }

          setQuestionInput(body.transcript);
          await submitQuestion(body.transcript);
        } catch (err) {
          onError(err instanceof Error ? err.message : String(err));
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      cleanupMicMeter();
      onError(
        err instanceof Error
          ? `Microphone access needed to talk: ${err.message}`
          : 'Microphone access was denied.'
      );
    }
  };

  const handleRequestVisualDiagram = async (doubtId: string) => {
    onError('');
    setGeneratingDiagramId(doubtId);
    try {
      const res = await fetch('/api/doubt/visual-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentId, langCode, doubtId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        entry?: DoubtEntry;
        error?: string;
      };
      if (!res.ok || !body.entry) {
        throw new Error(body.error || 'Failed to create visual wire diagram.');
      }
      setDoubts((prev) =>
        prev.map((item) => (item.id === doubtId ? body.entry! : item))
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingDiagramId(null);
    }
  };

  const handleListenDoubt = async (
    doubt: DoubtEntry,
    target: 'answer' | 'diagram'
  ) => {
    const key = `${doubt.id}:${target}`;
    const el = doubtAudioRef.current;
    if (!el) return;

    if (playingKey === key) {
      stopDoubtAudio();
      return;
    }

    onError('');
    onStopMainAudio();
    const existingUrl =
      target === 'diagram' ? doubt.visualDiagram?.audioUrl : doubt.audioUrl;

    if (existingUrl) {
      try {
        if (loadedDoubtAudioRef.current !== existingUrl) {
          loadedDoubtAudioRef.current = existingUrl;
          el.src = existingUrl;
          el.load();
        }
        await el.play();
        setPlayingKey(key);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        onError(err instanceof Error ? err.message : String(err));
      }
      return;
    }

    setTtsLoadingKey(key);
    try {
      const res = await fetch('/api/doubt/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId,
          langCode,
          doubtId: doubt.id,
          target,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        audioUrl?: string;
        entry?: DoubtEntry;
        error?: string;
      };
      if (!res.ok || !body.audioUrl || !body.entry) {
        throw new Error(body.error || 'Failed to generate audio.');
      }

      setDoubts((prev) =>
        prev.map((item) => (item.id === doubt.id ? body.entry! : item))
      );
      loadedDoubtAudioRef.current = body.audioUrl;
      el.src = body.audioUrl;
      el.load();
      await el.play();
      setPlayingKey(key);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setTtsLoadingKey(null);
    }
  };

  const localizedPrompt = DOUBT_PROMPT_BY_LANG[langCode];

  return (
    <div className="pt-5 border-t border-slate-200 space-y-4">
      <audio
        ref={doubtAudioRef}
        preload="auto"
        onEnded={() => setPlayingKey(null)}
        onPause={() => setPlayingKey(null)}
      />

      {/* Closing Prompt + Single Primary Action Button */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            Do you have any doubt? Ask now
          </div>
          {localizedPrompt && (
            <div className="text-xs text-slate-600">{localizedPrompt}</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <MessageCircleQuestion className="w-4 h-4" />
          <span>{isOpen ? 'Hide Doubt Tutor' : 'Ask Now'}</span>
        </button>
      </div>

      {/* Interactive Voice + Text Doubt Tutor */}
      {isOpen && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitQuestion(questionInput);
            }}
            className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700">
                Talk or type in {lang.name} ({lang.nativeName})
              </span>

              <button
                type="button"
                disabled={isTranscribing || isAsking}
                onClick={handleToggleRecording}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-sky-700 hover:bg-sky-800 text-white disabled:opacity-60'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-3.5 h-3.5" />
                    <span>Stop & Ask</span>
                  </>
                ) : isTranscribing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Listening to you...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Talk in {lang.name}</span>
                  </>
                )}
              </button>
            </div>

            {isRecording && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span>Listening via microphone... speak now</span>
                  <span className="font-mono tabular-nums">{micLevel}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 transition-all duration-75"
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder={`Ask your doubt in ${lang.name}...`}
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-600"
              />
              <button
                type="submit"
                disabled={isAsking || isTranscribing || !questionInput.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isAsking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isAsking ? 'Answering...' : 'Ask'}</span>
              </button>
            </div>
          </form>

          {/* Saved & Live Doubt Answers */}
          {doubts.map((doubt) => {
            const answerKey = `${doubt.id}:answer`;
            const diagramKey = `${doubt.id}:diagram`;
            return (
              <div
                key={doubt.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
              >
                <div className="text-xs font-medium text-slate-500">
                  Your question · {lang.name}
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {doubt.question}
                </p>

                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {doubt.answer}
                  </p>
                  <p className="text-xs text-slate-500">
                    Workbook guide: {doubt.workbookReference}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={ttsLoadingKey === answerKey}
                    onClick={() => handleListenDoubt(doubt, 'answer')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {ttsLoadingKey === answerKey ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Preparing...</span>
                      </>
                    ) : playingKey === answerKey ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Answer</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Listen in {lang.name}</span>
                      </>
                    )}
                  </button>

                  {!doubt.visualDiagram && (
                    <button
                      type="button"
                      disabled={generatingDiagramId === doubt.id}
                      onClick={() => handleRequestVisualDiagram(doubt.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {generatingDiagramId === doubt.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Building Wire Diagram...</span>
                        </>
                      ) : (
                        <>
                          <Cable className="w-3.5 h-3.5 text-sky-700" />
                          <span>Still don&apos;t understand? Show Real-World Wire Diagram</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {doubt.visualDiagram && (
                  <RealWorldWireDiagram
                    diagram={doubt.visualDiagram}
                    isSpeaking={playingKey === diagramKey}
                    isGeneratingAudio={ttsLoadingKey === diagramKey}
                    onListenDiagram={() => handleListenDoubt(doubt, 'diagram')}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
