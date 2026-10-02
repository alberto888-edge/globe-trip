"use client";
// Text lives next to where it is used as a pair, t("Spanish", "English"), so a screen
// reads the same in the code as on the phone and nothing can go missing from a separate
// dictionary. The language itself lives in lib/lang.ts.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { currentLang, pick, type Lang, type T } from "./lang";

export { dayLabels, locale, switchLang, currentLang, type Lang, type T } from "./lang";

/** Renders its children once the language is known, so nobody sees a flash of the other one. */
export function LangGate({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang | null>(null);
  useEffect(() => {
    const l = currentLang();
    document.documentElement.lang = l;
    setLang(l);
  }, []);
  return lang ? <>{children}</> : null;
}

export function useLang(): Lang {
  return currentLang();
}

/** t("Spanish", "English") in the current language. */
export function useT(): T {
  const lang = currentLang();
  return useMemo(() => pick(lang), [lang]);
}
