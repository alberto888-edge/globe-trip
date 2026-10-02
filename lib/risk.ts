// Travel-risk helpers shared by the server (to validate what Claude says) and the app (to show it).
import type { TripRisk } from "./types";

export const RISK_LABEL: Record<TripRisk["level"], string> = {
  1: "Riesgo bajo",
  2: "Precaución",
  3: "Evita algunas zonas",
  4: "No viajar",
};
const RISK_LABEL_EN: Record<TripRisk["level"], string> = {
  1: "Low risk",
  2: "Take care",
  3: "Avoid some areas",
  4: "Do not travel",
};
export const riskLabel = (level: TripRisk["level"], lang: "es" | "en" = "es") => (lang === "en" ? RISK_LABEL_EN : RISK_LABEL)[level];

// Countries where Spain's Foreign Office advises against all travel. A floor for the
// level Claude gives, because its knowledge may lag behind the news. Checked for
// Siria on 20 Sep 2026 ("Se recomienda NO viajar a Siria en ninguna circunstancia").
const NO_TRAVEL = ["siria", "yemen", "afganistán", "afganistan", "libia", "somalia", "sudán", "sudan", "sudán del sur", "mali", "malí", "burkina faso", "níger", "niger",
  "syria", "afghanistan", "libya", "south sudan"];

const norm = (s: string) => s.trim().toLowerCase();

/** Validates a risk block and applies the official "no viajar" floor. */
export function normalizeRisk(raw: unknown, fallbackCountries: string[] = [], lang: "es" | "en" = "es"): TripRisk | undefined {
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
    const banned = countries.filter((c) => NO_TRAVEL.includes(norm(c)));
    summary = (lang === "en"
      ? `Official travel advice is against all travel to ${banned.join(" or ")}. ${summary}`
      : `El Ministerio de Asuntos Exteriores recomienda no viajar a ${banned.join(" ni a ")}. ${summary}`).trim();
  }
  if (!summary) summary = riskLabel(level, lang);
  return { level, summary, points, countries };
}

/** Official travel advice for a country: Spain's Foreign Ministry in Spanish, the UK Foreign Office in English. */
export const officialAdviceUrl = (country: string, lang: "es" | "en" = "es") =>
  lang === "en"
    ? `https://www.gov.uk/foreign-travel-advice/${country.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
    : `https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Detalle-recomendaciones-de-viaje.aspx?trc=${encodeURIComponent(country)}`;
