import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { SYSTEM_COMPONENTS } from './src/data/components.ts';
import { getLanguageByCode } from './src/data/languages.ts';

interface LocalizedContent {
  componentId: string;
  langCode: string;
  langName: string;
  title: string;
  summary: string;
  mechanism: string;
  realWorld: string;
  keyTakeaway: string;
  spokenScript: string;
  textHash: string;
  audioFile: string | null;
  audioUrl: string | null;
  updatedAt: string;
  audioUpdatedAt: string | null;
}

interface CustomLessonSource {
  id: string;
  title: string;
  sourceType: 'pdf' | 'image' | 'text';
  fileName?: string;
  mimeType?: string;
  summary: string;
  mechanism: string;
  realWorld: string;
  keyTakeaway: string;
  createdAt: string;
}

interface LessonSpec {
  id: string;
  title: string;
  summary: string;
  mechanism: string;
  realWorld: string;
  keyTakeaway: string;
}

interface VisualWireNode {
  id: string;
  label: string;
  kind: 'real-world' | 'wire-bridge' | 'hardware';
  subLabel: string;
  roleDescription: string;
}

interface VisualWireEdge {
  id: string;
  from: string;
  to: string;
  wireColor: 'sky' | 'emerald' | 'amber';
  signalLabel: string;
  explanation: string;
}

interface VisualWireDiagram {
  title: string;
  analogySummary: string;
  nodes: VisualWireNode[];
  wires: VisualWireEdge[];
  spokenWalkthrough: string;
  audioUrl: string | null;
}

interface DoubtEntry {
  id: string;
  question: string;
  answer: string;
  workbookReference: string;
  spokenAnswer: string;
  audioUrl: string | null;
  visualDiagram: VisualWireDiagram | null;
  createdAt: string;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const STORE_PATH = path.join(DATA_DIR, 'localizations.json');
const CUSTOM_STORE_PATH = path.join(DATA_DIR, 'custom_items.json');
const DOUBTS_STORE_PATH = path.join(DATA_DIR, 'doubts.json');

const ALLOWED_UPLOAD_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

fs.mkdirSync(AUDIO_DIR, { recursive: true });

function readStore(): Record<string, LocalizedContent> {
  if (!fs.existsSync(STORE_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, LocalizedContent>;
    for (const key of Object.keys(parsed)) {
      const entry = parsed[key];
      if (entry.audioFile) {
        const audioPath = path.join(AUDIO_DIR, entry.audioFile);
        if (!fs.existsSync(audioPath)) {
          entry.audioFile = null;
          entry.audioUrl = null;
          entry.audioUpdatedAt = null;
        }
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, LocalizedContent>): void {
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempPath, STORE_PATH);
}

function readCustomStore(): Record<string, CustomLessonSource> {
  if (!fs.existsSync(CUSTOM_STORE_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CUSTOM_STORE_PATH, 'utf8');
    return JSON.parse(raw) as Record<string, CustomLessonSource>;
  } catch {
    return {};
  }
}

function writeCustomStore(store: Record<string, CustomLessonSource>): void {
  const tempPath = `${CUSTOM_STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempPath, CUSTOM_STORE_PATH);
}

function readDoubtsStore(): Record<string, DoubtEntry[]> {
  if (!fs.existsSync(DOUBTS_STORE_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(DOUBTS_STORE_PATH, 'utf8');
    return JSON.parse(raw) as Record<string, DoubtEntry[]>;
  } catch {
    return {};
  }
}

function writeDoubtsStore(store: Record<string, DoubtEntry[]>): void {
  const tempPath = `${DOUBTS_STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tempPath, DOUBTS_STORE_PATH);
}

function findLessonSpec(id: string): LessonSpec | null {
  const builtIn = SYSTEM_COMPONENTS.find((c) => c.id === id);
  if (builtIn) {
    return {
      id: builtIn.id,
      title: builtIn.title,
      summary: builtIn.summary,
      mechanism: builtIn.mechanism,
      realWorld: builtIn.realWorld,
      keyTakeaway: builtIn.keyTakeaway,
    };
  }
  const customStore = readCustomStore();
  const custom = customStore[id];
  if (custom) {
    return {
      id: custom.id,
      title: custom.title,
      summary: custom.summary,
      mechanism: custom.mechanism,
      realWorld: custom.realWorld,
      keyTakeaway: custom.keyTakeaway,
    };
  }
  return null;
}

function makeKey(componentId: string, langCode: string): string {
  return `${componentId}:${langCode}`;
}

function computeTextHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function buildEnglishLocalization(lesson: LessonSpec): LocalizedContent {
  const spokenScript = [
    lesson.title,
    lesson.summary,
    lesson.mechanism,
    lesson.realWorld,
    `Key takeaway: ${lesson.keyTakeaway}`,
  ].join(' ');
  const store = readStore();
  const existing = store[makeKey(lesson.id, 'en')];
  const hash = computeTextHash(spokenScript);
  const hasMatchingAudio =
    existing &&
    existing.audioFile &&
    existing.textHash === hash &&
    fs.existsSync(path.join(AUDIO_DIR, existing.audioFile));

  return {
    componentId: lesson.id,
    langCode: 'en',
    langName: 'English',
    title: lesson.title,
    summary: lesson.summary,
    mechanism: lesson.mechanism,
    realWorld: lesson.realWorld,
    keyTakeaway: lesson.keyTakeaway,
    spokenScript,
    textHash: hash,
    audioFile: hasMatchingAudio ? existing.audioFile : null,
    audioUrl: hasMatchingAudio ? existing.audioUrl : null,
    updatedAt: existing?.updatedAt ?? new Date().toISOString(),
    audioUpdatedAt: hasMatchingAudio ? existing.audioUpdatedAt : null,
  };
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGeminiError(err: unknown): { status: number; message: string } {
  if (err && typeof err === 'object') {
    const anyErr = err as { status?: number; message?: string };
    let status =
      typeof anyErr.status === 'number' && anyErr.status >= 400
        ? anyErr.status
        : 500;
    let message = anyErr.message || 'Gemini API request failed.';

    // SDK sometimes embeds raw JSON error payloads inside err.message
    const trimmed = message.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as {
          error?: { code?: number; message?: string; status?: string };
          message?: string;
        };
        if (parsed.error?.message) {
          message = parsed.error.message;
          if (typeof parsed.error.code === 'number' && parsed.error.code >= 400) {
            status = parsed.error.code;
          }
        } else if (parsed.message) {
          message = parsed.message;
        }
      } catch {
        // Keep original message if not valid JSON
      }
    }

    return { status, message };
  }
  return { status: 500, message: String(err) };
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/localizations', (_req, res) => {
    const store = readStore();
    const items = Object.values(store).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
    res.json({ items });
  });

  app.get('/api/custom-items', (_req, res) => {
    const customStore = readCustomStore();
    const items = Object.values(customStore).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    res.json({ items });
  });

  app.post('/api/custom-items/ingest', async (req, res) => {
    const langCode = String(req.body?.langCode || 'ta').toLowerCase();
    const customTitle = String(req.body?.title || '').trim();
    const pastedText = String(req.body?.text || '').trim();
    const filePayload = req.body?.file as
      | { name?: string; mimeType?: string; dataBase64?: string }
      | undefined;

    const lang = getLanguageByCode(langCode);
    if (lang.code !== langCode) {
      res.status(400).json({ error: `Unsupported language code "${langCode}".` });
      return;
    }

    if (!pastedText && !filePayload?.dataBase64) {
      res.status(400).json({
        error: 'Please upload a PDF/JPEG/PNG file or paste study text.',
      });
      return;
    }

    let sourceType: 'pdf' | 'image' | 'text' = 'text';
    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    if (filePayload?.dataBase64) {
      const mimeType = String(filePayload.mimeType || '').toLowerCase();
      if (!ALLOWED_UPLOAD_MIMES.has(mimeType)) {
        res.status(400).json({
          error:
            'Unsupported file format. Upload a PDF, JPEG, PNG, or WebP file.',
        });
        return;
      }

      const cleanBase64 = filePayload.dataBase64.includes(',')
        ? filePayload.dataBase64.split(',')[1]
        : filePayload.dataBase64;
      const decodedBytes = Buffer.byteLength(cleanBase64, 'base64');
      if (decodedBytes === 0 || decodedBytes > MAX_UPLOAD_BYTES) {
        res.status(400).json({
          error: 'File must be non-empty and under 10 MB.',
        });
        return;
      }

      sourceType = mimeType === 'application/pdf' ? 'pdf' : 'image';
      parts.push({
        inlineData: {
          mimeType,
          data: cleanBase64,
        },
      });
    }

    const instructionText = [
      `Analyze the provided study material (${sourceType === 'pdf' ? 'PDF document' : sourceType === 'image' ? 'image/diagram/notes photo' : 'text'}) and organize it into a clear student lesson.`,
      customTitle ? `Preferred topic title: "${customTitle}"` : '',
      pastedText ? `Additional study text:\n${pastedText}` : '',
      '',
      `1. Extract a clean English reference version (englishTitle, englishSummary, englishMechanism, englishRealWorld, englishKeyTakeaway).`,
      `2. Provide the complete lesson translated into natural, student-friendly ${lang.name} (${lang.nativeName}) (title, summary, mechanism, realWorld, keyTakeaway).`,
      `3. Write "spokenScript": a smooth ${lang.name} narration paragraph combining the title, summary, mechanism, real-world relevance, and key takeaway for text-to-speech playback.`,
    ]
      .filter(Boolean)
      .join('\n');

    parts.push({ text: instructionText });

    try {
      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction: `You are SkillOS, an accurate multimodal STEM tutor. Extract key concepts from PDFs, diagrams, photos of notes, or text, and explain them clearly in ${lang.name} (${lang.nativeName}).`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              englishTitle: { type: Type.STRING },
              englishSummary: { type: Type.STRING },
              englishMechanism: { type: Type.STRING },
              englishRealWorld: { type: Type.STRING },
              englishKeyTakeaway: { type: Type.STRING },
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              mechanism: { type: Type.STRING },
              realWorld: { type: Type.STRING },
              keyTakeaway: { type: Type.STRING },
              spokenScript: { type: Type.STRING },
            },
            required: [
              'englishTitle',
              'englishSummary',
              'englishMechanism',
              'englishRealWorld',
              'englishKeyTakeaway',
              'title',
              'summary',
              'mechanism',
              'realWorld',
              'keyTakeaway',
              'spokenScript',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        throw new Error('Gemini returned an empty extraction response.');
      }

      const parsed = JSON.parse(rawJson) as {
        englishTitle: string;
        englishSummary: string;
        englishMechanism: string;
        englishRealWorld: string;
        englishKeyTakeaway: string;
        title: string;
        summary: string;
        mechanism: string;
        realWorld: string;
        keyTakeaway: string;
        spokenScript: string;
      };

      const idSuffix = crypto.randomBytes(4).toString('hex');
      const customId = `custom-${idSuffix}`;
      const now = new Date().toISOString();

      const customItem: CustomLessonSource = {
        id: customId,
        title: customTitle || parsed.englishTitle || 'Uploaded Study Material',
        sourceType,
        fileName: filePayload?.name,
        mimeType: filePayload?.mimeType,
        summary: parsed.englishSummary,
        mechanism: parsed.englishMechanism,
        realWorld: parsed.englishRealWorld,
        keyTakeaway: parsed.englishKeyTakeaway,
        createdAt: now,
      };

      const customStore = readCustomStore();
      customStore[customId] = customItem;
      writeCustomStore(customStore);

      const spokenScript =
        parsed.spokenScript?.trim() ||
        `${parsed.title}. ${parsed.summary} ${parsed.mechanism} ${parsed.realWorld} ${parsed.keyTakeaway}`;
      const localizedRecord: LocalizedContent = {
        componentId: customId,
        langCode,
        langName: lang.name,
        title: langCode === 'en' ? customItem.title : parsed.title,
        summary: langCode === 'en' ? customItem.summary : parsed.summary,
        mechanism: langCode === 'en' ? customItem.mechanism : parsed.mechanism,
        realWorld: langCode === 'en' ? customItem.realWorld : parsed.realWorld,
        keyTakeaway:
          langCode === 'en' ? customItem.keyTakeaway : parsed.keyTakeaway,
        spokenScript,
        textHash: computeTextHash(spokenScript),
        audioFile: null,
        audioUrl: null,
        updatedAt: now,
        audioUpdatedAt: null,
      };

      const store = readStore();
      if (langCode !== 'en') {
        store[makeKey(customId, langCode)] = localizedRecord;
        writeStore(store);
      }

      res.json({ customItem, localization: localizedRecord });
    } catch (err) {
      const { status, message } = extractGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/components/:id/localization', (req, res) => {
    const componentId = req.params.id;
    const langCode = String(req.query.lang || 'en').toLowerCase();

    const lesson = findLessonSpec(componentId);
    if (!lesson) {
      res.status(404).json({ error: `Unknown component "${componentId}".` });
      return;
    }

    if (langCode === 'en') {
      res.json({
        found: true,
        cached: true,
        localization: buildEnglishLocalization(lesson),
      });
      return;
    }

    const store = readStore();
    const saved = store[makeKey(componentId, langCode)];
    if (!saved) {
      res.json({ found: false, cached: false, localization: null });
      return;
    }

    res.json({ found: true, cached: true, localization: saved });
  });

  app.post('/api/translate', async (req, res) => {
    const componentId = String(req.body?.componentId || '');
    const langCode = String(req.body?.langCode || '').toLowerCase();
    const force = Boolean(req.body?.force);

    const lesson = findLessonSpec(componentId);
    if (!lesson) {
      res.status(404).json({ error: `Unknown component "${componentId}".` });
      return;
    }

    const lang = getLanguageByCode(langCode);
    if (lang.code !== langCode) {
      res.status(400).json({ error: `Unsupported language code "${langCode}".` });
      return;
    }

    if (langCode === 'en') {
      res.json({
        cached: true,
        localization: buildEnglishLocalization(lesson),
      });
      return;
    }

    const store = readStore();
    const key = makeKey(componentId, langCode);
    if (!force && store[key]) {
      res.json({ cached: true, localization: store[key] });
      return;
    }

    try {
      const ai = getAiClient();
      const prompt = [
        `Translate this STEM study lesson accurately into natural, student-friendly ${lang.name} (${lang.nativeName}).`,
        `Keep technical acronyms like ALU, CPU, DRAM, MOSFET, NAND, PWM, DC, and IRQ clear (either keep the acronym in Latin script alongside the ${lang.name} term or transliterate naturally so students recognize them).`,
        `Also write "spokenScript": a smooth, natural ${lang.name} narration paragraph combining the title, summary, mechanism, real-world example, and key takeaway so a text-to-speech educator voice can read it aloud cleanly without awkward punctuation.`,
        '',
        `Source English Lesson:`,
        `Title: ${lesson.title}`,
        `Summary: ${lesson.summary}`,
        `How It Works: ${lesson.mechanism}`,
        `Real-World Role: ${lesson.realWorld}`,
        `Key Takeaway: ${lesson.keyTakeaway}`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: `You are a bilingual STEM curriculum translator for SkillOS. Translate accurately into ${lang.name} (${lang.nativeName}) with warm clarity suitable for students.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: `Translated title in ${lang.name}.`,
              },
              summary: {
                type: Type.STRING,
                description: `Translated summary in ${lang.name}.`,
              },
              mechanism: {
                type: Type.STRING,
                description: `Translated how-it-works explanation in ${lang.name}.`,
              },
              realWorld: {
                type: Type.STRING,
                description: `Translated real-world application in ${lang.name}.`,
              },
              keyTakeaway: {
                type: Type.STRING,
                description: `Translated key takeaway sentence in ${lang.name}.`,
              },
              spokenScript: {
                type: Type.STRING,
                description: `Complete natural spoken lesson script in ${lang.name} ready for text-to-speech.`,
              },
            },
            required: [
              'title',
              'summary',
              'mechanism',
              'realWorld',
              'keyTakeaway',
              'spokenScript',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        throw new Error('Gemini returned an empty translation response.');
      }

      const translated = JSON.parse(rawJson) as {
        title: string;
        summary: string;
        mechanism: string;
        realWorld: string;
        keyTakeaway: string;
        spokenScript: string;
      };

      const spokenScript =
        translated.spokenScript?.trim() ||
        `${translated.title}. ${translated.summary} ${translated.mechanism} ${translated.realWorld} ${translated.keyTakeaway}`;
      const newHash = computeTextHash(spokenScript);

      const previous = store[key];
      if (previous?.audioFile && previous.textHash !== newHash) {
        const oldAudioPath = path.join(AUDIO_DIR, previous.audioFile);
        if (fs.existsSync(oldAudioPath)) {
          fs.unlinkSync(oldAudioPath);
        }
      }

      const keepAudio =
        previous &&
        previous.textHash === newHash &&
        previous.audioFile &&
        fs.existsSync(path.join(AUDIO_DIR, previous.audioFile));

      const savedRecord: LocalizedContent = {
        componentId,
        langCode,
        langName: lang.name,
        title: translated.title,
        summary: translated.summary,
        mechanism: translated.mechanism,
        realWorld: translated.realWorld,
        keyTakeaway: translated.keyTakeaway,
        spokenScript,
        textHash: newHash,
        audioFile: keepAudio ? previous.audioFile : null,
        audioUrl: keepAudio ? previous.audioUrl : null,
        updatedAt: new Date().toISOString(),
        audioUpdatedAt: keepAudio ? previous.audioUpdatedAt : null,
      };

      store[key] = savedRecord;
      writeStore(store);

      res.json({ cached: false, localization: savedRecord });
    } catch (err) {
      const { status, message } = extractGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/tts', async (req, res) => {
    const componentId = String(req.body?.componentId || '');
    const langCode = String(req.body?.langCode || '').toLowerCase();
    const force = Boolean(req.body?.force);

    const lesson = findLessonSpec(componentId);
    if (!lesson) {
      res.status(404).json({ error: `Unknown component "${componentId}".` });
      return;
    }

    const lang = getLanguageByCode(langCode);
    const store = readStore();
    const key = makeKey(componentId, langCode);

    let localization: LocalizedContent;
    if (langCode === 'en') {
      localization = buildEnglishLocalization(lesson);
    } else if (store[key]) {
      localization = store[key];
    } else {
      res.status(400).json({
        error: `No saved ${lang.name} text found for "${lesson.title}". Please translate first.`,
      });
      return;
    }

    const customText =
      typeof req.body?.text === 'string' && req.body.text.trim().length > 0
        ? req.body.text.trim()
        : localization.spokenScript;

    const textHash = computeTextHash(customText);
    const audioFilename = `${componentId}_${langCode}.wav`;
    const audioPath = path.join(AUDIO_DIR, audioFilename);

    if (
      !force &&
      localization.audioFile === audioFilename &&
      localization.textHash === textHash &&
      fs.existsSync(audioPath)
    ) {
      res.json({
        cached: true,
        audioUrl: `/api/audio/${audioFilename}?v=${encodeURIComponent(localization.audioUpdatedAt || localization.updatedAt)}`,
        localization,
      });
      return;
    }

    try {
      const ai = getAiClient();
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: customText,
                speechMetadata: {
                  style: `Clear, warm, articulate STEM teacher speaking ${lang.name}`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: lang.voiceName || 'Kore' },
            },
          },
        },
      });

      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        throw new Error('Gemini TTS did not return audio data.');
      }

      const wavBuffer = Buffer.from(base64Audio, 'base64');
      fs.writeFileSync(audioPath, wavBuffer);

      const audioUpdatedAt = new Date().toISOString();
      const updatedRecord: LocalizedContent = {
        ...localization,
        spokenScript: customText,
        textHash,
        audioFile: audioFilename,
        audioUrl: `/api/audio/${audioFilename}?v=${encodeURIComponent(audioUpdatedAt)}`,
        audioUpdatedAt,
      };

      store[key] = updatedRecord;
      writeStore(store);

      res.json({
        cached: false,
        audioUrl: updatedRecord.audioUrl,
        localization: updatedRecord,
      });
    } catch (err) {
      const { status, message } = extractGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/components/:id/doubts', (req, res) => {
    const componentId = req.params.id;
    const langCode = String(req.query.lang || 'en').toLowerCase();
    const doubtsStore = readDoubtsStore();
    const items = doubtsStore[makeKey(componentId, langCode)] ?? [];
    res.json({ items });
  });

  app.post('/api/doubt/transcribe', async (req, res) => {
    const langCode = String(req.body?.langCode || 'en').toLowerCase();
    const audioBase64 = String(req.body?.audioBase64 || '');
    const rawMime = String(req.body?.mimeType || 'audio/wav');
    const cleanMime = rawMime.split(';')[0].trim().toLowerCase() || 'audio/wav';

    if (!audioBase64) {
      res.status(400).json({ error: 'No recorded audio was received.' });
      return;
    }

    const cleanBase64 = audioBase64.includes(',')
      ? audioBase64.split(',')[1]
      : audioBase64;
    const lang = getLanguageByCode(langCode);

    try {
      const ai = getAiClient();
      const audioPart = {
        inlineData: {
          mimeType: cleanMime,
          data: cleanBase64,
        },
      };

      let transcript = '';
      let transcribeFailure = '';
      let transcribeStatus = 422;

      // Tier 1: Dedicated static audio transcription model
      try {
        const transcribeRes = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              audioPart,
              {
                text: `Transcribe this audio in ${lang.name} (${lang.nativeName}) or English.`,
              },
            ],
          },
        });
        transcript = (transcribeRes.text ?? '').trim();
      } catch (transcribeErr) {
        const extracted = extractGeminiError(transcribeErr);
        transcribeFailure = extracted.message;
        transcribeStatus = extracted.status;
        console.warn('gemini-3.5-transcribe failed:', extracted);
      }

      // Tier 2: Multimodal flash-lite fallback (handles audio inlineData when transcribe model is busy)
      if (!transcript) {
        try {
          const fallbackRes = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: {
              parts: [
                audioPart,
                {
                  text: `Listen to the attached audio recording and transcribe the exact spoken words. The speaker may be speaking ${lang.name} (${lang.nativeName}) or English. If no speech is audible, set hasSpeech to false and transcript to "".`,
                },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  hasSpeech: { type: Type.BOOLEAN },
                  transcript: { type: Type.STRING },
                },
                required: ['hasSpeech', 'transcript'],
              },
            },
          });
          const parsed = JSON.parse((fallbackRes.text ?? '{}').trim()) as {
            hasSpeech?: boolean;
            transcript?: string;
          };
          if (parsed.hasSpeech && parsed.transcript?.trim()) {
            transcript = parsed.transcript.trim();
          }
        } catch (fallbackErr) {
          const extracted = extractGeminiError(fallbackErr);
          console.warn('gemini-3.1-flash-lite audio fallback failed:', extracted);
          if (!transcribeFailure) {
            transcribeFailure = extracted.message;
            transcribeStatus = extracted.status;
          }
        }
      }

      // Tier 3: Live transcription fallback over 16kHz PCM if WAV payload is available
      if (!transcript && cleanMime === 'audio/wav') {
        try {
          const wavBuf = Buffer.from(cleanBase64, 'base64');
          const sampleRate = wavBuf.length >= 28 ? wavBuf.readUInt32LE(24) : 16000;
          if (wavBuf.length > 44 && sampleRate === 16000) {
            const { Modality } = await import('@google/genai');
            const pcmBuf = wavBuf.subarray(44);
            transcript = await new Promise<string>((resolve) => {
              let collected = '';
              let interim = '';
              let settled = false;
              let sessionRef: { close: () => void; sendRealtimeInput: (p: unknown) => void } | null = null;
              const finish = () => {
                if (settled) return;
                settled = true;
                try {
                  sessionRef?.close();
                } catch {
                  // Ignore close error
                }
                resolve((collected || interim).trim());
              };
              const timeout = setTimeout(finish, 6000);

              ai.live
                .connect({
                  model: 'gemini-3.5-transcribe-live',
                  config: {
                    responseModalities: [Modality.TEXT],
                    inputAudioTranscription: {
                      languageCodes: [],
                    },
                  },
                  callbacks: {
                    onmessage: (message) => {
                      const content = message.serverContent;
                      if (content?.inputTranscription?.text) {
                        collected += content.inputTranscription.text;
                      }
                      if (content?.interimInputTranscription?.text) {
                        interim = content.interimInputTranscription.text;
                      }
                      if (content?.turnComplete && (collected || interim)) {
                        clearTimeout(timeout);
                        finish();
                      }
                    },
                    onerror: () => {
                      clearTimeout(timeout);
                      finish();
                    },
                    onclose: () => {
                      clearTimeout(timeout);
                      finish();
                    },
                  },
                })
                .then((session) => {
                  sessionRef = session as unknown as {
                    close: () => void;
                    sendRealtimeInput: (p: unknown) => void;
                  };
                  const chunkBytes = 3200; // 100ms at 16kHz 16-bit mono
                  for (let offset = 0; offset < pcmBuf.length; offset += chunkBytes) {
                    const slice = pcmBuf.subarray(offset, offset + chunkBytes);
                    session.sendRealtimeInput({
                      audio: {
                        data: slice.toString('base64'),
                        mimeType: 'audio/pcm;rate=16000',
                      },
                    });
                  }
                  // Trailing 800ms silence to trigger VAD end-of-turn
                  const silence = Buffer.alloc(16000 * 2 * 0.8);
                  session.sendRealtimeInput({
                    audio: {
                      data: silence.toString('base64'),
                      mimeType: 'audio/pcm;rate=16000',
                    },
                  });
                })
                .catch(() => {
                  clearTimeout(timeout);
                  finish();
                });
            });
          }
        } catch (liveErr) {
          console.warn('gemini-3.5-transcribe-live fallback failed:', liveErr);
        }
      }

      if (!transcript) {
        const finalStatus = transcribeStatus >= 500 ? 503 : 422;
        res.status(finalStatus).json({
          error:
            transcribeFailure ||
            'Could not detect speech in the recording. Please try speaking closer to the microphone or type your doubt.',
        });
        return;
      }
      res.json({ transcript });
    } catch (err) {
      const { status, message } = extractGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/doubt/ask', async (req, res) => {
    const componentId = String(req.body?.componentId || '');
    const langCode = String(req.body?.langCode || 'en').toLowerCase();
    const question = String(req.body?.question || '').trim();

    const lesson = findLessonSpec(componentId);
    if (!lesson) {
      res.status(404).json({ error: `Unknown lesson "${componentId}".` });
      return;
    }
    if (!question) {
      res.status(400).json({ error: 'Please ask or type your doubt first.' });
      return;
    }

    const lang = getLanguageByCode(langCode);
    const locStore = readStore();
    const localized = locStore[makeKey(componentId, langCode)];

    const workbookContext = [
      `Active Workbook Lesson: ${lesson.title}`,
      `Summary: ${lesson.summary}`,
      `How It Works: ${lesson.mechanism}`,
      `Real-World Role: ${lesson.realWorld}`,
      `Key Takeaway: ${lesson.keyTakeaway}`,
      localized
        ? `\nStudent's Screen Translation (${lang.name}):\nTitle: ${localized.title}\nSummary: ${localized.summary}\nMechanism: ${localized.mechanism}\nReal-World: ${localized.realWorld}\nTakeaway: ${localized.keyTakeaway}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const ai = getAiClient();
      const prompt = [
        `A student is studying the workbook lesson below on screen in ${lang.name} (${lang.nativeName}) and has a doubt:`,
        `Student's Doubt: "${question}"`,
        '',
        `Workbook Content:`,
        workbookContext,
        '',
        `Instructions:`,
        `1. Answer ONLY in ${lang.name} (${lang.nativeName}) (keeping core technical acronyms like ALU, CPU, DRAM, MOSFET, NAND, PWM, IRQ clear if helpful).`,
        `2. Ground your answer in the workbook content above, but explain it in a much clearer, warmer, step-by-step way with an intuitive everyday example so the student resolves their doubt immediately.`,
        `3. Fill "workbookReference" with a short note in ${lang.name} telling the student which part of the workbook lesson explains this.`,
        `4. Fill "spokenAnswer" with a smooth spoken version of the answer in ${lang.name} ready for text-to-speech.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: `You are SkillOS's patient, encouraging workbook tutor. Always answer in ${lang.name} (${lang.nativeName}) using clear, jargon-free explanations grounded in the active workbook lesson.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: `Clear, intuitive answer to the student's doubt in ${lang.name}.`,
              },
              workbookReference: {
                type: Type.STRING,
                description: `Short citation in ${lang.name} pointing to the relevant section of the workbook lesson.`,
              },
              spokenAnswer: {
                type: Type.STRING,
                description: `Natural spoken script in ${lang.name} for text-to-speech.`,
              },
            },
            required: ['answer', 'workbookReference', 'spokenAnswer'],
          },
        },
      });

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        throw new Error('Gemini returned an empty tutor answer.');
      }

      const parsed = JSON.parse(rawJson) as {
        answer: string;
        workbookReference: string;
        spokenAnswer: string;
      };

      const entry: DoubtEntry = {
        id: crypto.randomBytes(4).toString('hex'),
        question,
        answer: parsed.answer,
        workbookReference: parsed.workbookReference,
        spokenAnswer: parsed.spokenAnswer || parsed.answer,
        audioUrl: null,
        visualDiagram: null,
        createdAt: new Date().toISOString(),
      };

      const doubtsStore = readDoubtsStore();
      const key = makeKey(componentId, langCode);
      const existingList = doubtsStore[key] ?? [];
      doubtsStore[key] = [entry, ...existingList].slice(0, 12);
      writeDoubtsStore(doubtsStore);

      res.json({ entry });
    } catch (err) {
      const { status, message } = extractGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/doubt/visual-diagram', async (req, res) => {
    const componentId = String(req.body?.componentId || '');
    const langCode = String(req.body?.langCode || 'en').toLowerCase();
    const doubtId = String(req.body?.doubtId || '');

    const lesson = findLessonSpec(componentId);
    if (!lesson) {
      res.status(404).json({ error: `Unknown lesson "${componentId}".` });
      return;
    }

    const doubtsStore = readDoubtsStore();
    const key = makeKey(componentId, langCode);
    const list = doubtsStore[key] ?? [];
    const targetIdx = list.findIndex((d) => d.id === doubtId);
    if (targetIdx === -1) {
      res.status(404).json({ error: 'Doubt entry not found.' });
      return;
    }

    const doubt = list[targetIdx];
    if (doubt.visualDiagram) {
      res.json({ entry: doubt, cached: true });
      return;
    }

    const lang = getLanguageByCode(langCode);

    try {
      const ai = getAiClient();
      const prompt = [
        `The student STILL does not understand the concept and needs a graphical real-world wire-connection explanation in ${lang.name} (${lang.nativeName}).`,
        `Lesson: ${lesson.title} — ${lesson.summary} ${lesson.mechanism}`,
        `Student's Doubt: "${doubt.question}"`,
        '',
        `Design an interactive 3-node or 4-node wire-connection diagram that literally connects a familiar everyday real-world object (like a light switch, water tap/pipe, battery charger, or mail counter) with physical wires to the hardware concept so the student sees how it works step by step.`,
        `All text fields MUST be in ${lang.name} (${lang.nativeName}).`,
        `Rules for nodes & wires:`,
        `- Return exactly 3 nodes with ids "n1", "n2", "n3":`,
        `  - "n1" must have kind: "real-world" (the familiar everyday real-world object)`,
        `  - "n2" must have kind: "wire-bridge" (how the signal/wire carries or controls energy/data)`,
        `  - "n3" must have kind: "hardware" (the actual component action/outcome in the lesson)`,
        `- Return exactly 2 wires connecting "n1" -> "n2" (wire id "w1", wireColor "sky") and "n2" -> "n3" (wire id "w2", wireColor "emerald").`,
        `- Keep node labels concise (2-5 words) and roleDescription + wire explanations super clear and friendly in ${lang.name}.`,
        `- Provide "spokenWalkthrough": a natural 2-3 sentence spoken walkthrough of this wire diagram in ${lang.name}.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction: `You are a visual engineering teacher creating intuitive real-world wire-connection diagrams in ${lang.name} (${lang.nativeName}).`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              analogySummary: { type: Type.STRING },
              spokenWalkthrough: { type: Type.STRING },
              nodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    kind: { type: Type.STRING },
                    subLabel: { type: Type.STRING },
                    roleDescription: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'label',
                    'kind',
                    'subLabel',
                    'roleDescription',
                  ],
                },
              },
              wires: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    wireColor: { type: Type.STRING },
                    signalLabel: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: [
                    'id',
                    'from',
                    'to',
                    'wireColor',
                    'signalLabel',
                    'explanation',
                  ],
                },
              },
            },
            required: [
              'title',
              'analogySummary',
              'spokenWalkthrough',
              'nodes',
              'wires',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        throw new Error('Gemini returned an empty visual diagram.');
      }

      const parsed = JSON.parse(rawJson) as {
        title: string;
        analogySummary: string;
        spokenWalkthrough: string;
        nodes: VisualWireNode[];
        wires: VisualWireEdge[];
      };

      const normalizedNodes: VisualWireNode[] = (parsed.nodes || [])
        .slice(0, 3)
        .map((n, idx) => ({
          id: n.id || `n${idx + 1}`,
          label: n.label,
          kind:
            idx === 0
              ? 'real-world'
              : idx === 1
                ? 'wire-bridge'
                : 'hardware',
          subLabel: n.subLabel,
          roleDescription: n.roleDescription,
        }));

      const normalizedWires: VisualWireEdge[] = (parsed.wires || [])
        .slice(0, 2)
        .map((w, idx) => ({
          id: w.id || `w${idx + 1}`,
          from: normalizedNodes[idx]?.id || `n${idx + 1}`,
          to: normalizedNodes[idx + 1]?.id || `n${idx + 2}`,
          wireColor: idx === 0 ? 'sky' : 'emerald',
          signalLabel: w.signalLabel,
          explanation: w.explanation,
        }));

      const diagram: VisualWireDiagram = {
        title: parsed.title,
        analogySummary: parsed.analogySummary,
        nodes: normalizedNodes,
        wires: normalizedWires,
        spokenWalkthrough: parsed.spokenWalkthrough || parsed.analogySummary,
        audioUrl: null,
      };

      const updatedDoubt: DoubtEntry = {
        ...doubt,
        visualDiagram: diagram,
      };
      list[targetIdx] = updatedDoubt;
      doubtsStore[key] = list;
      writeDoubtsStore(doubtsStore);

      res.json({ entry: updatedDoubt, cached: false });
    } catch (err) {
      const { status, message } = extractGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/doubt/tts', async (req, res) => {
    const componentId = String(req.body?.componentId || '');
    const langCode = String(req.body?.langCode || 'en').toLowerCase();
    const doubtId = String(req.body?.doubtId || '');
    const target = req.body?.target === 'diagram' ? 'diagram' : 'answer';

    const doubtsStore = readDoubtsStore();
    const key = makeKey(componentId, langCode);
    const list = doubtsStore[key] ?? [];
    const targetIdx = list.findIndex((d) => d.id === doubtId);
    if (targetIdx === -1) {
      res.status(404).json({ error: 'Doubt entry not found.' });
      return;
    }

    const doubt = list[targetIdx];
    const existingUrl =
      target === 'diagram' ? doubt.visualDiagram?.audioUrl : doubt.audioUrl;
    const audioFilename = `doubt-${doubtId}-${target}_${langCode}.wav`;
    const audioPath = path.join(AUDIO_DIR, audioFilename);

    if (existingUrl && fs.existsSync(audioPath)) {
      res.json({ audioUrl: existingUrl, entry: doubt, cached: true });
      return;
    }

    const textToSpeak =
      target === 'diagram'
        ? doubt.visualDiagram?.spokenWalkthrough
        : doubt.spokenAnswer;

    if (!textToSpeak) {
      res.status(400).json({ error: 'No text available to speak.' });
      return;
    }

    const lang = getLanguageByCode(langCode);

    try {
      const ai = getAiClient();
      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: textToSpeak,
                speechMetadata: {
                  style: `Patient, encouraging STEM tutor speaking ${lang.name}`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: lang.voiceName || 'Kore' },
            },
          },
        },
      });

      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        throw new Error('Gemini TTS did not return audio data.');
      }

      const wavBuffer = Buffer.from(base64Audio, 'base64');
      fs.writeFileSync(audioPath, wavBuffer);

      const audioUrl = `/api/audio/${audioFilename}?v=${Date.now()}`;
      const updatedDoubt: DoubtEntry =
        target === 'diagram' && doubt.visualDiagram
          ? {
              ...doubt,
              visualDiagram: { ...doubt.visualDiagram, audioUrl },
            }
          : {
              ...doubt,
              audioUrl,
            };

      list[targetIdx] = updatedDoubt;
      doubtsStore[key] = list;
      writeDoubtsStore(doubtsStore);

      res.json({ audioUrl, entry: updatedDoubt, cached: false });
    } catch (err) {
      const { status, message } = extractGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.get('/api/audio/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    if (!/^[a-z0-9-]+_[a-z0-9-]+\.wav$/i.test(filename)) {
      res.status(400).json({ error: 'Invalid audio filename.' });
      return;
    }
    const filePath = path.join(AUDIO_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Saved audio file not found.' });
      return;
    }
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(filePath);
  });

  app.delete('/api/components/:id/localization', (req, res) => {
    const componentId = req.params.id;
    const langCode = String(req.query.lang || '').toLowerCase();
    const store = readStore();
    const key = makeKey(componentId, langCode);
    const entry = store[key];
    if (entry?.audioFile) {
      const audioPath = path.join(AUDIO_DIR, entry.audioFile);
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }
    delete store[key];
    writeStore(store);
    res.json({ deleted: true });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SkillOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SkillOS server:', err);
  process.exit(1);
});
