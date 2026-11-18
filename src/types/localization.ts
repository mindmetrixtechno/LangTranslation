export interface LocalizedContent {
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

export interface CustomLessonSource {
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

export interface VisualWireNode {
  id: string;
  label: string;
  kind: 'real-world' | 'wire-bridge' | 'hardware';
  subLabel: string;
  roleDescription: string;
}

export interface VisualWireEdge {
  id: string;
  from: string;
  to: string;
  wireColor: 'sky' | 'emerald' | 'amber';
  signalLabel: string;
  explanation: string;
}

export interface VisualWireDiagram {
  title: string;
  analogySummary: string;
  nodes: VisualWireNode[];
  wires: VisualWireEdge[];
  spokenWalkthrough: string;
  audioUrl: string | null;
}

export interface DoubtEntry {
  id: string;
  question: string;
  answer: string;
  workbookReference: string;
  spokenAnswer: string;
  audioUrl: string | null;
  visualDiagram: VisualWireDiagram | null;
  createdAt: string;
}

export interface LocalizationFetchResult {
  found: boolean;
  cached: boolean;
  localization: LocalizedContent | null;
}

export interface TranslateResponse {
  cached: boolean;
  localization: LocalizedContent;
}

export interface TtsResponse {
  cached: boolean;
  audioUrl: string;
  localization: LocalizedContent;
}

export interface CustomIngestResponse {
  customItem: CustomLessonSource;
  localization: LocalizedContent;
}
