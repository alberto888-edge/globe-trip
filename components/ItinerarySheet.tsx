"use client";
import { useState } from "react";
import type { AnalyzeSources, Route, Stop, TripRisk } from "@/lib/types";
import { officialAdviceUrl, RISK_LABEL } from "@/lib/risk";
import { fitInTrip, routeKm } from "@/lib/geo";
import { usePlaceInfo } from "@/lib/wiki";
import type { PlaceLabel } from "@/lib/labels";
import { ActivityList, useActivityFilter } from "./Activities";
import PlacePhoto from "./PlacePhoto";
import PlaceSearch, { FitNotice, fitMessage, type FitMsg } from "./PlaceSearch";
import Sheet from "./Sheet";

/** Where the activities for this route stand. */
export interface ActivitiesState { loading: boolean; error?: string; load: () => void }

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function Sources({ s }: { s: AnalyzeSources }) {
  const list = [
    s.frames ? `${s.frames} ${s.frames === 1 ? "imagen" : "imágenes"} del vídeo` : null,
    s.caption && "Descripción", s.placeTag && "Lugar etiquetado", s.subtitles && "Subtítulos", s.audio && "Audio", s.userText && "Tu texto",
  ].filter(Boolean) as string[];
  if (!list.length) return null;
  return <div className="sources" aria-label="Fuentes usadas">{list.map((x) => <span key={x}>{x}</span>)}</div>;
}

export function Risks({ r }: { r: TripRisk }) {
  return (
    <section className={`risks risk-${r.level}`} aria-label="Riesgos del viaje">
      <div className="risks-head">
        <span className="eyebrow">RIESGOS DEL VIAJE</span>
        <span className="risk-badge">{RISK_LABEL[r.level]}</span>
      </div>
      <p>{r.summary}</p>
      {r.points.length > 0 && <ul>{r.points.map((p) => <li key={p}>{p}</li>)}</ul>}
      <div className="risks-links">
        {r.countries.slice(0, 4).map((c) => (
          <a key={c} href={officialAdviceUrl(c)} target="_blank" rel="noopener noreferrer">Exteriores: {c} ↗</a>
        ))}
      </div>
      <small>Orientativo. Antes de reservar, consulta las recomendaciones oficiales y regístrate en el Registro de Viajeros.</small>
    </section>
  );
}

function Day({ s, i, last, onShow, onRemove, test }: { s: Stop; i: number; last: boolean; onShow: () => void; onRemove?: () => void; test: (a: NonNullable<Stop["activities"]>[number]) => boolean }) {
  const { info } = usePlaceInfo({ name: s.name, wiki: s.wiki, country: s.country });
  return (
    <div className="day">
      <div className="track"><span className="node">{i + 1}</span>{!last && <span className="line" />}</div>
      <div className="day-body">
        <em>{s.when.toUpperCase()}{s.added && <span className="day-added"> · AÑADIDO POR TI</span>}</em>
        <b>{s.name}{s.country && <small className="day-country"> · {s.country}</small>}</b>
        {s.note && <p>{s.note}</p>}
        {info?.image && <PlacePhoto className="day-photo" src={info.imageLarge || info.image} alt={s.name} />}
        {info?.extract && <p className="day-extract">{info.extract.length > 220 ? info.extract.slice(0, 220).replace(/\s\S*$/, "") + "…" : info.extract}</p>}
        {s.activities && s.activities.length > 0 && <ActivityList list={s.activities} test={test} />}
        <div className="day-links">
          <button type="button" onClick={onShow}>Ver en el globo</button>
          {info?.url && <a href={info.url} target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>}
          {onRemove && <button type="button" className="day-remove" onClick={onRemove}>Quitar parada</button>}
        </div>
      </div>
    </div>
  );
}

export default function ItinerarySheet({ route, saved, activities, onClose, onShow, onSave, onShare, onAdapt, onAddStop, onRemoveStop }: {
  route: Route; saved: boolean; activities: ActivitiesState;
  onClose: () => void; onShow: (s: Stop) => void; onSave: () => void; onShare: () => void; onAdapt?: () => void;
  onAddStop: (p: PlaceLabel) => void; onRemoveStop: (index: number) => void;
}) {
  const max = route.budget ? Math.max(...route.budget.breakdown.map((b) => b.amount), 1) : 1;
  const first = route.stops[0];
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<FitMsg | null>(null);
  const all = route.stops.flatMap((s) => s.activities || []);
  const missing = route.stops.filter((s) => !s.activities?.length).length;
  const filter = useActivityFilter(all);

  /** Adds the place where it fits best; if it's really another trip, asks first. */
  const add = (p: PlaceLabel, force = false) => {
    setAdding(false);
    if (route.stops.some((s) => s.name.toLowerCase() === p.name.toLowerCase())) { setNotice({ tone: "info", text: `${p.name} ya está en la ruta.` }); return; }
    const f = fitInTrip(route.stops, p);
    const from = route.stops[f.nearest]?.name || "tu ruta";
    if (f.fit === "tooFar" && !force) { setNotice({ ...fitMessage(f.fit, p.name, f.km, from)!, place: p }); return; }
    onAddStop(p);
    setNotice(fitMessage(f.fit === "tooFar" ? "far" : f.fit, p.name, f.km, from) ?? { tone: "info", text: `${p.name} añadido a la ruta, donde menos rodeo supone.` });
  };
  return (
    <Sheet label={route.name} onClose={onClose}>
      {first && <PlacePhoto className="hero-photo" large q={{ name: first.name, wiki: first.wiki, country: first.country }} />}
      <span className="eyebrow">{route.kind === "plan" ? "TU VIAJE A MEDIDA" : route.kind === "ready" ? "VIAJE LISTO" : route.kind === "demo" ? "RUTA DE EJEMPLO" : "RUTA DE TU VÍDEO"}</span>
      <h2>{route.name}</h2>
      <p className="sub">{route.days} DÍAS · {route.stops.length} PARADAS · {Math.round(routeKm(route.stops)).toLocaleString("es-ES")} KM</p>
      {route.summary && <p className="note">{route.summary}</p>}
      {route.sources && <Sources s={route.sources} />}
      {route.risks && route.risks.level >= 3 && <Risks r={route.risks} />}

      {route.budget && (
        <section className="budget" aria-label="Presupuesto">
          <div className="budget-head">
            <div><span className="eyebrow">PRESUPUESTO ESTIMADO</span><b>{eur(route.budget.total)}</b></div>
            {route.budget.perPerson !== undefined && <span className="budget-pp">{eur(route.budget.perPerson)} / persona</span>}
          </div>
          {route.budget.breakdown.map((b) => (
            <div className="budget-row" key={b.label}>
              <span>{b.label}</span>
              <i style={{ width: `${Math.max(4, (b.amount / max) * 100)}%` }} />
              <b>{eur(b.amount)}</b>
            </div>
          ))}
          {route.budget.note && <p className="budget-note">{route.budget.note}</p>}
          {route.edited && <p className="budget-note">Calculado antes de cambiar las paradas: tómalo como referencia.</p>}
        </section>
      )}

      <section className="acts-head" aria-label="Actividades">
        <div className="acts-title">
          <span className="eyebrow">QUÉ HACER · EVENTOS, RUTAS Y EXCURSIONES</span>
          {all.length > 0 && missing === 0 && <small>{all.length} planes recomendados en {route.stops.length} paradas</small>}
        </div>
        {filter.chips}
        {missing > 0 && (
          <button className="btn btn-ghost acts-btn" type="button" disabled={activities.loading} onClick={activities.load}>
            {activities.loading ? <><i className="spin" aria-hidden="true" />Buscando planes en cada parada…</>
              : all.length ? `✨ Recomendar planes para ${missing === 1 ? "la parada nueva" : `las ${missing} paradas nuevas`}`
              : "✨ Recomiéndame actividades: hikes, museos, safaris, excursiones…"}
          </button>
        )}
        {activities.error && !activities.loading && <p className="budget-note">{activities.error}</p>}
      </section>

      <div className="timeline">
        {route.stops.map((s, i) => (
          <Day key={`${s.name}-${i}`} s={s} i={i} last={i === route.stops.length - 1} test={filter.test} onShow={() => onShow(s)}
            onRemove={route.stops.length > 2 ? () => onRemoveStop(i) : undefined} />
        ))}
      </div>

      <div className="addstop">
        {adding
          ? <PlaceSearch id="addstop" autoFocus placeholder="¿Qué sitio quieres sumar a la ruta?" onPick={(p) => add(p)} />
          : <button type="button" className="must-add" onClick={() => { setAdding(true); setNotice(null); }}>+ Añadir destino a la ruta</button>}
        {notice && <FitNotice msg={notice} onClose={() => setNotice(null)} onAdd={notice.place ? () => { const p = notice.place!; setNotice(null); add(p, true); } : undefined} />}
      </div>

      {route.tips?.length ? (
        <section className="tips"><span className="eyebrow">CONSEJOS</span><ul>{route.tips.map((t) => <li key={t}>{t}</li>)}</ul></section>
      ) : null}
      {route.risks && route.risks.level < 3 && <Risks r={route.risks} />}
      {onAdapt && (
        <button className="btn btn-ghost adapt" type="button" onClick={onAdapt}>
          {route.kind === "ready" ? "Adaptar este viaje a mí (días, estilo, presupuesto)" : "Cambiar días, estilo o presupuesto"}
        </button>
      )}
      {route.source && <a className="link" href={route.source} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", textDecoration: "none" }}>Abrir el vídeo original ↗</a>}
      <div className="actions">
        <button className="btn btn-ghost" type="button" onClick={onShare}>Compartir</button>
        <button className="btn btn-solid" type="button" disabled={saved} onClick={onSave}>{saved ? "Guardada ✓" : "Guardar en mis viajes"}</button>
      </div>
    </Sheet>
  );
}
