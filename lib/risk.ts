// Travel-risk helpers shared by the server (to validate what Claude says) and the app (to show it).
import type { TripRisk } from "./types";

export const RISK_LABEL: Record<TripRisk["level"], string> = {
  1: "Riesgo bajo",
  2: "Precaución",
  3: "Evita algunas zonas",
  4: "No viajar",
};

// Countries where Spain's Foreign Office advises against all travel. A floor for the
// level Claude gives, because its knowledge may lag behind the news. Checked for
// Siria on 20 Sep 2026 ("Se recomienda NO viajar a Siria en ninguna circunstancia").
const NO_TRAVEL = ["siria", "yemen", "afganistán", "afganistan", "libia", "somalia", "sudán", "sudan", "sudán del sur", "mali", "malí", "burkina faso", "níger", "niger"];

const norm = (s: string) => s.trim().toLowerCase();

/** Validates a risk block and applies the official "no viajar" floor. */
export function normalizeRisk(raw: unknown, fallbackCountries: string[] = []): TripRisk | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const countries = [...new Set([...(Array.isArray(r.countries) ? r.countries : []), ...fallbackCountries]
    .filter((c): c is string => typeof c === "string" && c.trim().length > 1).map((c) => c.trim().slice(0, 40)))].slice(0, 8);
  let level = Math.round(Number(r.level)) as TripRisk["level"];
  if (!(level >= 1 && level <= 4)) level = 2;
  const points = (Array.isArray(r.points) ? r.points : []).filter((p): p is string => typeof p === "string" && !!p.trim()).map((p) => p.trim().slice(0, 220)).slice(0, 5);
  let summary = typeof r.summary === "string" ? r.summary.trim().slice(0, 300) : "";
  if (countries.some((c) => NO_TRAVEL.includes(norm(c))) && level < 4) {
    level = 4;
    summary = `El Ministerio de Asuntos Exteriores recomienda no viajar a ${countries.filter((c) => NO_TRAVEL.includes(norm(c))).join(" ni a ")}. ${summary}`.trim();
  }
  if (!summary) summary = RISK_LABEL[level];
  return { level, summary, points, countries };
}

/** Spain's official travel advice page for a country (in Spanish). */
export const officialAdviceUrl = (country: string) =>
  `https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Detalle-recomendaciones-de-viaje.aspx?trc=${encodeURIComponent(country)}`;
