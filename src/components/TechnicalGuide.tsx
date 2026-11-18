import { useState } from 'react';
import { Copy, Check, BookOpen, Cpu, Layers } from 'lucide-react';

type GuideTab = 'help' | 'stack' | 'integrate';

interface CodeSnippetBlockProps {
  title: string;
  code: string;
}

function CodeSnippetBlock({ title, code }: CodeSnippetBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-900">
      <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between gap-3">
        <span className="text-xs font-mono text-slate-200 truncate">{title}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-100 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono text-slate-100 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const STEP_1_INIT_CODE = `import { GoogleGenAI } from "@google/genai";

// Server-side only: never import @google/genai in browser code.
// apiVersion: "v1beta" is required for speechConfig and speechMetadata.
export function createGeminiClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    apiVersion: "v1beta",
    httpOptions: {
      headers: { "User-Agent": "aistudio-build" },
    },
  });
}`;

const STEP_2_TRANSLATE_CODE = `import { Type } from "@google/genai";

// Supports plain text OR multimodal PDF / JPEG / PNG via inlineData
const parts = uploadedFile
  ? [
      { inlineData: { mimeType: uploadedFile.mimeType, data: base64String } },
      { text: \`Extract and translate this study material into \${targetLanguage}.\` },
    ]
  : [{ text: \`Translate this lesson into \${targetLanguage}: ...\` }];

const response = await ai.models.generateContent({
  model: "gemini-4-hydrogen",
  contents: { parts },
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        summary: { type: Type.STRING },
        spokenScript: { type: Type.STRING },
      },
      required: ["title", "summary", "spokenScript"],
    },
  },
});

const translated = JSON.parse(response.text ?? "{}");
// Save translated JSON + sha256(spokenScript) to your database or disk.`;

const STEP_3_TTS_CODE = `const ttsResponse = await ai.models.generateContent({
  model: "gemini-3.8-flash-lite-tts",
  contents: [
    {
      role: "user",
      parts: [
        {
          text: savedLesson.spokenScript,
          speechMetadata: { style: "Clear, warm STEM educator" },
        },
      ],
    },
  ],
  config: {
    responseModalities: ["AUDIO"],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: "Kore" },
      },
    },
  },
});

const base64Wav =
  ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
const wavBuffer = Buffer.from(base64Wav, "base64");
// Unary TTS returns a complete 24kHz mono 16-bit WAV file. Save directly as .wav.`;

const STEP_4_AUDIO_HOOK_CODE = `// Manage <audio> src imperatively so React re-renders never interrupt play()
const audioRef = useRef<HTMLAudioElement | null>(null);
const loadedUrlRef = useRef<string | null>(null);

const syncAudioSource = (url: string | null) => {
  const el = audioRef.current;
  if (!el || !url || loadedUrlRef.current === url) return;
  loadedUrlRef.current = url;
  el.src = url;
  el.load();
};

const playSavedOrGenerate = async (existingUrl: string | null) => {
  const url = existingUrl ?? (await fetch("/api/tts", { method: "POST", ... }).then(r => r.json())).audioUrl;
  syncAudioSource(url);
  await audioRef.current?.play();
};`;

export function TechnicalGuide() {
  const [activeTab, setActiveTab] = useState<GuideTab>('help');

  const stackRows = [
    {
      layer: 'Frontend UI',
      tech: 'React 19 · TypeScript · Tailwind CSS v4 · Lucide Icons',
      role: 'Two-zone interactive hardware simulators, language switcher, custom audio bar, and Saved Library drawer.',
    },
    {
      layer: 'Backend Server',
      tech: 'Node.js 22 · Express 4 · Vite 8 Middleware · tsx',
      role: 'Serves REST API routes (/api/translate, /api/tts, /api/audio) and keeps GEMINI_API_KEY strictly server-side.',
    },
    {
      layer: 'Translation & OCR',
      tech: 'Gemini 4 Hydrogen (gemini-4-hydrogen) via @google/genai',
      role: 'Extracts and translates text, PDF documents, and JPEG/PNG/WebP images using inlineData + JSON responseSchema.',
    },
    {
      layer: 'Voice Synthesis',
      tech: 'Gemini 3.8 Flash Lite TTS (gemini-3.8-flash-lite-tts)',
      role: 'Converts translated text into a 24kHz mono 16-bit WAV file using v1beta speechConfig and speechMetadata.',
    },
    {
      layer: 'Persistence Layer',
      tech: 'JSON Metadata Store (.data/localizations.json) · WAV Files (.data/audio/)',
      role: 'Caches translations by componentId:langCode and SHA-256 textHash so reopening loads saved text and audio instantly.',
    },
  ];

  return (
    <section
      id="tech-guide"
      aria-label="Help and technical integration guide"
      className="border-t border-slate-200 pt-10 pb-8 space-y-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-sky-700">Documentation</div>
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 mt-0.5">
            Help & Technical Architecture Guide
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Learn how to use SkillOS, inspect the underlying technology stack, and integrate this translate-and-speak persistence pattern into your own application.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Technical guide sections"
          className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
        >
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'help'}
            onClick={() => setActiveTab('help')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'help'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Student Help</span>
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'stack'}
            onClick={() => setActiveTab('stack')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'stack'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>How It Was Built</span>
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'integrate'}
            onClick={() => setActiveTab('integrate')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'integrate'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Integration Guide</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Student Help */}
      {activeTab === 'help' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Using SkillOS Step by Step
            </h3>
            <ol className="space-y-3 text-sm text-slate-700 leading-relaxed list-decimal list-inside">
              <li>
                <span className="font-medium text-slate-900">Explore or upload material:</span>{' '}
                Pick any hardware module at the top or choose <span className="font-medium">Upload PDF / JPEG</span> to upload a PDF worksheet, JPEG/PNG diagram photo, or pasted notes.
              </li>
              <li>
                <span className="font-medium text-slate-900">Select a language (e.g., Tamil):</span>{' '}
                Click <span className="font-medium">Tamil (தமிழ்)</span> or pick another language from the dropdown. SkillOS extracts and translates the explanation with Gemini and saves it immediately.
              </li>
              <li>
                <span className="font-medium text-slate-900">Click Listen:</span>{' '}
                SkillOS sends the saved translated script to Gemini Text-to-Speech, saves the resulting WAV audio file, and starts playback. Use the speed buttons (<span className="font-mono text-xs">0.85x · 1x · 1.25x</span>) or slider to review at your own pace.
              </li>
              <li>
                <span className="font-medium text-slate-900">Reopen anytime:</span>{' '}
                Refreshing the browser or choosing an item from <span className="font-medium">Saved Library</span> loads your saved text and saved audio directly without regenerating.
              </li>
            </ol>
          </div>

          <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
            <h3 className="text-base font-semibold text-slate-900">
              Tips & Troubleshooting
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="font-medium text-slate-900">Compare with English</div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  While reading a Tamil or Hindi explanation, click Compare English in the Explanation panel to verify technical terms side by side.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="font-medium text-slate-900">Refresh a translation</div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Click Retranslate next to the status line to request a fresh Gemini translation; any stale cached audio for that language is cleared automatically so Listen stays in sync.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="font-medium text-slate-900">Manage saved lessons</div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Open Saved Library in the top bar to jump straight to any previously translated component or delete cached text and audio files.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Architecture & Technology Stack */}
      {activeTab === 'stack' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="text-xs text-slate-500">Request Flow 1 · Translate</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Client → POST /api/translate → Gemini 4 Hydrogen → .data/localizations.json
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Request Flow 2 · Speak</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Client → POST /api/tts → Gemini 3.8 Flash Lite TTS → .data/audio/*.wav
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Request Flow 3 · Reopen</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Client → GET /api/components/:id/localization → Saved Text + /api/audio/*.wav
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Layer</th>
                  <th className="py-2.5 pr-4 font-medium">Technologies</th>
                  <th className="py-2.5 font-medium">Responsibility in SkillOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {stackRows.map((row) => (
                  <tr key={row.layer} className="align-top">
                    <td className="py-3.5 pr-4 font-medium text-slate-900 whitespace-nowrap">
                      {row.layer}
                    </td>
                    <td className="py-3.5 pr-4 font-mono text-xs text-sky-800">
                      {row.tech}
                    </td>
                    <td className="py-3.5 text-xs text-slate-600 leading-relaxed">
                      {row.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Step-by-Step Integration Guide */}
      {activeTab === 'integrate' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">
              Integrating Translate + Persistent Gemini TTS into Another App
            </h3>
            <p className="text-xs text-slate-600">
              Follow these 5 steps to reuse SkillOS’s server-side Gemini translation, WAV persistence, and race-free browser playback in any React, Next.js, or Express application.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-mono text-sky-700">Step 1</div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Install @google/genai and initialize on the server with v1beta
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Install <span className="font-mono">@google/genai &gt;= 2.29.1</span> and set <span className="font-mono">apiVersion: "v1beta"</span> so both <span className="font-mono">speechConfig</span> and <span className="font-mono">speechMetadata</span> are accepted by the Gemini TTS endpoint.
                </p>
              </div>
              <CodeSnippetBlock
                title="server/gemini.ts"
                code={STEP_1_INIT_CODE}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-mono text-sky-700">Step 2</div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Extract & translate text, PDFs, or JPEG/PNG images
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Pass plain text or multimodal <span className="font-mono">inlineData</span> (<span className="font-mono">application/pdf</span>, <span className="font-mono">image/jpeg</span>, <span className="font-mono">image/png</span>) to <span className="font-mono">gemini-4-hydrogen</span> with <span className="font-mono">responseSchema</span>. Cache by <span className="font-mono">itemId:langCode</span> and track a SHA-256 hash so audio invalidates if the text changes.
                </p>
              </div>
              <CodeSnippetBlock
                title="POST /api/translate"
                code={STEP_2_TRANSLATE_CODE}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-mono text-sky-700">Step 3</div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Generate and persist WAV audio via Gemini TTS
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Call <span className="font-mono">gemini-3.8-flash-lite-tts</span> with <span className="font-mono">responseModalities: ["AUDIO"]</span>. Unary responses return a complete RIFF WAV file in <span className="font-mono">inlineData.data</span>—write it directly as <span className="font-mono">.wav</span> and serve via <span className="font-mono">GET /api/audio/:file</span>.
                </p>
              </div>
              <CodeSnippetBlock
                title="POST /api/tts"
                code={STEP_3_TTS_CODE}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-mono text-sky-700">Step 4</div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Manage HTMLAudioElement src imperatively in React
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Avoid binding a reactive <span className="font-mono">src</span> prop directly on <span className="font-mono">&lt;audio&gt;</span> when calling <span className="font-mono">play()</span> alongside state updates. Sync <span className="font-mono">el.src</span> through a ref guard so re-renders never trigger a duplicate <span className="font-mono">load()</span>.
                </p>
              </div>
              <CodeSnippetBlock
                title="src/hooks/useSavedAudio.ts"
                code={STEP_4_AUDIO_HOOK_CODE}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">Step 5 · Production Storage Swap:</span>{' '}
              SkillOS uses local <span className="font-mono">.data/</span> storage for zero-setup portability. For multi-instance cloud hosting, store the localization JSON in PostgreSQL or Firestore and upload the <span className="font-mono">wavBuffer</span> to Cloud Storage or S3.
            </div>
            <div>
              <span className="font-semibold text-slate-900">Environment & Security:</span>{' '}
              Keep <span className="font-mono">GEMINI_API_KEY</span> exclusively on the server and validate audio filenames with a strict regex before calling <span className="font-mono">res.sendFile</span>.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
