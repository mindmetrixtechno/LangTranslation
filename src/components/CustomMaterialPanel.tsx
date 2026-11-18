import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Upload,
  Loader2,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { getLanguageByCode } from '../data/languages';
import type {
  CustomIngestResponse,
  CustomLessonSource,
  LocalizedContent,
} from '../types/localization';

interface CustomMaterialPanelProps {
  selectedLang: string;
  customItems: CustomLessonSource[];
  activeCustomId: string | null;
  onSelectCustomItem: (item: CustomLessonSource) => void;
  onIngestComplete: (res: CustomIngestResponse) => void;
  onError: (msg: string) => void;
}

export function CustomMaterialPanel({
  selectedLang,
  customItems,
  activeCustomId,
  onSelectCustomItem,
  onIngestComplete,
  onError,
}: CustomMaterialPanelProps) {
  const [titleInput, setTitleInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    mimeType: string;
    size: number;
    dataBase64: string;
    previewUrl: string | null;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeLanguage = getLanguageByCode(selectedLang);

  useEffect(() => {
    return () => {
      if (selectedFile?.previewUrl) {
        URL.revokeObjectURL(selectedFile.previewUrl);
      }
    };
  }, [selectedFile]);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowed.includes(file.type.toLowerCase())) {
      onError('Please choose a PDF, JPEG, PNG, or WebP file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError('File exceeds the 10 MB upload limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null;
      setSelectedFile({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataBase64: result,
        previewUrl,
      });
    };
    reader.onerror = () => {
      onError('Could not read the selected file.');
    };
    reader.readAsDataURL(file);
  };

  const clearSelectedFile = () => {
    if (selectedFile?.previewUrl) {
      URL.revokeObjectURL(selectedFile.previewUrl);
    }
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !textInput.trim()) {
      onError('Upload a PDF/JPEG/PNG file or paste study text first.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/custom-items/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput.trim() || undefined,
          langCode: selectedLang,
          text: textInput.trim() || undefined,
          file: selectedFile
            ? {
                name: selectedFile.name,
                mimeType: selectedFile.mimeType,
                dataBase64: selectedFile.dataBase64,
              }
            : undefined,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as
        | CustomIngestResponse
        | { error?: string };

      if (!res.ok || !('customItem' in body)) {
        throw new Error(
          ('error' in body && body.error) ||
            'Failed to process uploaded study material.'
        );
      }

      setTitleInput('');
      setTextInput('');
      clearSelectedFile();
      onIngestComplete(body);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="custom-topic-title"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Topic Title (Optional)
          </label>
          <input
            id="custom-topic-title"
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="e.g., Ohm's Law Worksheet or Diode Schematic"
            className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-600"
          />
        </div>

        {/* File Drop / Picker */}
        <div className="space-y-2">
          <span className="block text-xs font-medium text-slate-700">
            Upload PDF, JPEG, PNG, or WebP (up to 10 MB)
          </span>

          {!selectedFile ? (
            <label
              htmlFor="custom-file-input"
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 hover:border-sky-500 transition-colors cursor-pointer text-center"
            >
              <Upload className="w-5 h-5 text-sky-700" />
              <div className="text-sm font-medium text-slate-800">
                Choose a PDF document or JPEG/PNG image
              </div>
              <div className="text-xs text-slate-500">
                Textbook pages, lecture slides, circuit diagrams, or handwritten notes
              </div>
              <input
                ref={fileInputRef}
                id="custom-file-input"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileChange(e.target.files?.[0])}
                className="sr-only"
              />
            </label>
          ) : (
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {selectedFile.previewUrl ? (
                  <img
                    src={selectedFile.previewUrl}
                    alt={selectedFile.name}
                    className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-sky-700" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {selectedFile.mimeType} · {formatBytes(selectedFile.size)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSelectedFile}
                aria-label="Remove selected file"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Optional Pasted Text */}
        <div>
          <label
            htmlFor="custom-study-text"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Or Paste Study Notes / Additional Instructions
          </label>
          <textarea
            id="custom-study-text"
            rows={4}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste a paragraph from your notes or textbook, or leave blank if uploading a PDF/JPEG..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-600"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-600">
            Target output:{' '}
            <span className="font-medium text-slate-900">
              {activeLanguage.name} ({activeLanguage.nativeName})
            </span>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting & Translating...</span>
              </>
            ) : (
              <span>
                Extract, Translate to {activeLanguage.name} & Save
              </span>
            )}
          </button>
        </div>
      </form>

      {/* Saved Uploaded Materials List */}
      {customItems.length > 0 && (
        <div className="pt-5 border-t border-slate-100 space-y-3">
          <div className="text-xs font-semibold text-slate-700">
            Uploaded Materials ({customItems.length})
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {customItems.map((item) => {
              const isSelected = item.id === activeCustomId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectCustomItem(item)}
                  className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-sky-50' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.sourceType === 'image' ? (
                      <ImageIcon className="w-4 h-4 text-sky-700 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-sky-700 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {item.sourceType.toUpperCase()}
                        {item.fileName ? ` · ${item.fileName}` : ''}
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export type { LocalizedContent };
