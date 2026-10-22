import type { ReactNode } from 'react';
import { createUseReactiveStore } from '../reactiveStore';
import { createLanguageCore } from './core';
import { createLanguageManager } from './LanguageManager';
import { createLanguageManagerGlue } from './LanguageManagerGlue';
import { dictionaries, type Locale, type MessageKey } from './locale';
import type { TranslationParams } from './core/types';

type LanguageState = {
  locale: Locale;
  languages: Array<{ value: Locale; label: string }>;
  manager: ReturnType<typeof createLanguageManagerGlue<Locale, (typeof dictionaries)['ja']>>;
  setLocale(locale: Locale): void;
  t(key: MessageKey, params?: TranslationParams): string;
};

function storedLocale(): Locale {
  try {
    const value = localStorage.getItem('yukari-locale');
    return value === 'zh-CN' || value === 'en' ? value : 'ja';
  } catch { return 'ja'; }
}

export const useLanguageStore = createUseReactiveStore<LanguageState>(setData => {
  const core = createLanguageCore<Locale, (typeof dictionaries)['ja']>()
    .register({ value: 'ja', label: '日本語', message: dictionaries.ja })
    .register({ value: 'zh-CN', label: '简体中文', message: dictionaries['zh-CN'] })
    .register({ value: 'en', label: 'English', message: dictionaries.en });
  const manager = createLanguageManagerGlue(core, createLanguageManager);
  const locale = storedLocale();
  if (locale !== manager.currentLocale) manager.setLocale(locale);
  document.documentElement.lang = locale;
  return {
    locale,
    languages: manager.languages as LanguageState['languages'],
    manager,
    setLocale(next) {
      manager.setLocale(next);
      document.documentElement.lang = next;
      try { localStorage.setItem('yukari-locale', next); } catch { /* storage can be disabled */ }
      setData(state => { state.locale = next; });
    },
    t: (key, params) => manager.t(key, params),
  };
});

export function useLanguage() {
  const locale = useLanguageStore(state => state.locale);
  const setLocale = useLanguageStore(state => state.setLocale);
  const t = useLanguageStore(state => state.t);
  const languages = useLanguageStore(state => state.languages);
  return { locale, setLocale, t, languages };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  useLanguageStore(state => state.locale);
  return children;
}

export { LanguageProvider as LocaleProvider };

export function useTranslation() {
  return useLanguage().t;
}

export type { Locale, MessageKey, TranslationParams };
