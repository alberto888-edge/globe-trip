"use client";
import { useEffect, useMemo, useState } from "react";
import type { BudgetLevel, PlanRequest, TravelerLevel } from "@/lib/types";
import { countryName, flag, loadMorePlaces, searchPlaces, type PlaceLabel } from "@/lib/labels";
import { READY_TRIPS } from "@/lib/trips";
import PlacePhoto from "./PlacePhoto";
import Sheet from "./Sheet";

const DESTINATIONS: { name: string; wiki: string; tag: string; iso: string }[] = [
  { name: "Japón", wiki: "Fushimi Inari-taisha", tag: "Templos y neón", iso: "JP" },
  { name: "Italia", wiki: "Cinque Terre", tag: "Arte y pasta", iso: "IT" },
  { name: "Tailandia", wiki: "Railay", tag: "Playas e islas", iso: "TH" },
  { name: "Marruecos", wiki: "Chefchaouen", tag: "Medinas y desierto", iso: "MA" },
  { name: "Perú", wiki: "Machu Picchu", tag: "Andes e incas", iso: "PE" },
  { name: "Islandia", wiki: "Skógafoss", tag: "Glaciares y auroras", iso: "IS" },
  { name: "México", wiki: "Chichén Itzá", tag: "Cenotes y tacos", iso: "MX" },
  { name: "Grecia", wiki: "Santorini", tag: "Islas blancas", iso: "GR" },
  { name: "Portugal", wiki: "Lisboa", tag: "Costa y fado", iso: "PT" },
  { name: "Indonesia", wiki: "Bali", tag: "Bali y volcanes", iso: "ID" },
  { name: "Noruega", wiki: "Geirangerfjord", tag: "Fiordos", iso: "NO" },
  { name: "Estados Unidos", wiki: "Nueva York", tag: "Costa a costa", iso: "US" },
];

const THEMES = [
  "Playas paradisíacas", "Montaña y naturaleza", "Ciudades con encanto", "Gastronomía",
  "Aventura", "Escapada romántica", "Cultura e historia", "Mochilero low-cost",
];

const STYLES = ["Lo imprescindible", "Explorador", "Histórico y cultural", "Playero", "Naturaleza y aventura", "Gastronómico", "Relax", "Fiesta y noche"];

const TRAVELER: { id: TravelerLevel; label: string; hint: string }[] = [
  { id: "primera", label: "Primera vez", hint: "Lo más típico, sin prisas" },
  { id: "intermedio", label: "Intermedio", hint: "Clásicos y algo menos visto" },
  { id: "experto", label: "Experto", hint: "Fuera de las rutas típicas" },
];

const LEVELS: { id: BudgetLevel; label: string; hint: string }[] = [
  { id: "mochilero", label: "Mochilero", hint: "Hostales y transporte público" },
  { id: "medio", label: "Medio", hint: "Hoteles 3★ y algún tour" },
  { id: "alto", label: "Alto", hint: "Hoteles 4-5★ y experiencias" },
];

const eur = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 0 });

function Stepper({ id, label, value, min, max, onChange, unit }: { id: string; label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="stepper" role="group" aria-labelledby={id}>
      <span id={id} className="stepper-label">{label}</span>
      <div className="stepper-ctl">
        <button type="button" aria-label={`Menos ${unit}`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <b>{value}<small> {unit}</small></b>
        <button type="button" aria-label={`Más ${unit}`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

/** Country: a big flag. City or spot: a photo with the country's flag in the corner. */
function Suggestion({ p, onPick }: { p: PlaceLabel; onPick: () => void }) {
  const country = countryName(p.iso);
  return (
    <button type="button" className="suggest-row" role="option" aria-selected="false" onClick={onPick}>
      {p.kind === "country"
        ? <span className="suggest-flag" aria-hidden="true">{flag(p.iso) || "🌍"}</span>
        : <span className="suggest-photo"><PlacePhoto q={{ name: p.name, country }} /><i aria-hidden="true">{flag(p.iso)}</i></span>}
      <span className="suggest-text"><b>{p.name}</b><span>{p.kind === "country" ? "País" : country || "Ciudad"}</span></span>
    </button>
  );
}

export interface PlannerInit { destination?: string; context?: string; multiCountry?: boolean }

export default function PlannerSheet({ init, onSubmit, onReady, onClose }: {
  init?: PlannerInit;
  onSubmit: (req: PlanRequest, label: string) => void;
  onReady: (id: string, travelers: number) => void;
  onClose: () => void;
}) {
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
  const [origin, setOrigin] = useState("Madrid");

  // Suggestions as you type (after a short pause, so photos aren't fetched for every letter).
  const [typed, setTyped] = useState("");
  const [moreLoaded, setMoreLoaded] = useState(false);
  useEffect(() => { loadMorePlaces().then(() => setMoreLoaded(true)); }, []);
  useEffect(() => { const t = setTimeout(() => setTyped(query), 180); return () => clearTimeout(t); }, [query]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const suggestions = useMemo(() => searchPlaces(typed, 6), [typed, moreLoaded]);

  const nameFor = (p: PlaceLabel) => (p.kind === "country" || !countryName(p.iso) ? p.name : `${p.name}, ${countryName(p.iso)}`);
  const pick = (name: string) => { setDestination(name); setQuery(""); setTheme(null); setStep(2); };
  const toggleStyle = (s: string) => setStyles((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]));

  const label = [destination.trim(), theme].filter(Boolean).join(" · ") || "Tu viaje";
  const canNext = query.trim().length > 1 || !!theme;

  return (
    <Sheet label="Crea tu viaje" onClose={onClose}>
      <span className="eyebrow">CREA TU VIAJE · PASO {step} DE 2</span>
      {step === 1 ? (
        <>
          <h2>¿A dónde te apetece ir?</h2>
          <div className="suggest">
            <label htmlFor="dest" className="sr">Destino</label>
            <input id="dest" className="field" type="search" maxLength={120} autoComplete="off" enterKeyHint="next"
              placeholder="Busca un país, ciudad o lugar…" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && query.trim().length > 1) pick(suggestions[0] ? nameFor(suggestions[0]) : query.trim()); }} />
            {query.trim().length > 1 && (
              <div className="suggest-list" role="listbox" aria-label="Sugerencias">
                {suggestions.map((p) => (
                  <Suggestion key={p.id} p={p} onPick={() => pick(nameFor(p))} />
                ))}
                <button type="button" className="suggest-row suggest-free" onClick={() => pick(query.trim())}>
                  <span className="suggest-flag" aria-hidden="true">✨</span>
                  <span className="suggest-text"><b>«{query.trim()}»</b><span>Usar lo que he escrito</span></span>
                </button>
              </div>
            )}
          </div>

          {!query && (
            <>
              <span className="eyebrow">VIAJES LISTOS · SIN ESPERAR</span>
              <div className="ready-row">
                {READY_TRIPS.map((t) => (
                  <button key={t.id} type="button" className="ready" onClick={() => onReady(t.id, travelers)}>
                    <PlacePhoto className="ready-photo" q={{ name: t.cover, wiki: t.cover }} alt={t.name} />
                    <span className="ready-flags" aria-hidden="true">{t.countries.map(flag).join(" ")}</span>
                    <span className="ready-text">
                      <b>{t.name}</b>
                      <span>{t.tag}</span>
                      <em>{t.days} DÍAS · DESDE {eur(t.perPerson)} €/PERS.</em>
                    </span>
                  </button>
                ))}
              </div>

              <span className="eyebrow">DESTINOS POPULARES</span>
              <div className="dest-grid">
                {DESTINATIONS.map((d) => (
                  <button key={d.name} type="button" className="dest" onClick={() => pick(d.name)}>
                    <PlacePhoto className="dest-photo" q={{ name: d.wiki, wiki: d.wiki }} alt={d.name} />
                    <span className="dest-text"><b>{flag(d.iso)} {d.name}</b><span>{d.tag}</span></span>
                  </button>
                ))}
              </div>

              <span className="eyebrow" style={{ marginTop: 4 }}>¿SIN DESTINO? ELIGE UN ESTILO Y TE PROPONEMOS UNO</span>
              <div className="theme-row">
                {THEMES.map((t) => (
                  <button key={t} type="button" className="theme" aria-pressed={theme === t} onClick={() => setTheme(theme === t ? null : t)}>{t}</button>
                ))}
              </div>
            </>
          )}
          <div className="actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancelar</button>
            <button className="btn btn-solid" type="button" disabled={!canNext}
              onClick={() => { if (query.trim().length > 1) pick(query.trim()); else { setDestination(""); setStep(2); } }}>Siguiente</button>
          </div>
        </>
      ) : (
        <>
          <div className="plan-head">
            <h2>{label}</h2>
            <button className="link" type="button" onClick={() => setStep(1)}>Cambiar</button>
          </div>
          {init?.context && <p className="note">{init.context}</p>}

          <span className="eyebrow">¿QUÉ TIPO DE VIAJE? · PUEDES ELEGIR VARIOS</span>
          <div className="theme-row">
            {STYLES.map((s) => <button key={s} type="button" className="theme" aria-pressed={styles.includes(s)} onClick={() => toggleStyle(s)}>{s}</button>)}
          </div>

          <span className="eyebrow">TU EXPERIENCIA</span>
          <div className="level-row" role="radiogroup" aria-label="Tu experiencia">
            {TRAVELER.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className="level" onClick={() => setLevel(l.id)}>
                <b>{l.label}</b><span>{l.hint}</span>
              </button>
            ))}
          </div>

          <span className="eyebrow">DURACIÓN</span>
          <div className="seg" role="radiogroup" aria-label="Duración">
            <button type="button" role="radio" aria-checked={autoDays} onClick={() => setAutoDays(true)}>Recomiéndame los días</button>
            <button type="button" role="radio" aria-checked={!autoDays} onClick={() => setAutoDays(false)}>Elijo yo</button>
          </div>
          {autoDays
            ? <p className="note">Te proponemos la duración ideal para ver bien {destination.trim() || "el destino"} con tu estilo.</p>
            : <Stepper id="st-days" label="Días" value={days} min={2} max={30} unit="días" onChange={setDays} />}

          <label className="switch">
            <span><b>Varios países</b><small>Añade países vecinos si el viaje gana con ello</small></span>
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
            <i aria-hidden="true" />
          </label>

          <Stepper id="st-trav" label="Viajeros" value={travelers} min={1} max={10} unit={travelers === 1 ? "persona" : "personas"} onChange={setTravelers} />
          <span className="eyebrow">PRESUPUESTO</span>
          <div className="level-row" role="radiogroup" aria-label="Presupuesto">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={budget === l.id} className="level" onClick={() => setBudget(l.id)}>
                <b>{l.label}</b><span>{l.hint}</span>
              </button>
            ))}
          </div>
          <div className="row2">
            <label className="mini-field">
              <span>Máximo (opcional)</span>
              <input className="field" type="number" inputMode="numeric" min={0} placeholder="€ en total" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="mini-field">
              <span>Sales desde</span>
              <input className="field" type="text" maxLength={80} value={origin} onChange={(e) => setOrigin(e.target.value)} />
            </label>
          </div>
          <div className="actions">
            <button className="btn btn-ghost" type="button" onClick={() => setStep(1)}>Atrás</button>
            <button className="btn btn-solid" type="button" onClick={() => onSubmit({
              destination: destination.trim() || undefined, theme: theme || undefined,
              days: autoDays ? undefined : days, styles: styles.length ? styles : undefined, level, multiCountry: multi,
              context: init?.context, travelers, budget,
              budgetAmount: Number(amount) > 0 ? Number(amount) : undefined, origin: origin.trim() || undefined,
            }, label)}>Crear mi viaje</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
