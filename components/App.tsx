"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzeResponse, AnalyzeSources, Pin, PinType, Route } from "@/lib/types";
import { DEMO_ROUTES, EXAMPLES, SEED_PINS } from "@/lib/demo";
import { frame, routeKm } from "@/lib/geo";
import { detectPlatform, toUrl } from "@/lib/links";
import { usePersistentState } from "@/lib/storage";
import type { Focus } from "./GlobeCanvas";
import Sheet from "./Sheet";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), { ssr: false });

type SheetState =
  | { kind: "add"; lat: number; lng: number }
  | { kind: "pin"; id: string }
  | { kind: "itinerary" }
  | { kind: "trips" }
  | { kind: "describe"; url: string; message: string }
  | null;

interface Analysis { label: string; step: number; cancellable: boolean }

const STEPS = ["Leyendo el vídeo", "Detectando lugares", "Ordenando la ruta y los días"];
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
  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // spread = degrees of arc that must fit on screen (≈ 1° per 111 km)
  const flyTo = useCallback((lat: number, lng: number, spread: number, ms?: number) => {
    setFocus({ lat, lng, spread, ms, key: Date.now() });
  }, []);
  const flyHome = useCallback(() => setFocus({ lat: 28, lng: 8, home: true, key: Date.now() }), []);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const showRoute = useCallback((r: Route, animate = true) => {
    clearTimers();
    setRoute(r);
    const { center, spread } = frame(r.stops);
    flyTo(center.lat, center.lng, spread, animate ? 1800 : 0);
    if (!animate) { setRevealed(r.stops.length); return; }
    setRevealed(0);
    // Reveal stops one by one once the camera has mostly arrived.
    r.stops.forEach((_, i) => timers.current.push(setTimeout(() => setRevealed(i + 1), 1100 + i * 700)));
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
    if (route) showRoute(route, false);
  }, [globeReady, routeLoaded, route, showRoute]);

  useEffect(() => () => { clearTimers(); abortRef.current?.abort(); }, []);

  // ---------- analysis ----------
  const startAnalysis = (label: string, cancellable: boolean) => {
    clearTimers();
    setAnalysis({ label, step: 0, cancellable });
    timers.current.push(setTimeout(() => setAnalysis((a) => (a ? { ...a, step: 1 } : a)), 1200));
    timers.current.push(setTimeout(() => setAnalysis((a) => (a ? { ...a, step: 2 } : a)), 4200));
  };

  const runDemo = (routeId: string) => {
    const base = DEMO_ROUTES.find((r) => r.id === routeId);
    if (!base) return;
    startAnalysis(`Ejemplo · ${base.name}`, false);
    timers.current.push(setTimeout(() => setAnalysis((a) => (a ? { ...a, step: 1 } : a)), 700));
    timers.current.push(setTimeout(() => setAnalysis((a) => (a ? { ...a, step: 2 } : a)), 1400));
    timers.current.push(setTimeout(() => {
      setAnalysis(null);
      showRoute({ ...base, id: `${base.id}-${uid()}` });
      say(`${base.stops.length} lugares · ${base.name}`);
    }, 2100));
  };

  const analyze = async (payload: { url?: string; text?: string }) => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    startAnalysis(payload.url || `«${payload.text!.slice(0, 60)}${payload.text!.length > 60 ? "…" : ""}»`, true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctl.signal,
      });
      let data: AnalyzeResponse;
      try { data = await res.json(); } catch { data = { ok: false, code: "upstream", message: "El servidor no ha respondido bien." }; }
      clearTimers();
      setAnalysis(null);
      if (data.ok) {
        setInput("");
        showRoute(data.route);
        const n = data.route.stops.length;
        say(`${n} ${n === 1 ? "lugar detectado" : "lugares detectados"} · ${data.route.name}`);
      } else if (data.code === "need_text" && payload.url) {
        setSheet({ kind: "describe", url: payload.url, message: data.message });
      } else {
        say(data.message);
      }
    } catch (e: any) {
      clearTimers();
      setAnalysis(null);
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
    if (!route) return;
    if (trips.some((t) => t.id === route.id)) return;
    setTrips((t) => [route, ...t]);
    const fresh: Pin[] = route.stops
      .filter((s) => !pins.some((p) => p.name.toLowerCase() === s.name.toLowerCase()))
      .map((s) => ({ id: uid(), name: s.name, lat: s.lat, lng: s.lng, type: "wishlist" }));
    if (fresh.length) setPins((list) => [...list, ...fresh]);
    say(`Ruta guardada${fresh.length ? ` · ${fresh.length} lugares a «Quiero ir»` : ""}`);
  };

  const shareRoute = async () => {
    if (!route) return;
    const text = `${route.name} (${route.days} días)\n` + route.stops.map((s, i) => `${i + 1}. ${s.name} — ${s.when}`).join("\n");
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
      <svg className="watermark" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" fill="none" strokeWidth="1.2" aria-hidden="true">
        <circle cx="200" cy="330" r="250" />
        <ellipse cx="200" cy="330" rx="250" ry="90" />
        <ellipse cx="200" cy="330" rx="250" ry="175" />
        <ellipse cx="200" cy="330" rx="90" ry="250" />
        <ellipse cx="200" cy="330" rx="175" ry="250" />
        <path d="M200 60v540M-50 330h500" />
        <g transform="translate(330,700)"><circle r="34" /><path d="M0-46L6-6L46 0L6 6L0 46L-6 6L-46 0L-6-6Z" /></g>
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
            {STEPS.map((s, i) => (
              <div key={s} className={`step ${i < analysis.step ? "done" : i === analysis.step ? "active" : ""}`}><i />{s}</div>
            ))}
          </section>
        )}

        {route && !analysis && (
          <section className="routecard glass" aria-live="polite">
            <div className="routecard-head">
              <div>
                <div className="routecard-title">{route.name}{route.ai && <span className="tag">IA</span>}</div>
                <div className="routecard-meta mono">{route.days} DÍAS · {route.stops.length} PARADAS · {Math.round(routeKm(route.stops)).toLocaleString("es-ES")} KM</div>
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
                  <em>{i + 1} · {s.when.toUpperCase()}</em><b>{s.name}</b><span>{s.sub}</span>
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

        {!route && !analysis && (
          <div className="examples">
            <span>Prueba:</span>
            {EXAMPLES.map((ex) => <button key={ex.routeId} type="button" onClick={() => runDemo(ex.routeId)}>{ex.label}</button>)}
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
          <Sheet label={p.name} onClose={() => setSheet(null)}>
            <span className="eyebrow">{p.type === "visitado" ? "HE ESTADO" : "QUIERO IR"}</span>
            <h2>{p.name}</h2>
            <p className="sub">{coords(p.lat, p.lng)}</p>
            <div className="actions">
              <button className="btn btn-ghost" type="button" onClick={() => { togglePin(p.id); setSheet(null); say(p.type === "visitado" ? `${p.name} movido a «Quiero ir»` : `¡${p.name} visitado!`); }}>
                {p.type === "visitado" ? "Mover a Quiero ir" : "Ya he estado"}
              </button>
              <button className="btn btn-danger" type="button" onClick={() => { removePin(p.id); setSheet(null); }}>Quitar</button>
            </div>
          </Sheet>
        );
      })()}

      {sheet?.kind === "describe" && (
        <DescribeSheet url={sheet.url} message={sheet.message} onClose={() => setSheet(null)}
          onSubmit={(text) => { setSheet(null); analyze({ url: sheet.url, text }); }} />
      )}

      {sheet?.kind === "itinerary" && route && (
        <Sheet label={route.name} onClose={() => setSheet(null)}>
          <span className="eyebrow">{route.ai ? "RUTA DETECTADA EN TU VÍDEO" : "RUTA DE EJEMPLO"}</span>
          <h2>{route.name}</h2>
          <p className="sub">{route.days} DÍAS · {route.stops.length} PARADAS · {Math.round(routeKm(route.stops)).toLocaleString("es-ES")} KM</p>
          {route.sources && <Sources s={route.sources} />}
          <div className="timeline">
            {route.stops.map((s, i) => (
              <div className="day" key={i}>
                <div className="track"><span className="node">{i + 1}</span>{i < route.stops.length - 1 && <span className="line" />}</div>
                <div className="day-body">
                  <em>{s.when.toUpperCase()}</em>
                  <b>{s.name}</b>
                  {s.note && <p>{s.note}</p>}
                  <button type="button" onClick={() => { setSheet(null); flyTo(s.lat, s.lng, 1.2); }}>Ver en el globo</button>
                </div>
              </div>
            ))}
          </div>
          {route.source && <a className="link" href={route.source} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", textDecoration: "none" }}>Abrir el vídeo original ↗</a>}
          <div className="actions">
            <button className="btn btn-ghost" type="button" onClick={shareRoute}>Compartir</button>
            <button className="btn btn-solid" type="button" disabled={saved} onClick={saveTrip}>{saved ? "Guardada ✓" : "Guardar en mis viajes"}</button>
          </div>
        </Sheet>
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

function Sources({ s }: { s: AnalyzeSources }) {
  const list = [s.caption && "Descripción", s.placeTag && "Lugar etiquetado", s.subtitles && "Subtítulos", s.audio && "Audio", s.userText && "Tu texto"].filter(Boolean);
  if (!list.length) return null;
  return <div className="sources" aria-label="Fuentes usadas">{list.map((x) => <span key={x as string}>{x}</span>)}</div>;
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

function DescribeSheet({ url, message, onClose, onSubmit }: { url: string; message: string; onClose: () => void; onSubmit: (t: string) => void }) {
  const [text, setText] = useState("");
  return (
    <Sheet label="Describe el vídeo" onClose={onClose}>
      <span className="eyebrow mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
      <h2>¿Qué sale en el vídeo?</h2>
      <p className="note">{message}</p>
      <label htmlFor="desc" className="sr">Descripción del vídeo</label>
      <textarea id="desc" className="field" maxLength={4000} autoFocus value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Ej.: 10 días en Japón. Empezamos en Tokio (Shibuya, Asakusa), subimos al Fuji desde Hakone, 3 días en Kioto, Nara de excursión y terminamos en Osaka…" />
      <div className="actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn btn-solid" type="button" disabled={text.trim().length < 12} onClick={() => onSubmit(text.trim())}>Crear ruta</button>
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
            <Row key={t.id} color="var(--route)" title={t.name} sub={`${t.days} días · ${t.stops.map((s) => s.name).join(" → ")}`}
              onOpen={() => props.onTrip(t)} onRemove={() => props.onRemoveTrip(t.id)} />
          )) : <div className="empty">Aún no has guardado rutas.<br />Sube un vídeo y pulsa «Guardar en mis viajes».</div>
        ) : items.length ? items.map((p) => (
          <Row key={p.id} color={p.type === "visitado" ? "var(--visited)" : "var(--wishlist)"} title={p.name} sub={coords(p.lat, p.lng)}
            onOpen={() => props.onPin(p)} onRemove={() => props.onRemovePin(p.id)} />
        )) : <div className="empty">{tab === "visitado" ? "Toca el globo donde hayas estado para empezar tu mapa." : "Toca el globo o guarda una ruta para llenar tu lista."}</div>}
      </div>
      <button className="link" type="button" style={{ alignSelf: "center", color: "var(--ink-soft)", fontWeight: 600, fontSize: 12 }}
        onClick={() => { if (confirm("¿Borrar tus lugares y rutas y volver a empezar?")) props.onReset(); }}>Reiniciar todo</button>
    </Sheet>
  );
}

function Row({ color, title, sub, onOpen, onRemove }: { color: string; title: string; sub: string; onOpen: () => void; onRemove: () => void }) {
  return (
    <div className="item">
      <i className="dot" style={{ background: color, width: 10, height: 10, margin: 0 }} />
      <button type="button" className="item-main" onClick={onOpen}><b>{title}</b><span>{sub}</span></button>
      <button type="button" className="x" aria-label={`Quitar ${title}`} onClick={onRemove}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
