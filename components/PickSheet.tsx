"use client";
import { useState } from "react";
import type { AnalyzeOk, Candidate } from "@/lib/types";
import PlacePhoto from "./PlacePhoto";
import { useT } from "@/lib/i18n";
import Sheet from "./Sheet";

/** After a video is analysed: "which of these places did you like?" */
export default function PickSheet({ result, onConfirm, onClose }: { result: AnalyzeOk; onConfirm: (picked: Candidate[]) => void; onClose: () => void }) {
  const t = useT();
  const [on, setOn] = useState<boolean[]>(() => result.candidates.map(() => true));
  const n = on.filter(Boolean).length;
  const all = n === on.length;
  const toggle = (i: number) => setOn((a) => a.map((v, j) => (j === i ? !v : v)));

  return (
    <Sheet label={t("Elige los lugares", "Pick the places")} onClose={onClose}>
      <span className="eyebrow">{result.candidates.length} {t("LUGARES EN EL VÍDEO", "PLACES IN THE VIDEO")}</span>
      <h2>{t("¿Cuáles te han gustado?", "Which ones do you like?")}</h2>
      <p className="note">{t("Marca los que quieras en tu ruta. Los demás no se guardan.", "Tick the ones you want in your route. The rest aren't kept.")}</p>
      <div className="pick-grid">
        {result.candidates.map((c, i) => (
          <button key={i} type="button" className={`pick ${on[i] ? "pick--on" : ""}`} aria-pressed={on[i]} onClick={() => toggle(i)}>
            <PlacePhoto className="pick-photo" q={{ name: c.name, wiki: c.wiki, country: c.country, lat: c.lat, lng: c.lng }} src={c.frame !== undefined ? result.frames[c.frame] : undefined} />
            <span className="pick-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <span className="pick-text">
              <b>{c.name}</b>
              <span>{c.spots?.length ? [c.country, `📍 ${c.spots.map((x) => x.name).join(", ")}`].filter(Boolean).join(" · ") : [c.country, c.sub].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setOn(on.map(() => !all))}>
        {all ? t("Quitar todos", "Untick all") : t("Marcar todos", "Tick all")}
      </button>
      <div className="actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>{t("Cancelar", "Cancel")}</button>
        <button className="btn btn-solid" type="button" disabled={!n} onClick={() => onConfirm(result.candidates.filter((_, i) => on[i]))}>
          {n ? t(`Crear ruta con ${n}`, `Make a route with ${n}`) : t("Elige al menos uno", "Pick at least one")}
        </button>
      </div>
    </Sheet>
  );
}
