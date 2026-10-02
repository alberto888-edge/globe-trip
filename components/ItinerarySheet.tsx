"use client";
import { useState } from "react";
import type { AnalyzeSources, Route, Stop, TripRisk } from "@/lib/types";
import { officialAdviceUrl, riskLabel } from "@/lib/risk";
import { dayLabels, locale, useLang, useT } from "@/lib/i18n";
import { stopDays } from "@/lib/itinerary";
import { fitInTrip, routeKm } from "@/lib/geo";
import { usePlaceInfo } from "@/lib/wiki";
import type { PlaceLabel } from "@/lib/labels";
import { ActivityList, useActivityFilter } from "./Activities";
import PlacePhoto from "./PlacePhoto";
import PlaceSearch, { FitNotice, fitMessage, type FitMsg } from "./PlaceSearch";
import Sheet from "./Sheet";

/** Where the activities for this route stand. */
export interface ActivitiesState { loading: boolean; error?: string; load: () => void }

const eurIn = (lang: "es" | "en") => (n: number) => n.toLocaleString(locale(lang), { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function Sources({ s }: { s: AnalyzeSources }) {
  const t = useT();
  const list = [
    s.frames ? (s.frames === 1 ? t("1 imagen del vídeo", "1 frame from the video") : t(`${s.frames} imágenes del vídeo`, `${s.frames} frames from the video`)) : null,
    s.caption && t("Descripción", "Caption"), s.placeTag && t("Lugar etiquetado", "Tagged place"), s.subtitles && t("Subtítulos", "Subtitles"), s.audio && "Audio", s.userText && t("Tu texto", "Your text"),
  ].filter(Boolean) as string[];
  if (!list.length) return null;
  return <div className="sources" aria-label={t("Fuentes usadas", "Sources used")}>{list.map((x) => <span key={x}>{x}</span>)}</div>;
}

export function Risks({ r }: { r: TripRisk }) {
  const t = useT();
  const lang = useLang();
  return (
    <section className={`risks risk-${r.level}`} aria-label={t("Riesgos del viaje", "Travel risks")}>
      <div className="risks-head">
        <span className="eyebrow">{t("RIESGOS DEL VIAJE", "TRAVEL RISKS")}</span>
        <span className="risk-badge">{riskLabel(r.level, lang)}</span>
      </div>
      <p>{r.summary}</p>
      {r.points.length > 0 && <ul>{r.points.map((p) => <li key={p}>{p}</li>)}</ul>}
      <div className="risks-links">
        {r.countries.slice(0, 4).map((c) => (
          <a key={c} href={officialAdviceUrl(c, lang)} target="_blank" rel="noopener noreferrer">{t("Exteriores", "Travel advice")}: {c} ↗</a>
        ))}
      </div>
      <small>{t("Orientativo. Antes de reservar, consulta las recomendaciones oficiales y regístrate en el Registro de Viajeros.", "A guide only. Before booking, check your government's official travel advice.")}</small>
    </section>
  );
}

function Day({ s, i, when, last, onShow, onRemove, test }: { s: Stop; i: number; when: string; last: boolean; onShow: () => void; onRemove?: () => void; test: (a: NonNullable<Stop["activities"]>[number]) => boolean }) {
  const t = useT();
  const { info } = usePlaceInfo({ name: s.name, wiki: s.wiki, country: s.country, lat: s.lat, lng: s.lng });
  return (
    <div className="day">
      <div className="track"><span className="node">{i + 1}</span>{!last && <span className="line" />}</div>
      <div className="day-body">
        <em>{when.toUpperCase()}{s.added && <span className="day-added"> · {t("AÑADIDO POR TI", "ADDED BY YOU")}</span>}</em>
        <b>{s.name}{s.country && <small className="day-country"> · {s.country}</small>}</b>
        {s.note && <p>{s.note}</p>}
        {info?.image && <PlacePhoto className="day-photo" src={info.imageLarge || info.image} alt={s.name} />}
        {info?.extract && <p className="day-extract">{info.extract.length > 220 ? info.extract.slice(0, 220).replace(/\s\S*$/, "") + "…" : info.extract}</p>}
        {s.activities && s.activities.length > 0 && <ActivityList list={s.activities} test={test} />}
        <div className="day-links">
          <button type="button" onClick={onShow}>{t("Ver en el globo", "Show on the globe")}</button>
          {info?.url && <a href={info.url} target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>}
          {onRemove && <button type="button" className="day-remove" onClick={onRemove}>{t("Quitar parada", "Remove stop")}</button>}
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
  const t = useT();
  const lang = useLang();
  const eur = eurIn(lang);
  const when = dayLabels(route.stops.map(stopDays), lang);
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
    if (route.stops.some((s) => s.name.toLowerCase() === p.name.toLowerCase())) { setNotice({ tone: "info", text: t(`${p.name} ya está en la ruta.`, `${p.name} is already in the route.`) }); return; }
    const f = fitInTrip(route.stops, p);
    const from = route.stops[f.nearest]?.name || t("tu ruta", "your route");
    if (f.fit === "tooFar" && !force) { setNotice({ ...fitMessage(f.fit, p.name, f.km, from, t)!, place: p }); return; }
    onAddStop(p);
    setNotice(fitMessage(f.fit === "tooFar" ? "far" : f.fit, p.name, f.km, from, t) ?? { tone: "info", text: t(`${p.name} añadido a la ruta, donde menos rodeo supone.`, `${p.name} added to the route where it adds the least detour.`) });
  };
  return (
    <Sheet label={route.name} onClose={onClose}>
      {first && <PlacePhoto className="hero-photo" large q={{ name: first.name, wiki: first.wiki, country: first.country, lat: first.lat, lng: first.lng }} />}
      <span className="eyebrow">{route.kind === "plan" ? t("TU VIAJE A MEDIDA", "YOUR TAILOR-MADE TRIP") : route.kind === "ready" ? t("VIAJE LISTO", "READY-MADE TRIP") : route.kind === "demo" ? t("RUTA DE EJEMPLO", "SAMPLE ROUTE") : t("RUTA DE TU VÍDEO", "ROUTE FROM YOUR VIDEO")}</span>
      <h2>{route.name}</h2>
      <p className="sub">{route.days} {t("DÍAS", "DAYS")} · {route.stops.length} {t("PARADAS", "STOPS")} · {Math.round(routeKm(route.stops)).toLocaleString(locale(lang))} KM</p>
      {route.summary && <p className="note">{route.summary}</p>}
      {route.sources && <Sources s={route.sources} />}
      {route.risks && route.risks.level >= 3 && <Risks r={route.risks} />}

      {route.budget && (
        <section className="budget" aria-label={t("Presupuesto", "Budget")}>
          <div className="budget-head">
            <div><span className="eyebrow">{t("PRESUPUESTO ESTIMADO", "ESTIMATED BUDGET")}</span><b>{eur(route.budget.total)}</b></div>
            {route.budget.perPerson !== undefined && <span className="budget-pp">{eur(route.budget.perPerson)} / {t("persona", "person")}</span>}
          </div>
          {route.budget.breakdown.map((b) => (
            <div className="budget-row" key={b.label}>
              <span>{b.label}</span>
              <i style={{ width: `${Math.max(4, (b.amount / max) * 100)}%` }} />
              <b>{eur(b.amount)}</b>
            </div>
          ))}
          {route.budget.note && <p className="budget-note">{route.budget.note}</p>}
          {route.edited && <p className="budget-note">{t("Calculado antes de cambiar las paradas: tómalo como referencia.", "Worked out before the stops changed: take it as a guide.")}</p>}
        </section>
      )}

      <section className="acts-head" aria-label={t("Actividades", "Activities")}>
        <div className="acts-title">
          <span className="eyebrow">{t("QUÉ HACER · EVENTOS, RUTAS Y EXCURSIONES", "THINGS TO DO · EVENTS, HIKES AND DAY TRIPS")}</span>
          {all.length > 0 && missing === 0 && <small>{t(`${all.length} planes recomendados en ${route.stops.length} paradas`, `${all.length} ideas across ${route.stops.length} stops`)}</small>}
        </div>
        {filter.chips}
        {missing > 0 && (
          <button className="btn btn-ghost acts-btn" type="button" disabled={activities.loading} onClick={activities.load}>
            {activities.loading ? <><i className="spin" aria-hidden="true" />{t("Buscando planes en cada parada…", "Finding things to do at each stop…")}</>
              : all.length ? (missing === 1 ? t("✨ Recomendar planes para la parada nueva", "✨ Suggest things to do at the new stop") : t(`✨ Recomendar planes para las ${missing} paradas nuevas`, `✨ Suggest things to do at the ${missing} new stops`))
              : t("✨ Recomiéndame actividades: hikes, museos, safaris, excursiones…", "✨ Suggest activities: hikes, museums, safaris, day trips…")}
          </button>
        )}
        {activities.error && !activities.loading && <p className="budget-note">{activities.error}</p>}
      </section>

      <div className="timeline">
        {route.stops.map((s, i) => (
          <Day key={`${s.name}-${i}`} s={s} i={i} when={when[i]} last={i === route.stops.length - 1} test={filter.test} onShow={() => onShow(s)}
            onRemove={route.stops.length > 2 ? () => onRemoveStop(i) : undefined} />
        ))}
      </div>

      <div className="addstop">
        {adding
          ? <PlaceSearch id="addstop" autoFocus placeholder={t("¿Qué sitio quieres sumar a la ruta?", "Which place do you want to add?")} onPick={(p) => add(p)} />
          : <button type="button" className="must-add" onClick={() => { setAdding(true); setNotice(null); }}>{t("+ Añadir destino a la ruta", "+ Add a place to the route")}</button>}
        {notice && <FitNotice msg={notice} onClose={() => setNotice(null)} onAdd={notice.place ? () => { const p = notice.place!; setNotice(null); add(p, true); } : undefined} />}
      </div>

      {route.tips?.length ? (
        <section className="tips"><span className="eyebrow">{t("CONSEJOS", "TIPS")}</span><ul>{route.tips.map((x) => <li key={x}>{x}</li>)}</ul></section>
      ) : null}
      {route.risks && route.risks.level < 3 && <Risks r={route.risks} />}
      {onAdapt && (
        <button className="btn btn-ghost adapt" type="button" onClick={onAdapt}>
          {route.kind === "ready" ? t("Adaptar este viaje a mí (días, estilo, presupuesto)", "Make this trip mine (days, style, budget)") : t("Cambiar días, estilo o presupuesto", "Change days, style or budget")}
        </button>
      )}
      {route.source && <a className="link" href={route.source} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start", textDecoration: "none" }}>{t("Abrir el vídeo original ↗", "Open the original video ↗")}</a>}
      <div className="actions">
        <button className="btn btn-ghost" type="button" onClick={onShare}>{t("Compartir", "Share")}</button>
        <button className="btn btn-solid" type="button" disabled={saved} onClick={onSave}>{saved ? t("Guardada ✓", "Saved ✓") : t("Guardar en mis viajes", "Save to my trips")}</button>
      </div>
    </Sheet>
  );
}
