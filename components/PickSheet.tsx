"use client";
import { useState } from "react";
import type { AnalyzeOk, Candidate } from "@/lib/types";
import PlacePhoto from "./PlacePhoto";
import Sheet from "./Sheet";

/** After a video is analysed: "which of these places did you like?" */
export default function PickSheet({ result, onConfirm, onClose }: { result: AnalyzeOk; onConfirm: (picked: Candidate[]) => void; onClose: () => void }) {
  const [on, setOn] = useState<boolean[]>(() => result.candidates.map(() => true));
  const n = on.filter(Boolean).length;
  const all = n === on.length;
  const toggle = (i: number) => setOn((a) => a.map((v, j) => (j === i ? !v : v)));

  return (
    <Sheet label="Elige los lugares" onClose={onClose}>
      <span className="eyebrow">{result.candidates.length} LUGARES EN EL VÍDEO</span>
      <h2>¿Cuáles te han gustado?</h2>
      <p className="note">Marca los que quieras en tu ruta. Los demás no se guardan.</p>
      <div className="pick-grid">
        {result.candidates.map((c, i) => (
          <button key={i} type="button" className={`pick ${on[i] ? "pick--on" : ""}`} aria-pressed={on[i]} onClick={() => toggle(i)}>
            <PlacePhoto className="pick-photo" q={{ name: c.name, wiki: c.wiki, country: c.country }} src={c.frame !== undefined ? result.frames[c.frame] : undefined} />
            <span className="pick-check" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </span>
            <span className="pick-text">
              <b>{c.name}</b>
              <span>{[c.country, c.sub].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setOn(on.map(() => !all))}>
        {all ? "Quitar todos" : "Marcar todos"}
      </button>
      <div className="actions">
        <button className="btn btn-ghost" type="button" onClick={onClose}>Cancelar</button>
        <button className="btn btn-solid" type="button" disabled={!n} onClick={() => onConfirm(result.candidates.filter((_, i) => on[i]))}>
          {n ? `Crear ruta con ${n}` : "Elige al menos uno"}
        </button>
      </div>
    </Sheet>
  );
}
