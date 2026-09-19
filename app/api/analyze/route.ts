import { NextResponse } from "next/server";
import { detectPlatform, readVideo, type VideoContext } from "@/lib/video";
import { buildUserContent, extractRoute, refineCoordinates, ExtractError } from "@/lib/extract";
import { allow } from "@/lib/rateLimit";
import type { AnalyzeErrorCode, AnalyzeResponse, AnalyzeSources } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(status: number, code: AnalyzeErrorCode, message: string) {
  return NextResponse.json<AnalyzeResponse>({ ok: false, code, message }, { status });
}

export async function POST(req: Request) {
  let body: { url?: unknown; text?: unknown };
  try { body = await req.json(); } catch { return fail(400, "bad_request", "Petición no válida."); }

  const url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : "";
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!url && text.length < 12) return fail(400, "bad_request", "Pega un enlace o describe el vídeo.");
  if (url && !detectPlatform(url)) return fail(400, "unsupported_link", "Ese enlace no es de TikTok ni de Instagram.");

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
  if (!allow(ip)) return fail(429, "rate_limited", "Has hecho muchos análisis seguidos. Prueba de nuevo en unos minutos.");

  let ctx: Partial<VideoContext> = {};
  if (url) ctx = await readVideo(url);

  const fromVideo = Boolean(ctx.caption || ctx.placeTag || ctx.subtitles || ctx.audioTranscript);
  if (!fromVideo && !text) {
    return fail(422, "need_text",
      ctx.platform === "instagram"
        ? "Instagram no deja leer este vídeo desde fuera. Pega su descripción o escribe los sitios que salen."
        : "No he podido leer este vídeo (puede ser privado o estar bloqueado). Pega su descripción o escribe los sitios que salen.");
  }

  const sources: AnalyzeSources = {
    caption: Boolean(ctx.caption), placeTag: Boolean(ctx.placeTag), subtitles: Boolean(ctx.subtitles),
    audio: Boolean(ctx.audioTranscript), userText: Boolean(text),
  };

  try {
    const content = buildUserContent({ ...ctx, userText: text || undefined });
    const route = await refineCoordinates(await extractRoute(content, ctx.url || url || null));
    return NextResponse.json<AnalyzeResponse>({ ok: true, route: { ...route, sources }, sources });
  } catch (e) {
    if (e instanceof ExtractError) {
      if (e.code === "no_places") {
        // Only the caption was available: let the person add detail instead of failing flat.
        return fail(422, fromVideo && !text ? "need_text" : "no_places",
          fromVideo && !text ? "La descripción del vídeo no nombra lugares concretos. Escribe los sitios que salen en él." : e.message);
      }
      if (e.code === "not_configured") return fail(500, "not_configured", "El servidor no tiene configurada la clave de la IA (ANTHROPIC_API_KEY).");
      console.error("[analyze]", e.message);
      return fail(502, "upstream", "La IA no ha respondido bien. Vuelve a intentarlo.");
    }
    console.error("[analyze]", e);
    return fail(500, "upstream", "Algo ha fallado en el servidor. Vuelve a intentarlo.");
  }
}
