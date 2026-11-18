import { useState } from 'react';
import { Copy, Check, BookOpen, Cpu, Layers, ShieldCheck } from 'lucide-react';

type GuideTab = 'help' | 'stack' | 'integrate' | 'ai-boundary';

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

const STEP_5_VOICE_ASK_CODE = `// 1. Browser: convert MediaRecorder Blob -> 16kHz mono PCM WAV via OfflineAudioContext
// 2. Server (/api/doubt/transcribe): multi-tier transcription with automatic fallback
let transcript = "";
try {
  const res = await ai.models.generateContent({
    model: "gemini-3.5-transcribe",
    contents: { parts: [audioPart, { text: \`Transcribe this audio in \${langName}.\` }] },
  });
  transcript = (res.text ?? "").trim();
} catch {
  // Fallback to multimodal flash-lite (or gemini-3.5-transcribe-live over 16kHz PCM)
  const fallback = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite",
    contents: { parts: [audioPart, { text: "Transcribe spoken words as JSON { hasSpeech, transcript }." }] },
    config: { responseMimeType: "application/json", ... },
  });
}

// 3. Server (/api/doubt/ask): answer in the student's screen language from the workbook
const tutorRes = await ai.models.generateContent({
  model: "gemini-4-hydrogen",
  contents: \`Student doubt: "\${transcript}"\\nWorkbook lesson: \${workbookContext}\`,
  config: {
    systemInstruction: \`Always answer in \${langName} grounded in the active workbook.\`,
    responseMimeType: "application/json",
  },
});`;

const STEP_6_WIRE_DIAGRAM_CODE = `// Server (/api/doubt/visual-diagram): generate a 3-node + 2-wire JSON schematic
const diagramRes = await ai.models.generateContent({
  model: "gemini-4-hydrogen",
  contents: \`Connect a familiar real-world object via wires to "\${lessonTitle}" in \${langName}.\`,
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        analogySummary: { type: Type.STRING },
        spokenWalkthrough: { type: Type.STRING },
        nodes: { type: Type.ARRAY, items: { /* kind: real-world | wire-bridge | hardware */ } },
        wires: { type: Type.ARRAY, items: { /* from -> to, signalLabel, explanation */ } },
      },
      required: ["title", "analogySummary", "spokenWalkthrough", "nodes", "wires"],
    },
  },
});
// Client (<RealWorldWireDiagram />): renders interactive SVG blocks + animated wires
// with zero extra AI calls when reopened from .data/doubts.json.`;

export function TechnicalGuide() {
  const [activeTab, setActiveTab] = useState<GuideTab>('help');

  const stackRows = [
    {
      layer: 'Frontend UI & Simulators',
      tech: 'React 19 · TypeScript · Tailwind CSS v4 · Interactive SVG · Web Serial',
      role: '7 deterministic labs (including UNO R3 Block Studio & .ino codegen), language switcher, imperative audio player, Doubt Tutor, and 3-node wire schematics.',
    },
    {
      layer: 'Browser Voice Capture',
      tech: 'MediaRecorder · AudioContext · AnalyserNode · OfflineAudioContext',
      role: 'Captures microphone audio, displays a live input level bar, and resamples recordings client-side into clean 16kHz mono 16-bit PCM WAV.',
    },
    {
      layer: 'Backend Server',
      tech: 'Node.js 22 · Express 4 · Vite 8 Middleware · tsx',
      role: 'Serves REST routes (/api/translate, /api/tts, /api/doubt/*, /api/audio) and keeps GEMINI_API_KEY strictly server-side.',
    },
    {
      layer: 'Translation, OCR & Tutor',
      tech: 'Gemini 4 Hydrogen (gemini-4-hydrogen) via @google/genai',
      role: 'Translates lessons, extracts PDF/JPEG/PNG uploads via inlineData, answers doubts from the workbook, and structures 3-node wire diagrams.',
    },
    {
      layer: 'Voice Transcription',
      tech: 'gemini-3.5-transcribe → gemini-3.1-flash-lite → gemini-3.5-transcribe-live',
      role: 'Multi-tier speech-to-text pipeline that transcribes Tamil, English, and other supported languages with automatic fallback.',
    },
    {
      layer: 'Voice Synthesis (TTS)',
      tech: 'Gemini 3.8 Flash Lite TTS (gemini-3.8-flash-lite-tts)',
      role: 'Converts lesson scripts, doubt answers, and wire walkthroughs into 24kHz mono 16-bit WAV files using v1beta speechConfig.',
    },
    {
      layer: 'Persistence Layer',
      tech: '.data/localizations.json · .data/doubts.json · .data/audio/*.wav',
      role: 'Caches translations, saved doubts, wire diagrams, and WAV files on disk so reopening loads instantly with zero repeated AI calls.',
    },
  ];

  const aiBoundaryRows = [
    {
      feature: '7 Hardware Labs & UNO R3 Block-to-.ino Studio',
      withoutAi: 'Yes (100% Local)',
      engine: 'React state, math formulas, SVG & Web Serial',
      detail: 'Gates, waveforms, registers, UNO R3 pin simulations, Arduino C++ (.ino) generation, and USB Serial/Firmata run deterministically in the browser with zero AI.',
    },
    {
      feature: 'Mic Capture, Live Level Meter & 16kHz WAV Conversion',
      withoutAi: 'Yes (100% Browser)',
      engine: 'Web Audio API & MediaRecorder',
      detail: 'Audio recording, waveform metering, and WAV resampling run locally on the student device.',
    },
    {
      feature: 'Reopening Saved Lessons, Audio, Doubts & Wire Diagrams',
      withoutAi: 'Yes (Cached on Disk)',
      engine: 'JSON stores & static WAV files',
      detail: 'Once translated, spoken, answered, or graphed, everything is saved in .data/ and replays immediately without calling AI again.',
    },
    {
      feature: 'Translating New Languages & Reading Uploaded PDF / JPEG',
      withoutAi: 'Uses AI (On Demand)',
      engine: 'Gemini 4 Hydrogen',
      detail: 'Required the first time a lesson is translated into a language or when extracting concepts from a newly uploaded PDF/image.',
    },
    {
      feature: 'Transcribing Spoken Doubt ("Talk in [Language]")',
      withoutAi: 'Uses AI (or type without AI)',
      engine: 'Gemini Transcribe / Flash Lite',
      detail: 'Converts spoken Tamil/Hindi/English audio into text. Students can also type questions directly without mic or transcription.',
    },
    {
      feature: 'Answering Doubts & Creating New Real-World Wire Diagrams',
      withoutAi: 'Uses AI (Saved Afterward)',
      engine: 'Gemini 4 Hydrogen + JSON Schema',
      detail: 'Generates the tailored explanation grounded in the workbook and picks a real-world analogy + wire edges, then saves the diagram for offline SVG inspection.',
    },
    {
      feature: 'Generating New Spoken Audio ("Listen")',
      withoutAi: 'Uses AI (Saved as WAV)',
      engine: 'Gemini 3.8 Flash Lite TTS',
      detail: 'Synthesizes natural speech once per script and saves the .wav file so all future replays run natively in HTML5 <audio>.',
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
          className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg"
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

          <button
            role="tab"
            type="button"
            aria-selected={activeTab === 'ai-boundary'}
            onClick={() => setActiveTab('ai-boundary')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'ai-boundary'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AI vs. Non-AI</span>
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
                <span className="font-medium text-slate-900">Ask doubts by voice or text:</span>{' '}
                At the bottom of any lesson, click <span className="font-medium">Ask Now</span>, then click <span className="font-medium">Talk in [Language]</span> to speak into your mic (or type your question) and get a clearer answer in your screen language grounded in the workbook.
              </li>
              <li>
                <span className="font-medium text-slate-900">Still unclear? Connect wires to the real world:</span>{' '}
                Click <span className="font-medium">Still don&apos;t understand? Show Real-World Wire Diagram</span> on any answer to generate an interactive 3-block wire diagram linking an everyday object to the hardware concept, plus a <span className="font-medium">Listen</span> walkthrough.
              </li>
              <li>
                <span className="font-medium text-slate-900">Reopen anytime:</span>{' '}
                Refreshing the browser or choosing an item from <span className="font-medium">Saved Library</span> loads your saved text, audio, doubts, and wire diagrams directly without regenerating.
              </li>
            </ol>
          </div>

          <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
            <h3 className="text-base font-semibold text-slate-900">
              Tips & Troubleshooting
            </h3>
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="font-medium text-slate-900">Using Talk in [Language]</div>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Allow microphone access when prompted, watch the live percentage meter move as you speak for 1–2 seconds, then click Stop &amp; Ask. If a mic is unavailable, type directly in the box.
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
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
              <div className="text-xs text-slate-500">Flow 1 · Translate &amp; Persist</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Client → POST /api/translate → Gemini 4 Hydrogen → .data/localizations.json
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Flow 2 · Speak &amp; Cache WAV</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Client → POST /api/tts → Gemini 3.8 Flash Lite TTS → .data/audio/*.wav
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Flow 3 · Instant Reopen</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Client → GET /api/components/:id/localization → Saved Text + /api/audio/*.wav
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Flow 4 · Talk In (Voice → Text)</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Mic → 16kHz PCM WAV → POST /api/doubt/transcribe → Gemini Transcribe / Flash Lite
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Flow 5 · Workbook Doubt Answer</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                Question + Lesson Context → POST /api/doubt/ask → Gemini 4 Hydrogen → .data/doubts.json
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Flow 6 · Real-World Wire Diagram</div>
              <div className="text-sm font-medium text-slate-900 mt-1">
                POST /api/doubt/visual-diagram → 3-Node + 2-Wire JSON → Interactive SVG + Optional TTS
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
              Integrating Translate, Voice Ask &amp; Real-World Wire Diagrams into Another App
            </h3>
            <p className="text-xs text-slate-600">
              Follow these 7 steps to reuse SkillOS’s server-side Gemini translation, WAV persistence, voice doubt transcription, workbook tutor, and interactive SVG wire diagrams in any React, Next.js, or Express app.
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
                  Extract &amp; translate text, PDFs, or JPEG/PNG images
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

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-mono text-sky-700">Step 5</div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Implement Talk-In voice capture &amp; workbook doubt answering
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Convert browser <span className="font-mono">MediaRecorder</span> audio to 16kHz mono PCM WAV with <span className="font-mono">OfflineAudioContext</span>, transcribe via <span className="font-mono">gemini-3.5-transcribe</span> (falling back to <span className="font-mono">gemini-3.1-flash-lite</span> or <span className="font-mono">gemini-3.5-transcribe-live</span>), then pass the active workbook text to <span className="font-mono">gemini-4-hydrogen</span>.
                </p>
              </div>
              <CodeSnippetBlock
                title="POST /api/doubt/transcribe + /api/doubt/ask"
                code={STEP_5_VOICE_ASK_CODE}
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-mono text-sky-700">Step 6</div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Build Real-World Wire Connection SVG diagrams from JSON
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Request a strict 3-node (<span className="font-mono">real-world → wire-bridge → hardware</span>) and 2-wire JSON schema from Gemini, save it inside the doubt record, and render clickable SVG blocks with animated CSS stroke wires and optional Gemini TTS walkthrough audio.
                </p>
              </div>
              <CodeSnippetBlock
                title="POST /api/doubt/visual-diagram"
                code={STEP_6_WIRE_DIAGRAM_CODE}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-900">Step 7 · Production Storage Swap:</span>{' '}
              SkillOS uses local <span className="font-mono">.data/</span> storage for zero-setup portability. For multi-instance cloud hosting, store localizations and doubt histories in PostgreSQL or Firestore and upload WAV files to Cloud Storage or S3.
            </div>
            <div>
              <span className="font-semibold text-slate-900">Environment &amp; Security:</span>{' '}
              Keep <span className="font-mono">GEMINI_API_KEY</span> exclusively on the server and validate audio filenames with a strict regex before calling <span className="font-mono">res.sendFile</span>.
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: AI vs. Non-AI Breakdown */}
      {activeTab === 'ai-boundary' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-slate-100">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="text-xs font-mono text-emerald-700">Works Without AI</div>
              <h3 className="text-sm font-semibold text-slate-900">
                Interactive labs, mic capture &amp; all saved content
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every hardware simulator, audio player control, microphone recorder, WAV resampler, and interactive SVG wire diagram runs deterministically in TypeScript and React—zero AI calls are made when exploring simulators or reopening saved lessons, audio, or diagrams.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
              <div className="text-xs font-mono text-sky-700">Uses Gemini AI (Once &amp; Saved)</div>
              <h3 className="text-sm font-semibold text-slate-900">
                First-time translation, OCR, transcription, tutoring &amp; TTS
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                AI is involved only on the server when generating new outputs: translating into an uncached language, extracting uploaded PDFs/JPEGs, transcribing spoken doubts, answering new questions from the workbook, designing a new real-world wire analogy, or synthesizing a new WAV file.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2.5 pr-4 font-medium">Capability</th>
                  <th className="py-2.5 pr-4 font-medium">Runs Without AI?</th>
                  <th className="py-2.5 pr-4 font-medium">Underlying Engine</th>
                  <th className="py-2.5 font-medium">How It Works</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {aiBoundaryRows.map((row) => (
                  <tr key={row.feature} className="align-top">
                    <td className="py-3.5 pr-4 font-medium text-slate-900">
                      {row.feature}
                    </td>
                    <td className="py-3.5 pr-4 text-xs font-medium text-slate-800 whitespace-nowrap">
                      {row.withoutAi}
                    </td>
                    <td className="py-3.5 pr-4 font-mono text-xs text-sky-800 whitespace-nowrap">
                      {row.engine}
                    </td>
                    <td className="py-3.5 text-xs text-slate-600 leading-relaxed">
                      {row.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-900">Can you deploy SkillOS with zero runtime AI?</span>{' '}
            Yes—for an offline classroom or zero-API-cost distribution, pre-generate the <span className="font-mono">.data/</span> folder (translations, <span className="font-mono">.wav</span> audio, and pre-written wire diagrams) ahead of time and ship those static files. Students can explore all simulators, read every saved language, listen to all saved WAV audio, and inspect saved wire diagrams without any live AI calls.
          </div>
        </div>
      )}
    </section>
  );
}
