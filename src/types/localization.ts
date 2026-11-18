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
