import { NextResponse } from "next/server";
import { suggestActivities, ExtractError } from "@/lib/extract";
import { allow } from "@/lib/rateLimit";
import type { ActivitiesRequest, ActivitiesResponse, AnalyzeErrorCode, TravelerLevel } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(status: number, code: AnalyzeErrorCode, message: string) {
  return NextResponse.json<ActivitiesResponse>({ ok: false, code, message }, { status });
}

// The same places asked again (same trip reopened, a ready-made trip) are free and instant.
const cache = new Map<string, { at: number; body: ActivitiesResponse }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

const TRAVELER: TravelerLevel[] = ["primera", "intermedio", "experto"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail(400, "bad_request", "Petición no válida / Invalid request."); }
  const lang = b.lang === "en" ? "en" : "es";
  const t = (es: string, en: string) => (lang === "es" ? es : en);

  const stops = (Array.isArray(b.stops) ? b.stops : []).slice(0, 10).map((s: any) => ({
    name: str(s?.name, 60),
    country: str(s?.country, 40) || undefined,
    days: Number(s?.days) > 0 ? Math.min(30, Math.round(Number(s.days))) : undefined,
    must: Array.isArray(s?.must) ? s.must.map((x: unknown) => str(x, 50)).filter(Boolean).slice(0, 6) : undefined,
  })).filter((s) => s.name);
  if (!stops.length) return fail(400, "bad_request", t("No hay paradas.", "No stops."));
  const body: ActivitiesRequest = {
    stops,
    styles: Array.isArray(b.styles) ? b.styles.map((x) => str(x, 40)).filter(Boolean).slice(0, 6) : undefined,
    level: TRAVELER.includes(b.level as TravelerLevel) ? (b.level as TravelerLevel) : undefined,
    lang,
  };

  const key = JSON.stringify(body).toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  if (!allow(ip)) return fail(429, "rate_limited", t("Has hecho muchas peticiones seguidas. Prueba de nuevo en unos minutos.", "Too many requests in a row. Try again in a few minutes."));

  try {
    const out: ActivitiesResponse = { ok: true, activities: await suggestActivities(body) };
    cache.set(key, { at: Date.now(), body: out });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof ExtractError) {
      if (e.code === "no_places") return fail(422, "no_places", e.message);
      if (e.code === "not_configured") return fail(500, "not_configured", t("El servidor no tiene configurada la clave de la IA (ANTHROPIC_API_KEY).", "The server has no AI key configured (ANTHROPIC_API_KEY)."));
      console.error("[activities]", e.message);
      return fail(502, "upstream", t("La IA no ha respondido bien. Vuelve a intentarlo.", "The AI didn't answer properly. Please try again."));
    }
    console.error("[activities]", e);
    return fail(500, "upstream", t("Algo ha fallado en el servidor. Vuelve a intentarlo.", "Something went wrong on the server. Please try again."));
  }
}
