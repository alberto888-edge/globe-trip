// Reads what a TikTok or Instagram post contains: caption, tagged place,
// subtitles and — most importantly — pictures from the video itself, because
// travel videos name their places on screen, not in the caption.
// Every source is best-effort and fails soft; the extractor uses whatever arrived.
import { detectPlatform, toUrl, type Platform } from "./links";
import { framesFromVideo, normalizeImage } from "./frames";
export { detectPlatform, toUrl, type Platform };

export interface VideoImage { jpeg: Buffer; label: string }

export interface VideoContext {
  platform: Platform;
  url: string;
  author?: string;
  caption?: string;
  placeTag?: string;
  subtitles?: string;
  audioTranscript?: string;
  images: VideoImage[];
}

const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const PREVIEW_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
// Public TikTok resolver: returns caption, cover and a direct video/photo URL.
// Replaceable with any service that answers the same shape.
const TIKTOK_RESOLVER = process.env.TIKTOK_RESOLVER_URL || "https://www.tikwm.com/api/?hd=0&url=";
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const FRAME_COUNT = 8;

async function fetchText(url: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), init.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, redirect: init.redirect ?? "follow" });
    return { res, text: await res.text() };
  } finally {
    clearTimeout(t);
  }
}

async function fetchBuffer(url: string, opts: { timeoutMs?: number; maxBytes?: number; headers?: Record<string, string> } = {}): Promise<Buffer | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": BROWSER_UA, ...opts.headers } });
    if (!res.ok || !res.body) return null;
    const max = opts.maxBytes ?? MAX_VIDEO_BYTES;
    if (Number(res.headers.get("content-length") || 0) > max) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) { ctl.abort(); return null; }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------- TikTok

/** Follows vm.tiktok.com / vt.tiktok.com / tiktok.com/t/ share links to the canonical video URL. */
async function resolveShortLink(url: string): Promise<string> {
  let current = url;
  for (let i = 0; i < 4; i++) {
    const u = new URL(current);
    const short = /^(vm|vt)\.tiktok\.com$/.test(u.hostname) || u.pathname.startsWith("/t/");
    if (!short) break;
    try {
      const { res } = await fetchText(current, { redirect: "manual", headers: { "User-Agent": BROWSER_UA }, timeoutMs: 6000 });
      const loc = res.headers.get("location");
      if (!loc) break;
      current = new URL(loc, current).toString();
    } catch { break; }
  }
  // drop tracking params: https://www.tiktok.com/@user/video/123?_r=1&... → .../video/123
  const m = current.match(/^(https:\/\/(?:www\.)?tiktok\.com\/@[^/]+\/(?:video|photo)\/\d+)/);
  return m ? m[1] : current;
}

export interface TikwmData {
  caption?: string;
  author?: string;
  cover?: string;
  duration?: number;
  videoUrl?: string;
  imageUrls: string[];
}

/** Reads the resolver's JSON. Exported for tests. */
export function parseTikwm(json: any): TikwmData | null {
  if (!json || json.code !== 0 || !json.data) return null;
  const d = json.data;
  return {
    caption: typeof d.title === "string" && d.title.trim() ? d.title : undefined,
    author: d.author?.unique_id || undefined,
    cover: d.origin_cover || d.cover || undefined,
    duration: Number(d.duration) || undefined,
    videoUrl: d.play || d.wmplay || undefined,
    imageUrls: Array.isArray(d.images) ? d.images.filter((x: unknown) => typeof x === "string") : [],
  };
}

/** Pulls the video's JSON blob out of the TikTok page. Exported for tests. */
export function parseTikTokPage(html: string) {
  const m = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data: any;
  try { data = JSON.parse(m[1]); } catch { return null; }
  const item = data?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (!item) return null;
  const poi = item.poi || item.poiInfo;
  const placeTag = poi ? [poi.name, poi.city, poi.province, poi.country ?? poi.cityCode].filter(Boolean).join(", ") : undefined;
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

async function readTikTokPage(url: string) {
  try {
    const { res, text } = await fetchText(url, { headers: { "User-Agent": BROWSER_UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" }, timeoutMs: 7000 });
    const parsed = parseTikTokPage(text);
    if (!parsed) return null;
    let subtitles: string | undefined;
    const cookies = cookieHeader(res);
    if (parsed.subtitleUrl) {
      const sub = await fetchText(parsed.subtitleUrl, { headers: { "User-Agent": BROWSER_UA, Cookie: cookies, Referer: "https://www.tiktok.com/" } }).catch(() => null);
      if (sub?.res.ok) subtitles = vttToText(sub.text).slice(0, 6000) || undefined;
    }
    return { ...parsed, subtitles, cookies };
  } catch {
    return null;
  }
}

async function readTikwm(url: string): Promise<TikwmData | null> {
  try {
    const { res, text } = await fetchText(TIKTOK_RESOLVER + encodeURIComponent(url), { headers: { "User-Agent": BROWSER_UA }, timeoutMs: 10000 });
    return res.ok ? parseTikwm(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

async function readOEmbed(url: string) {
  try {
    const { res, text } = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { timeoutMs: 6000 });
    if (!res.ok) return null;
    const j = JSON.parse(text);
    return { caption: j.title as string | undefined, author: (j.author_unique_id || j.author_name) as string | undefined, cover: j.thumbnail_url as string | undefined };
  } catch {
    return null;
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

async function readTikTok(rawUrl: string): Promise<VideoContext> {
  const url = await resolveShortLink(rawUrl);
  const [tikwm, page] = await Promise.all([readTikwm(url), readTikTokPage(url)]);
  const oembed = !tikwm?.caption && !page?.caption ? await readOEmbed(url) : null;

  const ctx: VideoContext = {
    platform: "tiktok",
    url,
    caption: tikwm?.caption || page?.caption || oembed?.caption,
    author: tikwm?.author || page?.author || oembed?.author,
    placeTag: page?.placeTag,
    subtitles: page?.subtitles,
    images: [],
  };

  // Pictures: photo carousels as they are, videos as evenly spaced frames, else the cover.
  let video: Buffer | null = null;
  if (tikwm?.imageUrls.length) {
    const imgs = await Promise.all(tikwm.imageUrls.slice(0, FRAME_COUNT).map((u) => fetchBuffer(u, { maxBytes: 15 * 1024 * 1024, timeoutMs: 8000 })));
    for (const [i, b] of imgs.entries()) {
      const jpeg = b && (await normalizeImage(b));
      if (jpeg) ctx.images.push({ jpeg, label: `Foto ${i + 1} del carrusel` });
    }
  } else {
    const src = tikwm?.videoUrl || page?.videoUrl;
    if (src) video = await fetchBuffer(src, { timeoutMs: 20000, headers: page?.cookies && !tikwm?.videoUrl ? { Cookie: page.cookies, Referer: "https://www.tiktok.com/" } : {} });
    if (video) {
      const frames = await framesFromVideo(video, FRAME_COUNT, tikwm?.duration).catch(() => []);
      ctx.images = frames.map((f) => ({ jpeg: f.jpeg, label: `Fotograma en ${mmss(f.at)}` }));
    }
  }
  if (!ctx.images.length) {
    const cover = tikwm?.cover || oembed?.cover;
    const buf = cover ? await fetchBuffer(cover, { maxBytes: 8 * 1024 * 1024, timeoutMs: 6000 }) : null;
    const jpeg = buf && (await normalizeImage(buf));
    if (jpeg) ctx.images.push({ jpeg, label: "Portada del vídeo" });
  }

  if (!ctx.subtitles && video) ctx.audioTranscript = await transcribeAudio(video);
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
  const quoted = desc.match(/:\s*["“](.*)["”]\.?\s*$/s);
  const caption = (quoted ? quoted[1] : desc).trim();
  const author = (desc.match(/-\s*([\w.]+)\s+(?:on|el)\s/) || title.match(/^(.+?)\s+(?:on|en)\s+Instagram/i) || [])[1];
  return { caption: caption || undefined, author: author || undefined, image: meta("og:image") || undefined };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

async function readInstagram(url: string): Promise<VideoContext> {
  const ctx: VideoContext = { platform: "instagram", url, images: [] };
  try {
    const { res, text } = await fetchText(url, { headers: { "User-Agent": PREVIEW_UA, "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" } });
    ctx.url = res.url || url;
    const parsed = parseInstagramPage(text);
    ctx.caption = parsed.caption;
    ctx.author = parsed.author;
    if (parsed.image) {
      const buf = await fetchBuffer(parsed.image, { maxBytes: 8 * 1024 * 1024, timeoutMs: 6000 });
      const jpeg = buf && (await normalizeImage(buf));
      if (jpeg) ctx.images.push({ jpeg, label: "Portada de la publicación" });
    }
  } catch { /* ignore */ }
  return ctx;
}

// ---------------------------------------------------------------- audio (optional)

async function transcribeAudio(video: Buffer): Promise<string | undefined> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || video.length > 24 * 1024 * 1024) return undefined;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(video)], "video.mp4", { type: "video/mp4" }));
    form.append("model", "gpt-4o-mini-transcribe");
    const tr = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", signal: ctl.signal, headers: { Authorization: `Bearer ${key}` }, body: form,
    });
    if (!tr.ok) return undefined;
    return ((await tr.json()).text as string | undefined)?.slice(0, 6000);
  } catch {
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

export async function readVideo(rawUrl: string): Promise<VideoContext> {
  const platform = detectPlatform(rawUrl);
  const url = toUrl(rawUrl)!.toString();
  return platform === "tiktok" ? readTikTok(url) : readInstagram(url);
}
