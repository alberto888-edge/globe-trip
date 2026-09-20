import { NextResponse } from "next/server";
import { planTrip, refineWithMapbox, ExtractError } from "@/lib/extract";
import { allow } from "@/lib/rateLimit";
import type { AnalyzeErrorCode, BudgetLevel, PlanRequest, PlanResponse, TravelerLevel } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(status: number, code: AnalyzeErrorCode, message: string) {
  return NextResponse.json<PlanResponse>({ ok: false, code, message }, { status });
}

const LEVELS: BudgetLevel[] = ["mochilero", "medio", "alto"];
const TRAVELER: TravelerLevel[] = ["primera", "intermedio", "experto"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail(400, "bad_request", "Petición no válida."); }

  const plan: PlanRequest = {
    destination: str(b.destination, 120) || undefined,
    theme: str(b.theme, 80) || undefined,
    days: Number(b.days) > 0 ? Math.max(1, Math.min(30, Math.round(Number(b.days)))) : undefined,
    styles: Array.isArray(b.styles) ? b.styles.map((x) => str(x, 40)).filter(Boolean).slice(0, 6) : undefined,
    level: TRAVELER.includes(b.level as TravelerLevel) ? (b.level as TravelerLevel) : undefined,
    multiCountry: b.multiCountry === true,
    context: str(b.context, 400) || undefined,
    travelers: Math.max(1, Math.min(10, Math.round(Number(b.travelers) || 2))),
    budget: LEVELS.includes(b.budget as BudgetLevel) ? (b.budget as BudgetLevel) : "medio",
    budgetAmount: Number(b.budgetAmount) > 0 ? Math.min(100000, Math.round(Number(b.budgetAmount))) : undefined,
    origin: str(b.origin, 80) || undefined,
  };
  if (!plan.destination && !plan.theme) return fail(400, "bad_request", "Elige un destino o un tipo de viaje.");

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  if (!allow(ip)) return fail(429, "rate_limited", "Has hecho muchas peticiones seguidas. Prueba de nuevo en unos minutos.");

  try {
    const route = await planTrip(plan);
    route.stops = await Promise.all(route.stops.map(refineWithMapbox));
    return NextResponse.json<PlanResponse>({ ok: true, route });
  } catch (e) {
    if (e instanceof ExtractError) {
      if (e.code === "no_places") return fail(422, "no_places", e.message);
      if (e.code === "not_configured") return fail(500, "not_configured", "El servidor no tiene configurada la clave de la IA (ANTHROPIC_API_KEY).");
      console.error("[plan]", e.message);
      return fail(502, "upstream", "La IA no ha respondido bien. Vuelve a intentarlo.");
    }
    console.error("[plan]", e);
    return fail(500, "upstream", "Algo ha fallado en el servidor. Vuelve a intentarlo.");
  }
}
