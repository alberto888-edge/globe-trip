"use client";
import { useState } from "react";
import type { BudgetLevel, PlanRequest } from "@/lib/types";
import PlacePhoto from "./PlacePhoto";
import Sheet from "./Sheet";

const DESTINATIONS: { name: string; wiki: string; tag: string }[] = [
  { name: "Japón", wiki: "Japón", tag: "Templos y neón" },
  { name: "Italia", wiki: "Italia", tag: "Arte y pasta" },
  { name: "Tailandia", wiki: "Tailandia", tag: "Playas e islas" },
  { name: "Marruecos", wiki: "Marruecos", tag: "Medinas y desierto" },
  { name: "Perú", wiki: "Machu Picchu", tag: "Andes e incas" },
  { name: "Islandia", wiki: "Islandia", tag: "Glaciares y auroras" },
  { name: "México", wiki: "Chichén Itzá", tag: "Cenotes y tacos" },
  { name: "Grecia", wiki: "Santorini", tag: "Islas blancas" },
  { name: "Portugal", wiki: "Lisboa", tag: "Costa y fado" },
  { name: "Indonesia", wiki: "Bali", tag: "Bali y volcanes" },
  { name: "Noruega", wiki: "Fiordo", tag: "Fiordos" },
  { name: "Nueva York", wiki: "Nueva York", tag: "La gran ciudad" },
];

const THEMES = [
  "Playas paradisíacas", "Montaña y naturaleza", "Ciudades con encanto", "Gastronomía",
  "Aventura", "Escapada romántica", "Cultura e historia", "Mochilero low-cost",
];

const LEVELS: { id: BudgetLevel; label: string; hint: string }[] = [
  { id: "mochilero", label: "Mochilero", hint: "Hostales y transporte público" },
  { id: "medio", label: "Medio", hint: "Hoteles 3★ y algún tour" },
  { id: "alto", label: "Alto", hint: "Hoteles 4-5★ y experiencias" },
];

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

export default function PlannerSheet({ onSubmit, onClose }: { onSubmit: (req: PlanRequest, label: string) => void; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [destination, setDestination] = useState("");
  const [theme, setTheme] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState<BudgetLevel>("medio");
  const [amount, setAmount] = useState("");
  const [origin, setOrigin] = useState("Madrid");

  const canNext = destination.trim().length > 1 || !!theme;
  const label = [destination.trim(), theme].filter(Boolean).join(" · ") || "Tu viaje";

  return (
    <Sheet label="Crea tu viaje" onClose={onClose}>
      <span className="eyebrow">CREA TU VIAJE · PASO {step} DE 2</span>
      {step === 1 ? (
        <>
          <h2>¿A dónde te apetece ir?</h2>
          <label htmlFor="dest" className="sr">Destino</label>
          <input id="dest" className="field" type="text" maxLength={120} placeholder="Escribe un país, ciudad o idea…" value={destination} onChange={(e) => setDestination(e.target.value)} />
          <div className="dest-grid">
            {DESTINATIONS.map((d) => (
              <button key={d.name} type="button" className={`dest ${destination === d.name ? "dest--on" : ""}`} aria-pressed={destination === d.name}
                onClick={() => setDestination(destination === d.name ? "" : d.name)}>
                <PlacePhoto className="dest-photo" q={{ name: d.wiki, wiki: d.wiki }} alt={d.name} />
                <span className="dest-text"><b>{d.name}</b><span>{d.tag}</span></span>
              </button>
            ))}
          </div>
          <span className="eyebrow" style={{ marginTop: 4 }}>O ELIGE UN ESTILO DE VIAJE</span>
          <div className="theme-row">
            {THEMES.map((t) => (
              <button key={t} type="button" className="theme" aria-pressed={theme === t} onClick={() => setTheme(theme === t ? null : t)}>{t}</button>
            ))}
          </div>
          <p className="note">{destination.trim() ? `Destino: ${destination.trim()}` : theme ? "Sin destino: te proponemos uno que encaje." : "Elige un destino, un estilo o los dos."}</p>
          <div className="actions">
            <button className="btn btn-ghost" type="button" onClick={onClose}>Cancelar</button>
            <button className="btn btn-solid" type="button" disabled={!canNext} onClick={() => setStep(2)}>Siguiente</button>
          </div>
        </>
      ) : (
        <>
          <h2>{label}</h2>
          <Stepper id="st-days" label="Días" value={days} min={2} max={30} unit="días" onChange={setDays} />
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
              destination: destination.trim() || undefined, theme: theme || undefined, days, travelers, budget,
              budgetAmount: Number(amount) > 0 ? Number(amount) : undefined, origin: origin.trim() || undefined,
            }, label)}>Crear mi viaje</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
