"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzeOk, AnalyzeResponse, Candidate, Pin, PinType, PlanRequest, PlanResponse, Route } from "@/lib/types";
import { DEMO_ROUTES, EXAMPLES, SEED_PINS } from "@/lib/demo";
import { frame, routeKm } from "@/lib/geo";
import { detectPlatform, toUrl } from "@/lib/links";
import { routeFromCandidates } from "@/lib/itinerary";
import { usePersistentState } from "@/lib/storage";
import { usePlaceInfo } from "@/lib/wiki";
import { countryByName, countryName, flag, type PlaceLabel } from "@/lib/labels";
import { readyRoute } from "@/lib/trips";
import { RISK_LABEL } from "@/lib/risk";
import type { Focus } from "./GlobeCanvas";
import Sheet from "./Sheet";
import PlacePhoto from "./PlacePhoto";
import PickSheet from "./PickSheet";
import PlannerSheet, { type PlannerInit } from "./PlannerSheet";
import ItinerarySheet from "./ItinerarySheet";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });

type SheetState =
  | { kind: "add"; lat: number; lng: number }
  | { kind: "pin"; id: string }
  | { kind: "itinerary" }
  | { kind: "trips" }
  | { kind: "pick"; result: AnalyzeOk }
  | { kind: "planner"; init?: PlannerInit }
  | { kind: "place"; place: PlacePick }
  | null;

/** A city or country tapped on the globe, or the country a video was about. */
interface PlacePick { name: string; lat: number; lng: number; kind: "city" | "country"; iso?: string; country?: string; intro?: string; context?: string }

interface Analysis { label: string; steps: string[]; step: number; cancellable: boolean }

const VIDEO_STEPS = ["Abriendo el vídeo", "Viendo los fotogramas", "Detectando los lugares"];
const PLAN_STEPS = ["Eligiendo los mejores sitios", "Ordenando la ruta y los días", "Calculando el presupuesto"];
const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(1)}° ${v >= 0 ? pos : neg}`;
const coords = (lat: number, lng: number) => `${fmt(lat, "N", "S")} · ${fmt(lng, "E", "O")}`;
const uid = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  const [pins, setPins] = usePersistentState<Pin[]>("gt:pins", SEED_PINS);
  const [trips, setTrips] = usePersistentState<Route[]>("gt:trips", []);
  const [route, setRoute, routeLoaded] = usePersistentState<Route | null>("gt:route", null);
  const [hinted, setHinted] = usePersistentState<boolean>("gt:hinted", false);

  const [revealed, setRevealed] = useState(99);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [bottomInset, setBottomInset] = useState(180);
  const [input, setInput] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didRestore = useRef(false);

  // ---------- helpers ----------
  const say = useCallback((msg: string, ms = 3000) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // spread = degrees of arc that must fit on screen (≈ 1° per 111 km)
  const flyTo = useCallback((lat: number, lng: number, spread: number, ms?: number) => {
    setFocus({ lat, lng, spread, ms, key: Date.now() });
  }, []);
  const flyHome = useCallback(() => setFocus({ lat: 28, lng: 8, home: true, key: Date.now() }), []);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const showRoute = useCallback((r: Route, animate = true, then?: () => void) => {
    clearTimers();
    setRoute(r);
    const { center, spread } = frame(r.stops);
    flyTo(center.lat, center.lng, spread, animate ? 1800 : 0);
    if (!animate) { setRevealed(r.stops.length); return; }
    setRevealed(0);
    // Reveal stops one by one once the camera has mostly arrived.
    r.stops.forEach((_, i) => later(() => setRevealed(i + 1), 1100 + i * 650));
    if (then) later(then, 1100 + r.stops.length * 650 + 500);
  }, [flyTo, setRoute]);

  // Measure the bottom UI so the globe centres in the free space above it.
  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBottomInset(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Restore the last route once the globe is up.
  useEffect(() => {
    if (!globeReady || !routeLoaded || didRestore.current) return;
    didRestore.current = true;
    if (route?.stops?.length) showRoute(route, false);
  }, [globeReady, routeLoaded, route, showRoute]);

  useEffect(() => () => { clearTimers(); abortRef.current?.abort(); }, []);

  // ---------- progress card ----------
  const startProgress = (label: string, steps: string[], cancellable: boolean, stepAt: number[]) => {
    clearTimers();
    setAnalysis({ label, steps, step: 0, cancellable });
    stepAt.forEach((ms, i) => later(() => setAnalysis((a) => (a ? { ...a, step: Math.max(a.step, i + 1) } : a)), ms));
  };
  const stopProgress = () => { clearTimers(); setAnalysis(null); };

  // ---------- video → places → route ----------
  const runDemo = (routeId: string) => {
    const base = DEMO_ROUTES.find((r) => r.id === routeId);
    if (!base) return;
    startProgress(`Ejemplo · ${base.name}`, VIDEO_STEPS, false, [700, 1400]);
    later(() => {
      setAnalysis(null);
      showRoute({ ...base, id: `${base.id}-${uid()}`, kind: "demo" });
      say(`${base.stops.length} lugares · ${base.name}`);
    }, 2100);
  };

  const buildFromPicked = (result: AnalyzeOk, picked: Candidate[]) => {
    const r = routeFromCandidates(result.name, picked, result.source, result.sources, result.risks);
    showRoute(r);
    say(`Ruta creada con ${picked.length} ${picked.length === 1 ? "lugar" : "lugares"}`);
  };

  const analyze = async (payload: { url?: string; text?: string }) => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const label = payload.url || `«${payload.text!.slice(0, 60)}${payload.text!.length > 60 ? "…" : ""}»`;
    startProgress(label, VIDEO_STEPS, true, payload.url ? [2500, 7000] : [800, 2500]);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctl.signal,
      });
      let data: AnalyzeResponse;
      try { data = await res.json(); } catch { data = { ok: false, code: "upstream", message: "El servidor no ha respondido bien." }; }
      stopProgress();
      if (!data.ok) { say(data.message, 5000); return; }
      setInput("");
      // Only a country or region, no concrete spots: offer to plan a trip there instead of a one-stop "route".
      if (data.candidates.every((c) => c.scope && c.scope !== "place")) {
        const c = data.candidates[0];
        flyTo(c.lat, c.lng, c.scope === "country" ? 14 : 6);
        setSheet({
          kind: "place",
          place: {
            name: c.name, lat: c.lat, lng: c.lng, kind: c.scope === "country" ? "country" : "city", country: c.scope === "country" ? undefined : c.country,
            iso: countryByName(c.scope === "country" ? c.name : c.country || "")?.iso,
            intro: `El vídeo es de ${c.name}, pero no nombra sitios concretos. Te organizo un viaje allí con los mejores lugares.`,
            context: `Inspirado en un vídeo de ${c.name}: ${[data.name, c.note].filter(Boolean).join(". ")}`.slice(0, 380),
          },
        });
        return;
      }
      if (data.candidates.length === 1) buildFromPicked(data, data.candidates);
      else setSheet({ kind: "pick", result: data });
    } catch (e: any) {
      stopProgress();
      say(e?.name === "AbortError" ? "Análisis cancelado" : "Sin conexión con el servidor. Vuelve a intentarlo.");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (analysis) return;
    const val = input.trim();
    if (!val) { say("Pega un enlace de TikTok o Instagram"); return; }
    if (detectPlatform(val)) { analyze({ url: val }); return; }
    if (toUrl(val)) { say("Ese enlace no es de TikTok ni de Instagram"); return; }
    if (val.length < 12) { say("Escribe un poco más: qué lugares salen en el vídeo"); return; }
    analyze({ text: val });
  };

  // ---------- plan a trip ----------
  const plan = async (req: PlanRequest, label: string) => {
    setSheet(null);
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    startProgress(label, PLAN_STEPS, true, [2500, 7000]);
    try {
      const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal: ctl.signal });
      let data: PlanResponse;
      try { data = await res.json(); } catch { data = { ok: false, code: "upstream", message: "El servidor no ha respondido bien." }; }
      stopProgress();
      if (!data.ok) { say(data.message, 5000); return; }
      showRoute(data.route, true, () => setSheet({ kind: "itinerary" }));
      say(`${data.route.name} · ${data.route.days} días`);
    } catch (e: any) {
      stopProgress();
      say(e?.name === "AbortError" ? "Cancelado" : "Sin conexión con el servidor. Vuelve a intentarlo.");
    }
  };

  const runReady = (id: string, travelers: number) => {
    const r = readyRoute(id, travelers);
    if (!r) return;
    setSheet(null);
    showRoute(r, true, () => setSheet({ kind: "itinerary" }));
    say(`${r.name} · ${r.days} días`);
  };

  const adaptInit = (r: Route): PlannerInit => {
    const countries = [...new Set(r.stops.map((s) => s.country).filter(Boolean) as string[])];
    return {
      destination: r.request?.destination || countries.join(", ") || r.stops.map((s) => s.name).slice(0, 4).join(", "),
      multiCountry: r.request?.multiCountry ?? countries.length > 1,
      context: r.kind === "video" ? `Inspirado en el vídeo «${r.name}»: ${r.stops.map((s) => s.name).join(", ")}`.slice(0, 380) : undefined,
    };
  };

  // ---------- pins ----------
  const addPin = (p: Omit<Pin, "id">) => {
    setPins((list) => [...list, { ...p, id: uid() }]);
    say(p.type === "visitado" ? `${p.name} añadido a tus viajes` : `${p.name} añadido a «Quiero ir»`);
  };
  const removePin = (id: string) => {
    const p = pins.find((x) => x.id === id);
    setPins((list) => list.filter((x) => x.id !== id));
    if (p) say(`${p.name} quitado`);
  };
  const togglePin = (id: string) => {
    setPins((list) => list.map((x) => (x.id === id ? { ...x, type: x.type === "visitado" ? "wishlist" : "visitado" } : x)));
  };

  const saveTrip = () => {
    if (!route || trips.some((t) => t.id === route.id)) return;
    setTrips((t) => [route, ...t]);
    const fresh: Pin[] = route.stops
      .filter((s) => !pins.some((p) => p.name.toLowerCase() === s.name.toLowerCase()))
      .map((s) => ({ id: uid(), name: s.name, lat: s.lat, lng: s.lng, type: "wishlist" }));
    if (fresh.length) setPins((list) => [...list, ...fresh]);
    say(`Ruta guardada${fresh.length ? ` · ${fresh.length} lugares a «Quiero ir»` : ""}`);
  };

  const shareRoute = async () => {
    if (!route) return;
    const lines = route.stops.map((s, i) => `${i + 1}. ${s.name} — ${s.when}`);
    if (route.budget) lines.push(`Presupuesto estimado: ${route.budget.total.toLocaleString("es-ES")} €`);
    const text = `${route.name} (${route.days} días)\n${lines.join("\n")}`;
    try {
      if (navigator.share) { await navigator.share({ title: route.name, text }); return; }
      await navigator.clipboard.writeText(text);
      say("Itinerario copiado");
    } catch { /* cancelled */ }
  };

  const visited = pins.filter((p) => p.type === "visitado").length;
  const wish = pins.length - visited;
  const saved = route ? trips.some((t) => t.id === route.id) : false;

  return (
    <>
      <svg className="watermark" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" strokeWidth="0.9" aria-hidden="true">
        {/* an old chart: graticule, rhumb lines from two compass roses, degree marks */}
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => <ellipse key={`m${k}`} cx="200" cy="330" rx={Math.abs(k) * 82 || 0.5} ry="250" />)}
        {[-2, -1, 0, 1, 2].map((k) => <path key={`p${k}`} d={`M-40 ${330 + k * 92}Q200 ${330 + k * 80} 440 ${330 + k * 92}`} />)}
        <circle cx="200" cy="330" r="250" />
        <g opacity="0.7">{Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8; return <path key={i} d={`M60 690L${60 + Math.cos(a) * 520} ${690 + Math.sin(a) * 520}`} />; })}</g>
        <g opacity="0.7">{Array.from({ length: 16 }, (_, i) => { const a = (i * Math.PI) / 8; return <path key={i} d={`M350 70L${350 + Math.cos(a) * 520} ${70 + Math.sin(a) * 520}`} />; })}</g>
        <g transform="translate(60,690)"><circle r="30" /><circle r="22" /><path d="M0-44L6-6L44 0L6 6L0 44L-6 6L-44 0L-6-6Z" /><text y="-50" textAnchor="middle">N</text></g>
        <g transform="translate(350,70)"><circle r="20" /><path d="M0-30L4-4L30 0L4 4L0 30L-4 4L-30 0L-4-4Z" /></g>
        {[0, 30, 60, 90, 120, 150].map((d, i) => <text key={d} x={18 + i * 70} y="788">{d}°</text>)}
        {[60, 30, 0, 30, 60].map((d, i) => <text key={i} x="6" y={150 + i * 92}>{d}°</text>)}
      </svg>

      {!globeReady && <div className="loading">Cargando la Tierra…</div>}

      <div className="stage">
        <GlobeCanvas
          pins={pins}
          route={route}
          revealed={revealed}
          focus={focus}
          bottomInset={bottomInset}
          onReady={() => setGlobeReady(true)}
          onInteract={() => { if (!hinted) setHinted(true); }}
          onGlobeTap={(lat, lng) => { if (!hinted) setHinted(true); setSheet({ kind: "add", lat, lng }); }}
          onPinTap={(id) => setSheet({ kind: "pin", id })}
          onStopTap={(i) => { const s = route?.stops[i]; if (s) flyTo(s.lat, s.lng, 1.2); }}
          onLabelTap={(l: PlaceLabel) => {
            if (!hinted) setHinted(true);
            setSheet({ kind: "place", place: { name: l.name, lat: l.lat, lng: l.lng, kind: l.kind, iso: l.iso, country: l.kind === "city" ? countryName(l.iso) : undefined } });
          }}
        />
      </div>

      <header className="topbar">
        <span className="brand glass">Globe Trip</span>
        <div className="topbar-right">
          <span className="stats glass mono" aria-label={`${visited} lugares visitados, ${wish} por visitar`}>
            <span><i className="dot" style={{ background: "var(--visited)" }} /><b>{visited}</b></span>
            <span><i className="dot" style={{ background: "var(--wishlist)" }} /><b>{wish}</b></span>
          </span>
          <button className="iconbtn glass" type="button" aria-label="Mis viajes" onClick={() => setSheet({ kind: "trips" })}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>
            {trips.length > 0 && <span className="badge">{trips.length}</span>}
          </button>
        </div>
      </header>

      <div className="bottom" ref={bottomRef}>
        <span className={`hint glass ${hinted || route || analysis ? "gone" : ""}`}>Arrastra para girar · toca para marcar</span>

        {analysis && (
          <section className="analysis glass" aria-live="polite">
            <div className="analysis-head">
              <span className="analysis-label mono">{analysis.label}</span>
              {analysis.cancellable && <button className="btn-small" type="button" onClick={() => abortRef.current?.abort()}>Cancelar</button>}
            </div>
            {analysis.steps.map((s, i) => (
              <div key={s} className={`step ${i < analysis.step ? "done" : i === analysis.step ? "active" : ""}`}><i />{s}</div>
            ))}
          </section>
        )}

        {route && !analysis && (
          <section className="routecard glass" aria-live="polite">
            <div className="routecard-head">
              <div>
                <div className="routecard-title">{route.name}{route.ai && <span className="tag">IA</span>}
                  {route.risks && route.risks.level >= 3 && <span className={`tag tag-risk risk-${route.risks.level}`}>{RISK_LABEL[route.risks.level]}</span>}</div>
                <div className="routecard-meta mono">
                  {route.days} DÍAS · {route.stops.length} PARADAS · {Math.round(routeKm(route.stops)).toLocaleString("es-ES")} KM
                  {route.budget ? ` · ~${route.budget.total.toLocaleString("es-ES")} €` : ""}
                </div>
              </div>
              <div className="routecard-actions">
                <button className="link" type="button" onClick={() => setSheet({ kind: "itinerary" })}>Itinerario</button>
                <button className="x" type="button" aria-label="Cerrar ruta" onClick={() => { clearTimers(); setRoute(null); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
            </div>
            <div className="chips">
              {route.stops.map((s, i) => (
                <button key={i} type="button" className="chip" onClick={() => flyTo(s.lat, s.lng, 1.2)}>
                  <PlacePhoto className="chip-photo" q={{ name: s.name, wiki: s.wiki, country: s.country }} />
                  <span className="chip-text"><em>{i + 1} · {s.when.toUpperCase()}</em><b>{s.name}</b><span>{s.sub}</span></span>
                </button>
              ))}
            </div>
          </section>
        )}

        <form className="pill glass" onSubmit={submit}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.55 }} aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" />
          </svg>
          <label htmlFor="link" className="sr">Enlace del vídeo</label>
          <input id="link" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" autoCorrect="off" enterKeyHint="go"
            placeholder="Pega tu enlace de TikTok/IG" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn-primary" type="submit" disabled={!!analysis}>{analysis ? "…" : "SUBIR"}</button>
        </form>

        {!analysis && (
          <div className="quick">
            <button type="button" className="quick-plan" onClick={() => setSheet({ kind: "planner" })}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>
              Crea tu viaje
            </button>
            {!route && EXAMPLES.map((ex) => <button key={ex.routeId} type="button" className="quick-ex" onClick={() => runDemo(ex.routeId)}>{ex.label}</button>)}
          </div>
        )}
      </div>

      {/* ---------- sheets ---------- */}
      {sheet?.kind === "add" && (
        <AddSheet lat={sheet.lat} lng={sheet.lng} onClose={() => setSheet(null)} onSave={(p) => { addPin(p); setSheet(null); }} />
      )}

      {sheet?.kind === "pin" && (() => {
        const p = pins.find((x) => x.id === sheet.id);
        if (!p) return null;
        return (
          <PinSheet pin={p} onClose={() => setSheet(null)}
            onToggle={() => { togglePin(p.id); setSheet(null); say(p.type === "visitado" ? `${p.name} movido a «Quiero ir»` : `¡${p.name} visitado!`); }}
            onRemove={() => { removePin(p.id); setSheet(null); }} />
        );
      })()}

      {sheet?.kind === "pick" && (
        <PickSheet result={sheet.result} onClose={() => setSheet(null)}
          onConfirm={(picked) => { const r = sheet.result; setSheet(null); buildFromPicked(r, picked); }} />
      )}

      {sheet?.kind === "planner" && <PlannerSheet init={sheet.init} onClose={() => setSheet(null)} onSubmit={plan} onReady={runReady} />}

      {sheet?.kind === "place" && (
        <PlaceSheet place={sheet.place} onClose={() => setSheet(null)}
          onPlan={() => {
            const p = sheet.place;
            setSheet({ kind: "planner", init: { destination: p.country ? `${p.name}, ${p.country}` : p.name, context: p.context } });
          }}
          onPin={(type) => { const p = sheet.place; addPin({ name: p.name, lat: p.lat, lng: p.lng, type }); setSheet(null); }} />
      )}

      {sheet?.kind === "itinerary" && route && (
        <ItinerarySheet route={route} saved={saved} onClose={() => setSheet(null)} onSave={saveTrip} onShare={shareRoute}
          onShow={(s) => { setSheet(null); flyTo(s.lat, s.lng, 1.2); }}
          onAdapt={route.kind === "demo" ? undefined : () => setSheet({ kind: "planner", init: adaptInit(route) })} />
      )}

      {sheet?.kind === "trips" && (
        <TripsSheet pins={pins} trips={trips} onClose={() => setSheet(null)}
          onPin={(p) => { setSheet(null); flyTo(p.lat, p.lng, 4); }}
          onRemovePin={removePin}
          onTrip={(t) => { setSheet(null); showRoute(t); }}
          onRemoveTrip={(id) => { setTrips((l) => l.filter((t) => t.id !== id)); say("Ruta eliminada"); }}
          onReset={() => { setPins(SEED_PINS); setTrips([]); setRoute(null); setSheet(null); flyHome(); say("Todo reiniciado"); }}
        />
      )}

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

// ---------------------------------------------------------------- sheets

function PlaceSheet({ place, onClose, onPlan, onPin }: { place: PlacePick; onClose: () => void; onPlan: () => void; onPin: (t: PinType) => void }) {
  const { info } = usePlaceInfo({ name: place.name, country: place.country });
  const f = flag(place.iso);
  return (
    <Sheet label={place.name} onClose={onClose}>
      <PlacePhoto className="hero-photo" large q={{ name: place.name, country: place.country }} />
      <span className="eyebrow">{f && <span className="eyebrow-flag">{f}</span>}{place.kind === "country" ? "PAÍS" : (place.country || "LUGAR").toUpperCase()}</span>
      <h2>{place.name}</h2>
      {place.intro && <p className="note note-strong">{place.intro}</p>}
      {info?.extract && <p className="note">{info.extract.length > 280 ? info.extract.slice(0, 280).replace(/\s\S*$/, "") + "…" : info.extract}</p>}
      <button className="btn btn-solid btn-wide" type="button" onClick={onPlan}>
        Organizar un viaje {place.kind === "country" ? "por" : "a"} {place.name}
      </button>
      <div className="row2">
        <button type="button" className="toggle t-wishlist" onClick={() => onPin("wishlist")}>Quiero ir</button>
        <button type="button" className="toggle t-visitado" onClick={() => onPin("visitado")}>He estado</button>
      </div>
    </Sheet>
  );
}

function PinSheet({ pin, onClose, onToggle, onRemove }: { pin: Pin; onClose: () => void; onToggle: () => void; onRemove: () => void }) {
  const { info } = usePlaceInfo({ name: pin.name });
  return (
    <Sheet label={pin.name} onClose={onClose}>
      <PlacePhoto className="hero-photo" large q={{ name: pin.name }} />
      <span className="eyebrow">{pin.type === "visitado" ? "HE ESTADO" : "QUIERO IR"}</span>
      <h2>{pin.name}</h2>
      <p className="sub">{coords(pin.lat, pin.lng)}</p>
      {info?.extract && <p className="note">{info.extract.length > 260 ? info.extract.slice(0, 260).replace(/\s\S*$/, "") + "…" : info.extract}</p>}
      <div className="actions">
        <button className="btn btn-ghost" type="button" onClick={onToggle}>{pin.type === "visitado" ? "Mover a Quiero ir" : "Ya he estado"}</button>
        <button className="btn btn-danger" type="button" onClick={onRemove}>Quitar</button>
      </div>
    </Sheet>
  );
}

function AddSheet({ lat, lng, onClose, onSave }: { lat: number; lng: number; onClose: () => void; onSave: (p: Omit<Pin, "id">) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PinType | null>(null);
  const ok = name.trim().length > 0 && type;
  const save = () => { if (ok) onSave({ name: name.trim(), lat, lng, type: type! }); };
  return (
    <Sheet label="Marcar este lugar" onClose={onClose}>
      <h2>Marcar este lugar</h2>
      <p className="sub">{coords(lat, lng)}</p>
      <label htmlFor="place" className="sr">Nombre del lugar</label>
      <input id="place" className="field" type="text" maxLength={40} placeholder="Nombre del lugar (p. ej. Lisboa)" autoFocus
        value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
      <div className="row2">
        <button type="button" className="toggle t-visitado" aria-pressed={type === "visitado"} onClick={() => setType("visitado")}>He estado</button>
        <button type="button" className="toggle t-wishlist" aria-pressed={type === "wishlist"} onClick={() => setType("wishlist")}>Quiero ir</button>
      </div>
      <div className="actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn btn-solid" type="button" disabled={!ok} onClick={save}>Guardar</button>
      </div>
    </Sheet>
  );
}

function TripsSheet(props: {
  pins: Pin[]; trips: Route[]; onClose: () => void;
  onPin: (p: Pin) => void; onRemovePin: (id: string) => void;
  onTrip: (t: Route) => void; onRemoveTrip: (id: string) => void; onReset: () => void;
}) {
  const [tab, setTab] = useState<"visitado" | "wishlist" | "trips">("visitado");
  const { pins, trips } = props;
  const items = pins.filter((p) => p.type === tab);
  const visited = pins.filter((p) => p.type === "visitado").length;
  return (
    <Sheet label="Mis viajes" onClose={props.onClose}>
      <h2>Mis viajes</h2>
      <p className="sub">{visited} VISITADOS · {pins.length - visited} POR IR · {trips.length} RUTAS</p>
      <div className="tabs" role="tablist">
        {([["visitado", "He estado"], ["wishlist", "Quiero ir"], ["trips", "Rutas"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="list">
        {tab === "trips" ? (
          trips.length ? trips.map((t) => (
            <Row key={t.id} q={{ name: t.stops[0]?.name || t.name, wiki: t.stops[0]?.wiki, country: t.stops[0]?.country }} title={t.name}
              sub={`${t.days} días · ${t.stops.map((s) => s.name).join(" → ")}`} onOpen={() => props.onTrip(t)} onRemove={() => props.onRemoveTrip(t.id)} />
          )) : <div className="empty">Aún no has guardado rutas.<br />Sube un vídeo o crea un viaje y pulsa «Guardar en mis viajes».</div>
        ) : items.length ? items.map((p) => (
          <Row key={p.id} q={{ name: p.name }} dot={p.type === "visitado" ? "var(--visited)" : "var(--wishlist)"} title={p.name} sub={coords(p.lat, p.lng)}
            onOpen={() => props.onPin(p)} onRemove={() => props.onRemovePin(p.id)} />
        )) : <div className="empty">{tab === "visitado" ? "Toca el globo donde hayas estado para empezar tu mapa." : "Toca el globo o guarda una ruta para llenar tu lista."}</div>}
      </div>
      <button className="link" type="button" style={{ alignSelf: "center", color: "var(--ink-soft)", fontWeight: 600, fontSize: 12 }}
        onClick={() => { if (confirm("¿Borrar tus lugares y rutas y volver a empezar?")) props.onReset(); }}>Reiniciar todo</button>
    </Sheet>
  );
}

function Row({ q, dot, title, sub, onOpen, onRemove }: { q: { name: string; wiki?: string; country?: string }; dot?: string; title: string; sub: string; onOpen: () => void; onRemove: () => void }) {
  return (
    <div className="item">
      <PlacePhoto className="item-photo" q={q} />
      <button type="button" className="item-main" onClick={onOpen}>
        <b>{dot && <i className="dot" style={{ background: dot }} />}{title}</b><span>{sub}</span>
      </button>
      <button type="button" className="x" aria-label={`Quitar ${title}`} onClick={onRemove}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
