// The language, without React, so data modules (globe labels, sample trips) can use it.
// Switching language reloads the page, so anything computed at start-up stays right.

export type Lang = "es" | "en";
export const LANG_KEY = "gt:lang";

export function browserLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of list) {
    const p = (l || "").slice(0, 2).toLowerCase();
    if (p === "es") return "es";
    if (p === "en") return "en";
  }
  return "en";
}

let cached: Lang | null = null;

/** What the person chose before, else the browser's language: Spanish for Spanish browsers, English otherwise. */
export function currentLang(): Lang {
  if (cached) return cached;
  // Outside the browser (tests, scripts): GT_LANG picks the language, English by default.
  if (typeof window === "undefined") return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GT_LANG === "es" ? "es" : "en";
  let l: Lang | null = null;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "es" || saved === "en") l = saved;
  } catch { /* private mode */ }
  cached = l ?? browserLang();
  return cached;
}

export function switchLang(l: Lang) {
  try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode */ }
  cached = l;
  window.location.reload();
}

export type T = (es: string, en: string) => string;
export const pick = (lang: Lang): T => (es, en) => (lang === "es" ? es : en);
export const locale = (lang: Lang) => (lang === "es" ? "es-ES" : "en-GB");

/** "Día 3" / "Days 3–5" for each stop, from its length in days. */
export function dayLabels(days: number[], lang: Lang): string[] {
  let d = 1;
  return days.map((n) => {
    const k = Math.max(1, Math.round(n || 1));
    const s = k === 1 ? `${lang === "es" ? "Día" : "Day"} ${d}` : `${lang === "es" ? "Días" : "Days"} ${d}–${d + k - 1}`;
    d += k;
    return s;
  });
}
