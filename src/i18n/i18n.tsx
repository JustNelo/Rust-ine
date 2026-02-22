import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import en from "./en.json";
import fr from "./fr.json";

export type Lang = "en" | "fr";

const dictionaries: Record<Lang, Record<string, string>> = { en, fr };

const STORAGE_KEY = "rustine_lang";

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") return stored;
  } catch {
    // localStorage may be unavailable
  }
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith("fr")) return "fr";
  return "en";
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value = dictionaries[lang][key] ?? dictionaries["en"][key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    },
    [lang]
  );

  const contextValue = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}
