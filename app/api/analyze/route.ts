import { NextResponse } from "next/server";
import { detectPlatform, readVideo, type VideoContext } from "@/lib/video";
import { extractCandidates, refineWithMapbox, ExtractError } from "@/lib/extract";
import { allow } from "@/lib/rateLimit";
import type { AnalyzeErrorCode, AnalyzeOk, AnalyzeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(status: number, code: AnalyzeErrorCode, message: string) {
  return NextResponse.json<AnalyzeResponse>({ ok: false, code, message }, { status });
}

// Same video pasted again (by anyone on this instance) is free and instant.
const cache = new Map<string, { at: number; body: AnalyzeOk }>();
const CACHE_MS = 6 * 60 * 60 * 1000;

export async function POST(req: Request) {
  let body: { url?: unknown; text?: unknown };
  try { body = await req.json(); } catch { return fail(400, "bad_request", "Petición no válida."); }

  const url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!url && text.length < 12) return fail(400, "bad_request", "Pega un enlace o escribe los sitios del vídeo.");
  if (url && !detectPlatform(url)) return fail(400, "unsupported_link", "Ese enlace no es de TikTok ni de Instagram.");

  const key = url && !text ? url.replace(/[?#].*$/, "") : "";
  const hit = key ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json<AnalyzeResponse>(hit.body);

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  if (!allow(ip)) return fail(429, "rate_limited", "Has hecho muchos análisis seguidos. Prueba de nuevo en unos minutos.");

  let ctx: Partial<VideoContext> = { images: [] };
  if (url) ctx = await readVideo(url);
  const images = ctx.images || [];
  const hasSomething = Boolean(ctx.caption || ctx.placeTag || ctx.subtitles || ctx.audioTranscript || images.length || text);
  if (!hasSomething) {
    return fail(422, "no_places", "No he podido abrir este vídeo. Puede que sea privado, que se haya borrado o que la plataforma lo esté bloqueando. Prueba con otro enlace.");
  }

  try {
    const { name, candidates, risks } = await extractCandidates({ ...ctx, userText: text || undefined }, images);
    const refined = await Promise.all(candidates.map(refineWithMapbox));
    const out: AnalyzeOk = {
      ok: true,
      name,
      candidates: refined,
      frames: images.map((i) => `data:image/jpeg;base64,${i.jpeg.toString("base64")}`),
      source: ctx.url || url || null,
      sources: {
        caption: Boolean(ctx.caption), placeTag: Boolean(ctx.placeTag), subtitles: Boolean(ctx.subtitles),
        audio: Boolean(ctx.audioTranscript), userText: Boolean(text), frames: images.length,
      },
      risks,
    };
    console.log("[analyze]", JSON.stringify({ url: key || null, ...out.sources, places: refined.length, scopes: refined.map((c) => c.scope) }));
    if (key) {
      cache.set(key, { at: Date.now(), body: out });
      if (cache.size > 300) cache.delete(cache.keys().next().value!);
    }
    return NextResponse.json<AnalyzeResponse>(out);
  } catch (e) {
    if (e instanceof ExtractError) {
      if (e.code === "no_places") return fail(422, "no_places", e.message);
      if (e.code === "not_configured") return fail(500, "not_configured", "El servidor no tiene configurada la clave de la IA (ANTHROPIC_API_KEY).");
      console.error("[analyze]", e.message);
      return fail(502, "upstream", "La IA no ha respondido bien. Vuelve a intentarlo.");
    }
    console.error("[analyze]", e);
    return fail(500, "upstream", "Algo ha fallado en el servidor. Vuelve a intentarlo.");
  }
}
