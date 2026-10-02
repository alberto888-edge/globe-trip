"use client";
// Things to do at a stop: hikes, museums, safaris, events, day trips and nights away.
import { useState } from "react";
import type { ActivitiesRequest, ActivitiesResponse, Activity, ActivityKind, ActivityLength } from "@/lib/types";
import { currentLang, useT } from "@/lib/i18n";
import PlacePhoto from "./PlacePhoto";

const ICON: Record<ActivityKind, string> = {
  evento: "🎉", senderismo: "🥾", montaña: "⛰️", safari: "🦁", museo: "🏛️", cultura: "🎭",
  naturaleza: "🌿", agua: "🌊", aventura: "🪂", gastronomía: "🍽️", excursión: "🚐",
};
const LENGTH: Record<ActivityLength, [string, string]> = {
  horas: ["Unas horas", "A few hours"], "medio día": ["Medio día", "Half day"], "día completo": ["Día completo", "Full day"], "noche fuera": ["Noche fuera", "Overnight"],
};

/** Asks the server for activities, one list per stop. Throws a readable message on failure. */
export async function fetchActivities(req: ActivitiesRequest, signal?: AbortSignal): Promise<Activity[][]> {
  let data: ActivitiesResponse;
  try {
    const res = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal });
    data = await res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new Error(currentLang() === "es" ? "Sin conexión con el servidor. Vuelve a intentarlo." : "Can't reach the server. Please try again.");
  }
  if (!data.ok) throw new Error(data.message);
  return data.activities;
}

export function ActivityCard({ a }: { a: Activity }) {
  const t = useT();
  return (
    <div className={`act ${a.length === "noche fuera" || a.length === "día completo" ? "act--trip" : ""} ${a.fromVideo ? "act--video" : ""}`}>
      {a.wiki
        ? <span className="act-photo"><PlacePhoto q={{ name: a.wiki, wiki: a.wiki }} alt={a.name} /><i aria-hidden="true">{ICON[a.kind]}</i></span>
        : <span className="act-icon" aria-hidden="true">{ICON[a.kind]}</span>}
      <span className="act-text">
        {a.fromVideo && <span className="act-video">📍 {t("Del vídeo", "From the video")}</span>}
        <b>{a.name}</b>
        {a.note && <span>{a.note}</span>}
        <span className="act-meta">
          <em className={`act-len act-len--${a.length.replace(/\s/g, "-")}`}>{t(...LENGTH[a.length])}</em>
          {a.season && <em>📅 {a.season}</em>}
          {a.price && <em>{a.price}</em>}
        </span>
      </span>
    </div>
  );
}

const FILTERS: { id: string; label: [string, string]; test: (a: Activity) => boolean }[] = [
  { id: "all", label: ["Todo", "All"], test: () => true },
  { id: "trips", label: ["🚐 Excursiones", "🚐 Day trips"], test: (a) => a.length === "día completo" || a.length === "noche fuera" },
  { id: "nature", label: ["🥾 Naturaleza", "🥾 Nature"], test: (a) => ["senderismo", "montaña", "safari", "naturaleza", "agua", "aventura"].includes(a.kind) },
  { id: "culture", label: ["🏛️ Cultura", "🏛️ Culture"], test: (a) => ["museo", "cultura", "gastronomía"].includes(a.kind) },
  { id: "events", label: ["🎉 Eventos", "🎉 Events"], test: (a) => a.kind === "evento" },
];

/** Filter chips that only show the filters with something in them. */
export function useActivityFilter(all: Activity[]) {
  const t = useT();
  const [f, setF] = useState("all");
  const avail = FILTERS.filter((x) => x.id === "all" || all.some(x.test));
  const cur = avail.find((x) => x.id === f) ?? FILTERS[0];
  const chips = avail.length > 2 ? (
    <div className="act-filters" role="tablist" aria-label={t("Tipo de actividad", "Type of activity")}>
      {avail.map((x) => <button key={x.id} type="button" role="tab" aria-selected={cur.id === x.id} onClick={() => setF(x.id)}>{t(...x.label)}</button>)}
    </div>
  ) : null;
  return { chips, test: cur.test };
}

export function ActivityList({ list, test = () => true }: { list: Activity[]; test?: (a: Activity) => boolean }) {
  const shown = list.filter(test);
  if (!shown.length) return null;
  return <div className="act-list">{shown.map((a) => <ActivityCard key={a.name} a={a} />)}</div>;
}
