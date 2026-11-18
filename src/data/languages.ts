export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  voiceName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English', voiceName: 'Kore' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', voiceName: 'Kore' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', voiceName: 'Kore' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', voiceName: 'Kore' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', voiceName: 'Kore' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', voiceName: 'Kore' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', voiceName: 'Zephyr' },
  { code: 'fr', name: 'French', nativeName: 'Français', voiceName: 'Kore' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', voiceName: 'Kore' },
];

export function getLanguageByCode(code: string): SupportedLanguage {
  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.code === code) ??
    SUPPORTED_LANGUAGES[0]
  );
}
