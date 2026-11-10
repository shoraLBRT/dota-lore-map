import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Localized } from '../data/types';
import en from './en.json';
import ru from './ru.json';

export type MessageKey = keyof typeof ru;
// Типы гарантируют, что в en.json те же ключи, что и в ru.json.
export const dictionaries: Record<Lang, Record<MessageKey, string>> = { ru, en };

export const LANGS: Lang[] = ['ru', 'en'];
const STORAGE_KEY = 'dota-lore-map.lang';

/** Язык по умолчанию: сохранённый выбор, иначе язык браузера (`ru*` → RU, иначе EN). SPEC §12. */
export function detectLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    // localStorage может быть недоступен (приватный режим, запрет cookies).
  }
  try {
    return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  } catch {
    return 'en';
  }
}

function saveLang(lang: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Без сохранения выбор просто не переживёт перезагрузку.
  }
}

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string>): string {
  const text = dictionaries[lang][key];
  return vars ? text.replace(/\{(\w+)\}/g, (m, name: string) => vars[name] ?? m) : text;
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Строка интерфейса по ключу словаря. */
  t: (key: MessageKey, vars?: Record<string, string>) => string;
  /** Текст контента `{ ru, en }` на текущем языке. */
  l: (text: Localized) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? detectLang());

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = dictionaries[lang]['app.title'];
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    saveLang(next);
  }, []);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      l: (text) => text[lang],
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18n {
  const i18n = useContext(I18nContext);
  if (!i18n) throw new Error('useT: нет I18nProvider');
  return i18n;
}
