import { X, Volume2, FileText, Trash2, ArrowUpRight } from 'lucide-react';
import { SYSTEM_COMPONENTS } from '../data/components';
import { getLanguageByCode } from '../data/languages';
import type { CustomLessonSource, LocalizedContent } from '../types/localization';

interface SavedLibraryDrawerProps {
  open: boolean;
  items: LocalizedContent[];
  customItems: CustomLessonSource[];
  onClose: () => void;
  onSelectLesson: (componentId: string, langCode: string) => void;
  onDeleteLesson: (componentId: string, langCode: string) => void;
}

export function SavedLibraryDrawer({
  open,
  items,
  customItems,
  onClose,
  onSelectLesson,
  onDeleteLesson,
}: SavedLibraryDrawerProps) {
  if (!open) return null;

  const resolveSourceLabel = (componentId: string): string => {
    const builtIn = SYSTEM_COMPONENTS.find((c) => c.id === componentId);
    if (builtIn) return builtIn.shortTitle;
    const custom = customItems.find((c) => c.id === componentId);
    if (custom) return `${custom.title} (${custom.sourceType.toUpperCase()})`;
    return 'Uploaded Lesson';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Saved Lessons Library"
    >
      <div className="w-full max-w-lg bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Saved Lessons</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Translated text and Gemini TTS audio saved on disk for instant reopening
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Saved Lessons"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
          {items.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800">No saved lessons yet</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Select Tamil or any language on a component or uploaded PDF/JPEG, then click Listen to save both the translated explanation and audio.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const sourceLabel = resolveSourceLabel(item.componentId);
              const lang = getLanguageByCode(item.langCode);
              return (
                <div
                  key={`${item.componentId}:${item.langCode}`}
                  className="p-5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="text-xs text-slate-500 truncate">
                      <span>{sourceLabel}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-medium text-slate-800">
                        {lang.name} ({lang.nativeName})
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        Saved Text
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Volume2
                          className={`w-3.5 h-3.5 ${
                            item.audioUrl ? 'text-sky-700' : 'text-slate-400'
                          }`}
                        />
                        {item.audioUrl ? 'Saved Audio (.wav)' : 'Text Only'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectLesson(item.componentId, item.langCode);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <span>Open</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteLesson(item.componentId, item.langCode)}
                      title="Delete saved lesson"
                      aria-label={`Delete saved ${lang.name} lesson for ${sourceLabel}`}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
