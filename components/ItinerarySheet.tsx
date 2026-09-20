"use client";
import type { AnalyzeSources, Route, Stop, TripRisk } from "@/lib/types";
import { officialAdviceUrl, RISK_LABEL } from "@/lib/risk";
import { routeKm } from "@/lib/geo";
import { usePlaceInfo } from "@/lib/wiki";
import PlacePhoto from "./PlacePhoto";
import Sheet from "./Sheet";

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

function Day({ s, i, last, onShow }: { s: Stop; i: number; last: boolean; onShow: () => void }) {
  const { info } = usePlaceInfo({ name: s.name, wiki: s.wiki, country: s.country });
  return (
    <div className="day">
      <div className="track"><span className="node">{i + 1}</span>{!last && <span className="line" />}</div>
      <div className="day-body">
        <em>{s.when.toUpperCase()}</em>
        <b>{s.name}{s.country && <small className="day-country"> · {s.country}</small>}</b>
        {s.note && <p>{s.note}</p>}
        {info?.image && <PlacePhoto className="day-photo" src={info.imageLarge || info.image} alt={s.name} />}
        {info?.extract && <p className="day-extract">{info.extract.length > 220 ? info.extract.slice(0, 220).replace(/\s\S*$/, "") + "…" : info.extract}</p>}
        <div className="day-links">
          <button type="button" onClick={onShow}>Ver en el globo</button>
          {info?.url && <a href={info.url} target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>}
        </div>
      </div>
    </div>
  );
}

export default function ItinerarySheet({ route, saved, onClose, onShow, onSave, onShare, onAdapt }: {
  route: Route; saved: boolean; onClose: () => void; onShow: (s: Stop) => void; onSave: () => void; onShare: () => void; onAdapt?: () => void;
}) {
  const max = route.budget ? Math.max(...route.budget.breakdown.map((b) => b.amount), 1) : 1;
  const first = route.stops[0];
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
        </section>
      )}

      <div className="timeline">
        {route.stops.map((s, i) => <Day key={i} s={s} i={i} last={i === route.stops.length - 1} onShow={() => onShow(s)} />)}
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
