"use client";
import { useEffect, useMemo, useState } from "react";
import { countryName, flag, loadMorePlaces, searchPlaces, type PlaceLabel } from "@/lib/labels";
import PlacePhoto from "./PlacePhoto";
import { currentLang, locale, useT, type T } from "@/lib/i18n";

/** Country: a big flag. City or spot: a photo with the country's flag in the corner. */
export function Suggestion({ p, onPick }: { p: PlaceLabel; onPick: () => void }) {
  const t = useT();
  const country = countryName(p.iso);
  return (
    <button type="button" className="suggest-row" role="option" aria-selected="false" onClick={onPick}>
      {p.kind === "country"
        ? <span className="suggest-flag" aria-hidden="true">{flag(p.iso) || "🌍"}</span>
        : <span className="suggest-photo"><PlacePhoto q={{ name: p.name, country }} /><i aria-hidden="true">{flag(p.iso)}</i></span>}
      <span className="suggest-text"><b>{p.name}</b><span>{p.kind === "country" ? t("País", "Country") : country || t("Ciudad", "City")}</span></span>
    </button>
  );
}

/** "Kioto, Japón" for a city, "Japón" for a country. */
export const placeText = (p: PlaceLabel) => (p.kind === "country" || !countryName(p.iso) ? p.name : `${p.name}, ${countryName(p.iso)}`);

/** Search box with flag/photo suggestions as you type. */
export default function PlaceSearch({ id, placeholder, autoFocus, onPick, onFree, limit = 6 }: {
  id: string; placeholder: string; autoFocus?: boolean; limit?: number;
  onPick: (p: PlaceLabel) => void;
  onFree?: (text: string) => void; // "use what I typed" (no coordinates)
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [moreLoaded, setMoreLoaded] = useState(false);
  useEffect(() => { loadMorePlaces().then(() => setMoreLoaded(true)); }, []);
  // After a short pause, so photos aren't fetched for every letter.
  useEffect(() => { const h = setTimeout(() => setTyped(query), 180); return () => clearTimeout(h); }, [query]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggestions = useMemo(() => searchPlaces(typed, limit), [typed, moreLoaded, limit]);
  const pick = (p: PlaceLabel) => { setQuery(""); onPick(p); };
  const free = () => { const q = query.trim(); if (q.length > 1 && onFree) { setQuery(""); onFree(q); } };

  return (
    <div className="suggest">
      <label htmlFor={id} className="sr">{placeholder}</label>
      <input id={id} className="field" type="search" maxLength={120} autoComplete="off" enterKeyHint="go" autoFocus={autoFocus}
        placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || query.trim().length < 2) return;
          e.preventDefault();
          if (suggestions[0]) pick(suggestions[0]); else free();
        }} />
      {query.trim().length > 1 && (
        <div className="suggest-list" role="listbox" aria-label={t("Sugerencias", "Suggestions")}>
          {suggestions.map((p) => <Suggestion key={p.id} p={p} onPick={() => pick(p)} />)}
          {onFree && (
            <button type="button" className="suggest-row suggest-free" onClick={free}>
              <span className="suggest-flag" aria-hidden="true">✨</span>
              <span className="suggest-text"><b>«{query.trim()}»</b><span>{t("Usar lo que he escrito", "Use what I typed")}</span></span>
            </button>
          )}
          {!onFree && !suggestions.length && typed === query && <div className="suggest-empty">{t("No encuentro ese sitio. Prueba con la ciudad más cercana.", "Can't find that place. Try the nearest city.")}</div>}
        </div>
      )}
    </div>
  );
}

const kmText = (km: number) => `~${(Math.round(km / 100) * 100 || Math.round(km)).toLocaleString(locale(currentLang()))} km`;

/** What happens when a place is added far from the rest of the trip. */
export interface FitMsg { tone: "info" | "warn" | "stop"; text: string; place?: PlaceLabel }

export function fitMessage(fit: "near" | "far" | "tooFar", place: string, km: number, from: string, t: T): FitMsg | null {
  if (fit === "far") return { tone: "warn", text: t(`${place} queda a ${kmText(km)} de ${from}: se puede, pero cuenta con un vuelo interno o un trayecto largo.`, `${place} is ${kmText(km)} from ${from}: doable, but plan on an internal flight or a long journey.`) };
  if (fit === "tooFar") return { tone: "stop", text: t(`${place} queda a ${kmText(km)} de ${from}: está demasiado lejos para hacerlo en el mismo viaje.`, `${place} is ${kmText(km)} from ${from}: too far to fit in the same trip.`) };
  return null;
}

export function FitNotice({ msg, onAdd, onClose }: { msg: FitMsg; onAdd?: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <div className={`fit fit--${msg.tone}`} role={msg.tone === "stop" ? "alert" : "status"}>
      <span aria-hidden="true">{msg.tone === "stop" ? "✋" : msg.tone === "warn" ? "✈️" : "✓"}</span>
      <p>{msg.text}</p>
      {msg.tone === "stop" && onAdd ? (
        <div className="fit-actions">
          <button type="button" onClick={onClose}>{t("No añadir", "Don't add")}</button>
          <button type="button" onClick={onAdd}>{t("Añadir igualmente", "Add anyway")}</button>
        </div>
      ) : (
        <button type="button" className="x" aria-label={t("Cerrar aviso", "Close")} onClick={onClose}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </div>
  );
}
