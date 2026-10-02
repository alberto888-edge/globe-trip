"use client";
import { useEffect, useMemo, useState } from "react";
import type { BudgetLevel, PlanRequest, TravelerLevel } from "@/lib/types";
import { countryByIso, countryByName, countryName, flag, kmToCountry, loadMorePlaces, nearbyCountries, resolvePlace, searchPlaces, type PlaceLabel } from "@/lib/labels";
import { distanceKm, fitFor } from "@/lib/geo";
import { READY_TRIPS } from "@/lib/trips";
import PlacePhoto from "./PlacePhoto";
import PlaceSearch, { FitNotice, fitMessage, placeText, Suggestion, type FitMsg } from "./PlaceSearch";
import Sheet from "./Sheet";
import { currentLang, locale, useLang, useT } from "@/lib/i18n";

// [Spanish, English] pairs. The label in the person's language is what the planner receives.
const EN = currentLang() === "en";
const L = (es: string, en: string) => (EN ? en : es);

const DESTINATIONS: { name: string; wiki: string; tag: string; iso: string }[] = [
  { name: L("Japón", "Japan"), wiki: "Fushimi Inari-taisha", tag: L("Templos y neón", "Temples and neon"), iso: "JP" },
  { name: L("Italia", "Italy"), wiki: "Cinque Terre", tag: L("Arte y pasta", "Art and pasta"), iso: "IT" },
  { name: L("Tailandia", "Thailand"), wiki: "Railay", tag: L("Playas e islas", "Beaches and islands"), iso: "TH" },
  { name: L("Marruecos", "Morocco"), wiki: "Chefchaouen", tag: L("Medinas y desierto", "Medinas and desert"), iso: "MA" },
  { name: L("Perú", "Peru"), wiki: "Machu Picchu", tag: L("Andes e incas", "Andes and Incas"), iso: "PE" },
  { name: L("Islandia", "Iceland"), wiki: "Skógafoss", tag: L("Glaciares y auroras", "Glaciers and auroras"), iso: "IS" },
  { name: L("México", "Mexico"), wiki: "Chichén Itzá", tag: L("Cenotes y tacos", "Cenotes and tacos"), iso: "MX" },
  { name: L("Grecia", "Greece"), wiki: "Santorini", tag: L("Islas blancas", "White islands"), iso: "GR" },
  { name: "Portugal", wiki: "Lisboa", tag: L("Costa y fado", "Coast and fado"), iso: "PT" },
  { name: "Indonesia", wiki: "Bali", tag: L("Bali y volcanes", "Bali and volcanoes"), iso: "ID" },
  { name: L("Noruega", "Norway"), wiki: "Geirangerfjord", tag: L("Fiordos", "Fjords"), iso: "NO" },
  { name: L("Estados Unidos", "United States"), wiki: "Nueva York", tag: L("Costa a costa", "Coast to coast"), iso: "US" },
];

const THEMES = [
  L("Playas paradisíacas", "Dream beaches"), L("Montaña y naturaleza", "Mountains and nature"), L("Ciudades con encanto", "Charming cities"), L("Gastronomía", "Food"),
  L("Aventura", "Adventure"), L("Escapada romántica", "Romantic getaway"), L("Cultura e historia", "Culture and history"), L("Mochilero low-cost", "Backpacking on a budget"),
];

const STYLES = [L("Lo imprescindible", "The essentials"), L("Explorador", "Explorer"), L("Histórico y cultural", "History and culture"), L("Playero", "Beaches"),
  L("Naturaleza y aventura", "Nature and adventure"), L("Gastronómico", "Food lover"), L("Relax", "Slow and relaxed"), L("Fiesta y noche", "Nightlife")];

const TRAVELER: { id: TravelerLevel; label: string; hint: string }[] = [
  { id: "primera", label: L("Primera vez", "First time"), hint: L("Lo más típico, sin prisas", "The classics, no rush") },
  { id: "intermedio", label: L("Intermedio", "Some experience"), hint: L("Clásicos y algo menos visto", "Classics and some lesser-known") },
  { id: "experto", label: L("Experto", "Seasoned"), hint: L("Fuera de las rutas típicas", "Off the beaten track") },
];

const LEVELS: { id: BudgetLevel; label: string; hint: string }[] = [
  { id: "mochilero", label: L("Mochilero", "Backpacker"), hint: L("Hostales y transporte público", "Hostels and public transport") },
  { id: "medio", label: L("Medio", "Mid-range"), hint: L("Hoteles 3★ y algún tour", "3★ hotels and a few tours") },
  { id: "alto", label: L("Alto", "Comfort"), hint: L("Hoteles 4-5★ y experiencias", "4-5★ hotels and experiences") },
];

const eur = (n: number) => n.toLocaleString(locale(currentLang()), { maximumFractionDigits: 0 });

function Stepper({ id, label, value, min, max, onChange, unit }: { id: string; label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  const t = useT();
  return (
    <div className="stepper" role="group" aria-labelledby={id}>
      <span id={id} className="stepper-label">{label}</span>
      <div className="stepper-ctl">
        <button type="button" aria-label={`${t("Menos", "Fewer")} ${unit}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <b>{value}<small> {unit}</small></b>
        <button type="button" aria-label={`${t("Más", "More")} ${unit}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

/** A place the person wants in the trip no matter what. No coordinates if it was typed freely. */
interface Must { name: string; text: string; iso?: string; lat?: number; lng?: number }
const mustFrom = (p: PlaceLabel): Must => ({ name: p.name, text: placeText(p), iso: p.iso, lat: p.lat, lng: p.lng });

export interface PlannerInit { destination?: string; context?: string; multiCountry?: boolean; countries?: string[]; mustSee?: string[] }

export default function PlannerSheet({ init, onSubmit, onReady, onClose }: {
  init?: PlannerInit;
  onSubmit: (req: PlanRequest, label: string) => void;
  onReady: (id: string, travelers: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const [step, setStep] = useState<1 | 2>(init?.destination ? 2 : 1);
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState(init?.destination || "");
  const [theme, setTheme] = useState<string | null>(null);
  const [styles, setStyles] = useState<string[]>([]);
  const [level, setLevel] = useState<TravelerLevel>("primera");
  const [autoDays, setAutoDays] = useState(true);
  const [days, setDays] = useState(10);
  const [multi, setMulti] = useState(!!init?.multiCountry);
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState<BudgetLevel>("medio");
  const [amount, setAmount] = useState("");
  const [origin, setOrigin] = useState(lang === "es" ? "Madrid" : "");
  const [destPlace, setDestPlace] = useState<PlaceLabel | undefined>(() => (init?.destination ? resolvePlace(init.destination) : undefined));
  const [must, setMust] = useState<Must[]>(() => (init?.mustSee || []).map((x) => { const p = resolvePlace(x); return p ? mustFrom(p) : { name: x, text: x }; }));
  const [countries, setCountries] = useState<string[]>(() => (init?.countries || []).map((c) => countryByName(c)?.iso).filter(Boolean) as string[]);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<FitMsg | null>(null);
  const [openCountries, setOpenCountries] = useState(false);

  // Suggestions as you type (after a short pause, so photos aren't fetched for every letter).
  const [typed, setTyped] = useState("");
  const [moreLoaded, setMoreLoaded] = useState(false);
  useEffect(() => { loadMorePlaces().then(() => setMoreLoaded(true)); }, []);
  useEffect(() => { const h = setTimeout(() => setTyped(query), 180); return () => clearTimeout(h); }, [query]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggestions = useMemo(() => searchPlaces(typed, 6), [typed, moreLoaded]);

  const pick = (name: string, place?: PlaceLabel) => {
    setDestination(name); setDestPlace(place ?? resolvePlace(name)); setQuery(""); setTheme(null); setStep(2);
    setMust([]); setCountries([]); setNotice(null); setAdding(false);
  };
  const destIso = destPlace?.iso;

  // Neighbours of the destination (measured town to town), plus any country a must-see place pulled in.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nearby = useMemo(() => (destIso ? nearbyCountries(destIso, 10) : []), [destIso, moreLoaded]);
  const countryOptions = useMemo(() => {
    const list = nearby.map((c) => ({ iso: c.iso, km: c.km as number | undefined, border: c.border }));
    for (const iso of countries) if (!list.some((c) => c.iso === iso)) list.push({ iso, km: undefined, border: false });
    return list;
  }, [nearby, countries]);
  const toggleCountry = (iso: string) => setCountries((l) => (l.includes(iso) ? l.filter((x) => x !== iso) : [...l, iso]));

  /** Adds a must-see place, unless it's another trip altogether (then it asks first). */
  const addMust = (p: PlaceLabel, force = false) => {
    setAdding(false);
    if (must.some((m) => m.text === placeText(p))) { setNotice({ tone: "info", text: t(`${p.name} ya está en tu ruta.`, `${p.name} is already in your route.`) }); return; }
    let km = 0, from = destination.split(",")[0].trim() || t("tu destino", "your destination");
    if (destPlace && p.iso !== destPlace.iso) km = kmToCountry(destPlace.iso, p);
    else if (!destPlace && must.some((m) => m.lat !== undefined)) km = Infinity;
    for (const m of must) {
      if (m.lat === undefined || m.lng === undefined) continue;
      const d = distanceKm({ lat: m.lat, lng: m.lng }, p);
      if (d < km) { km = d; from = m.name; }
    }
    if (!Number.isFinite(km)) km = 0;
    const fit = fitFor(km);
    if (fit === "tooFar" && !force) { setNotice({ ...fitMessage(fit, p.name, km, from, t)!, place: p }); return; }
    setMust((l) => [...l, mustFrom(p)]);
    const other = destIso && p.iso !== destIso && countryByIso(p.iso) ? p.iso : null;
    if (other) { setMulti(true); setCountries((l) => (l.includes(other) ? l : [...l, other])); }
    const far = fitMessage(fit, p.name, km, from, t);
    setNotice(far && fit === "far" ? far : other ? { tone: "info", text: t(`${flag(other)} ${countryName(other)} se suma a los países del viaje.`, `${flag(other)} ${countryName(other)} joins the trip's countries.`) } : null);
  };
  const toggleStyle = (s: string) => setStyles((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  const label = [destination.trim(), theme].filter(Boolean).join(" · ") || t("Tu viaje", "Your trip");
  const canNext = query.trim().length > 1 || !!theme;

  return (
    <Sheet label={t("Crea tu viaje", "Plan a trip")} onClose={onClose}>
      <span className="eyebrow">{t(`CREA TU VIAJE · PASO ${step} DE 2`, `PLAN A TRIP · STEP ${step} OF 2`)}</span>
      {step === 1 ? (
        <>
          <h2>{t("¿A dónde te apetece ir?", "Where do you fancy going?")}</h2>
          <div className="suggest">
            <label htmlFor="dest" className="sr">{t("Destino", "Destination")}</label>
            <input id="dest" className="field" type="search" maxLength={120} autoComplete="off" enterKeyHint="next"
              placeholder={t("Busca un país, ciudad o lugar…", "Search a country, city or place…")} value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && query.trim().length > 1) { if (suggestions[0]) pick(placeText(suggestions[0]), suggestions[0]); else pick(query.trim()); } }} />
            {query.trim().length > 1 && (
              <div className="suggest-list" role="listbox" aria-label={t("Sugerencias", "Suggestions")}>
                {suggestions.map((p) => (
                  <Suggestion key={p.id} p={p} onPick={() => pick(placeText(p), p)} />
                ))}
                <button type="button" className="suggest-row suggest-free" onClick={() => pick(query.trim())}>
                  <span className="suggest-flag" aria-hidden="true">✨</span>
                  <span className="suggest-text"><b>«{query.trim()}»</b><span>{t("Usar lo que he escrito", "Use what I typed")}</span></span>
                </button>
              </div>
            )}
          </div>

          {!query && (
            <>
              <span className="eyebrow">{t("VIAJES LISTOS · SIN ESPERAR", "READY-MADE TRIPS · NO WAITING")}</span>
              <div className="ready-row">
                {READY_TRIPS.map((rt) => (
                  <button key={rt.id} type="button" className="ready" onClick={() => onReady(rt.id, travelers)}>
                    <PlacePhoto className="ready-photo" q={{ name: rt.cover, wiki: rt.cover }} alt={rt.name} />
                    <span className="ready-flags" aria-hidden="true">{rt.countries.map(flag).join(" ")}</span>
                    <span className="ready-text">
                      <b>{rt.name}</b>
                      <span>{rt.tag}</span>
                      <em>{t(`${rt.days} DÍAS · DESDE ${eur(rt.perPerson)} €/PERS.`, `${rt.days} DAYS · FROM ${eur(rt.perPerson)} €/PERSON`)}</em>
                    </span>
                  </button>
                ))}
              </div>

              <span className="eyebrow">{t("DESTINOS POPULARES", "POPULAR DESTINATIONS")}</span>
              <div className="dest-grid">
                {DESTINATIONS.map((d) => (
                  <button key={d.name} type="button" className="dest" onClick={() => pick(d.name, countryByIso(d.iso))}>
                    <PlacePhoto className="dest-photo" q={{ name: d.wiki, wiki: d.wiki }} alt={d.name} />
                    <span className="dest-text"><b>{flag(d.iso)} {d.name}</b><span>{d.tag}</span></span>
                  </button>
                ))}
              </div>

              <span className="eyebrow" style={{ marginTop: 4 }}>{t("¿SIN DESTINO? ELIGE UN ESTILO Y TE PROPONEMOS UNO", "NO DESTINATION? PICK A STYLE AND WE'LL SUGGEST ONE")}</span>
              <div className="theme-row">
                {THEMES.map((th) => (
                  <button key={th} type="button" className="theme" aria-pressed={theme === th} onClick={() => setTheme(theme === th ? null : th)}>{th}</button>
                ))}
              </div>
            </>
          )}
          <div className="actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>{t("Cancelar", "Cancel")}</button>
            <button className="btn btn-solid" type="button" disabled={!canNext}
              onClick={() => { if (query.trim().length > 1) pick(query.trim()); else { setDestination(""); setStep(2); } }}>{t("Siguiente", "Next")}</button>
          </div>
        </>
      ) : (
        <>
          <div className="plan-head">
            <h2>{label}</h2>
            <button className="link" type="button" onClick={() => setStep(1)}>{t("Cambiar", "Change")}</button>
          </div>
          {init?.context && <p className="note">{init.context}</p>}

          <span className="eyebrow">{t("DESTINOS QUE QUIERES SÍ O SÍ · OPCIONAL", "PLACES YOU MUST SEE · OPTIONAL")}</span>
          <div className="must">
            {must.map((m) => (
              <span key={m.text} className="must-chip">
                <i aria-hidden="true">{flag(m.iso) || "📍"}</i>{m.name}
                <button type="button" aria-label={`${t("Quitar", "Remove")} ${m.name}`} onClick={() => setMust((l) => l.filter((x) => x !== m))}>×</button>
              </span>
            ))}
            {!adding && must.length < 6 && (
              <button type="button" className="must-add" onClick={() => { setAdding(true); setNotice(null); }}>{t("+ Añadir destino a la ruta", "+ Add a place to the route")}</button>
            )}
          </div>
          {adding && (
            <PlaceSearch id="must" autoFocus placeholder={t("Ciudad, parque, isla… que no te quieras perder", "A city, park, island… you don't want to miss")}
              onPick={(p) => addMust(p)}
              onFree={(x) => { setAdding(false); setNotice(null); setMust((l) => (l.some((m) => m.text === x) ? l : [...l, { name: x, text: x }])); }} />
          )}
          {notice && <FitNotice msg={notice} onClose={() => setNotice(null)} onAdd={notice.place ? () => { const p = notice.place!; setNotice(null); addMust(p, true); } : undefined} />}

          <span className="eyebrow">{t("¿QUÉ TIPO DE VIAJE? · PUEDES ELEGIR VARIOS", "WHAT KIND OF TRIP? · PICK AS MANY AS YOU LIKE")}</span>
          <div className="theme-row">
            {STYLES.map((s) => <button key={s} type="button" className="theme" aria-pressed={styles.includes(s)} onClick={() => toggleStyle(s)}>{s}</button>)}
          </div>

          <span className="eyebrow">{t("TU EXPERIENCIA", "YOUR EXPERIENCE")}</span>
          <div className="level-row" role="radiogroup" aria-label={t("Tu experiencia", "Your experience")}>
            {TRAVELER.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className="level" onClick={() => setLevel(l.id)}>
                <b>{l.label}</b><span>{l.hint}</span>
              </button>
            ))}
          </div>

          <span className="eyebrow">{t("DURACIÓN", "LENGTH")}</span>
          <div className="seg" role="radiogroup" aria-label={t("Duración", "Length")}>
            <button type="button" role="radio" aria-checked={autoDays} onClick={() => setAutoDays(true)}>{t("Recomiéndame los días", "Suggest the length")}</button>
            <button type="button" role="radio" aria-checked={!autoDays} onClick={() => setAutoDays(false)}>{t("Elijo yo", "I'll choose")}</button>
          </div>
          {autoDays
            ? <p className="note">{t(`Te proponemos la duración ideal para ver bien ${destination.trim() || "el destino"} con tu estilo.`, `We'll suggest the right length to see ${destination.trim() || "the destination"} properly in your style.`)}</p>
            : <Stepper id="st-days" label={t("Días", "Days")} value={days} min={2} max={30} unit={t("días", "days")} onChange={setDays} />}

          <label className="switch">
            <span><b>{t("Varios países", "Several countries")}</b><small>{t("Añade países vecinos si el viaje gana con ello", "Add neighbouring countries if the trip is better for it")}</small></span>
            <input type="checkbox" checked={multi} onChange={(e) => { setMulti(e.target.checked); setOpenCountries(e.target.checked && !countries.length); }} />
            <i aria-hidden="true" />
          </label>
          {multi && countryOptions.length > 0 && (
            <div className="cpick">
              <button type="button" className="cpick-head" aria-expanded={openCountries} onClick={() => setOpenCountries((o) => !o)}>
                <span className="cpick-flags" aria-hidden="true">{countries.length ? countries.slice(0, 4).map(flag).join("") : "🌍"}</span>
                <span className="cpick-text">
                  <b>{countries.length ? countries.map(countryName).join(", ") : t(`Países cerca de ${countryName(destIso) || destination}`, `Countries near ${countryName(destIso) || destination}`)}</b>
                  <small>{countries.length ? t(`${countries.length} ${countries.length === 1 ? "país elegido" : "países elegidos"} · toca para cambiar`, `${countries.length} ${countries.length === 1 ? "country" : "countries"} picked · tap to change`) : t("Elige los que quieras, o lo decidimos nosotros", "Pick any you like, or leave it to us")}</small>
                </span>
                <i className="cpick-chev" aria-hidden="true" />
              </button>
              {openCountries && (
                <div className="cpick-list" role="listbox" aria-multiselectable="true" aria-label={t("Países cercanos", "Nearby countries")}>
                  {countryOptions.map((c) => (
                    <button key={c.iso} type="button" role="option" aria-selected={countries.includes(c.iso)} className="cpick-opt" onClick={() => toggleCountry(c.iso)}>
                      <span className="cpick-flag" aria-hidden="true">{flag(c.iso)}</span>
                      <span className="cpick-name"><b>{countryName(c.iso)}</b><small>{c.km === undefined ? t("Por tu destino añadido", "From a place you added") : c.border ? t("Frontera", "Shares a border") : `~${(Math.max(100, Math.round(c.km / 100) * 100)).toLocaleString(locale(lang))} km`}</small></span>
                      <i className="cpick-check" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Stepper id="st-trav" label={t("Viajeros", "Travellers")} value={travelers} min={1} max={10} unit={travelers === 1 ? t("persona", "person") : t("personas", "people")} onChange={setTravelers} />
          <span className="eyebrow">{t("PRESUPUESTO", "BUDGET")}</span>
          <div className="level-row" role="radiogroup" aria-label={t("Presupuesto", "Budget")}>
            {LEVELS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={budget === l.id} className="level" onClick={() => setBudget(l.id)}>
                <b>{l.label}</b><span>{l.hint}</span>
              </button>
            ))}
          </div>
          <div className="row2">
            <label className="mini-field">
              <span>{t("Máximo (opcional)", "Maximum (optional)")}</span>
              <input className="field" type="number" inputMode="numeric" min={0} placeholder={t("€ en total", "€ in total")} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="mini-field">
              <span>{t("Sales desde", "Flying from")}</span>
              <input className="field" type="text" maxLength={80} placeholder={t("Ciudad", "e.g. London")} value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>{t("Atrás", "Back")}</button>
            <button className="btn btn-solid" type="button" onClick={() => onSubmit({
              destination: destination.trim() || undefined, theme: theme || undefined,
              days: autoDays ? undefined : days, styles: styles.length ? styles : undefined, level, multiCountry: multi,
              countries: multi && countries.length ? countries.map(countryName).filter(Boolean) : undefined,
              mustSee: must.length ? must.map((m) => m.text) : undefined,
              context: init?.context, travelers, budget,
              budgetAmount: Number(amount) > 0 ? Number(amount) : undefined, origin: origin.trim() || undefined,
            }, label)}>{t("Crear mi viaje", "Plan my trip")}</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
