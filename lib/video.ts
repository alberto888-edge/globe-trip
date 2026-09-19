// Reads what a TikTok or Instagram link says about itself: caption, tagged
// place, auto-captions and (optionally) the audio, so the extractor has real
// text to work from. Every source is best-effort: platforms change their
// markup often, so each step fails soft and the caller decides what is enough.

import { detectPlatform, toUrl, type Platform } from "./links";
export { detectPlatform, toUrl, type Platform };

export interface VideoContext {
  platform: Platform;
  url: string;
  author?: string;
  caption?: string;
  placeTag?: string;
  subtitles?: string;
  audioTranscript?: string;
}

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const PREVIEW_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

async function fetchText(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), init.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, redirect: "follow" });
    return { res, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------- TikTok

/** Pulls the video's JSON blob out of the TikTok page. Exported for tests. */
export function parseTikTokPage(html: string) {
  const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data: any;
  try { data = JSON.parse(m[1]); } catch { return null; }
  const item = data?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (!item) return null;
  const poi = item.poi || item.poiInfo;
  const placeTag = poi
    ? [poi.name, poi.city, poi.province, poi.country ?? poi.cityCode].filter(Boolean).join(", ")
    : undefined;
  const subs: any[] = item.video?.subtitleInfos || [];
  const pick =
    subs.find((s) => /^(es|spa)\b|^(es|spa)[-_]/i.test(s.LanguageCodeName || "")) ||
    subs.find((s) => /^(en|eng)\b|^(en|eng)[-_]/i.test(s.LanguageCodeName || "")) ||
    subs[0];
  return {
    caption: typeof item.desc === "string" ? item.desc : undefined,
    author: item.author?.uniqueId as string | undefined,
    placeTag: placeTag || undefined,
    subtitleUrl: (pick?.Url as string) || undefined,
    videoUrl: (item.video?.playAddr || item.video?.downloadAddr) as string | undefined,
  };
}

/** WebVTT → plain text, dropping cue numbers, timings and repeated lines. */
export function vttToText(vtt: string): string {
  const out: string[] = [];
  for (const line of vtt.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l === "WEBVTT" || /^\d+$/.test(l) || l.includes("-->") || /^(NOTE|STYLE|Kind:|Language:)/.test(l)) continue;
    const clean = l.replace(/<[^>]+>/g, "");
    if (clean && clean !== out[out.length - 1]) out.push(clean);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function cookieHeader(res: Response): string {
  const raw = (res.headers as any).getSetCookie?.() as string[] | undefined;
  return (raw || []).map((c) => c.split(";")[0]).join("; ");
}

async function readTikTok(url: string): Promise<VideoContext & { _videoUrl?: string; _cookies?: string }> {
  const ctx: VideoContext & { _videoUrl?: string; _cookies?: string } = { platform: "tiktok", url };

  // 1. Page: resolves short links (vm./vt.) and carries caption, place tag and subtitles.
  try {
    const { res, text } = await fetchText(url, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" },
    });
    ctx.url = res.url || url;
    const parsed = parseTikTokPage(text);
    const cookies = cookieHeader(res);
    if (parsed) {
      ctx.caption = parsed.caption;
      ctx.author = parsed.author;
      ctx.placeTag = parsed.placeTag;
      ctx._videoUrl = parsed.videoUrl;
      ctx._cookies = cookies;
      if (parsed.subtitleUrl) {
        try {
          const sub = await fetchText(parsed.subtitleUrl, { headers: { "User-Agent": BROWSER_UA, Cookie: cookies, Referer: "https://www.tiktok.com/" } });
          if (sub.res.ok) ctx.subtitles = vttToText(sub.text).slice(0, 6000) || undefined;
        } catch { /* subtitles are a bonus */ }
      }
    }
  } catch { /* fall through to oEmbed */ }

  // 2. oEmbed: official and stable, gives the caption when the page is blocked.
  if (!ctx.caption) {
    try {
      const { res, text } = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(ctx.url)}`);
      if (res.ok) {
        const j = JSON.parse(text);
        ctx.caption = j.title || undefined;
        ctx.author = ctx.author || j.author_unique_id || j.author_name;
      }
    } catch { /* ignore */ }
  }
  return ctx;
}

// ---------------------------------------------------------------- Instagram

/** Instagram serves the caption in og: tags to link-preview crawlers. Exported for tests. */
export function parseInstagramPage(html: string) {
  const meta = (prop: string) => {
    const re = new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, "i");
    const alt = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, "i");
    return decodeEntities((html.match(re) || html.match(alt) || [])[1] || "");
  };
  const desc = meta("og:description") || meta("description");
  const title = meta("og:title");
  // "1.234 likes, 56 comments - user on March 3, 2025: "caption…"."
  const quoted = desc.match(/:\s*["“](.*)["”]\.?\s*$/s);
  const caption = (quoted ? quoted[1] : desc).trim();
  const author = (desc.match(/-\s*([\w.]+)\s+(?:on|el)\s/) || title.match(/^(.+?)\s+(?:on|en)\s+Instagram/i) || [])[1];
  return { caption: caption || undefined, author: author || undefined };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

async function readInstagram(url: string): Promise<VideoContext> {
  const ctx: VideoContext = { platform: "instagram", url };
  try {
    const { res, text } = await fetchText(url, { headers: { "User-Agent": PREVIEW_UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" } });
    ctx.url = res.url || url;
    const parsed = parseInstagramPage(text);
    ctx.caption = parsed.caption;
    ctx.author = parsed.author;
  } catch { /* ignore */ }
  return ctx;
}

// ---------------------------------------------------------------- audio (optional)

/** Transcribes the video's audio with OpenAI when a key is configured. */
async function transcribeAudio(videoUrl: string, cookies?: string): Promise<string | undefined> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return undefined;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const vid = await fetch(videoUrl, {
      signal: ctl.signal,
      headers: { "User-Agent": BROWSER_UA, Referer: "https://www.tiktok.com/", ...(cookies ? { Cookie: cookies } : {}) },
    });
    if (!vid.ok) return undefined;
    const len = Number(vid.headers.get("content-length") || 0);
    if (len > 24 * 1024 * 1024) return undefined; // API upload cap
    const blob = await vid.blob();
    if (blob.size > 24 * 1024 * 1024 || blob.size < 1000) return undefined;
    const form = new FormData();
    form.append("file", new File([blob], "video.mp4", { type: "video/mp4" }));
    form.append("model", "gpt-4o-mini-transcribe");
    const tr = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", signal: ctl.signal, headers: { Authorization: `Bearer ${key}` }, body: form,
    });
    if (!tr.ok) return undefined;
    const j = await tr.json();
    return (j.text as string | undefined)?.slice(0, 6000);
  } catch {
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

export async function readVideo(rawUrl: string): Promise<VideoContext> {
  const platform = detectPlatform(rawUrl);
  const url = toUrl(rawUrl)!.toString();
  if (platform === "tiktok") {
    const ctx = await readTikTok(url);
    if (!ctx.subtitles && ctx._videoUrl) ctx.audioTranscript = await transcribeAudio(ctx._videoUrl, ctx._cookies);
    const { _videoUrl, _cookies, ...clean } = ctx;
    return clean;
  }
  return readInstagram(url);
}
