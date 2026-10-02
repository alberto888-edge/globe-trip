// Picks a place's photo and blurb from Wikipedia. Pure (fetch is passed in), so it can be
// measured against the live service outside the browser; lib/wiki.ts adds the caching.
//
// Three rules, each from a case Alberto saw in the app:
// 1. Only real photographs. Maps, flags, coats of arms and diagrams are PNG or SVG files;
//    photos are JPEG. The file name alone missed maps called e.g. "LuangPrabang.png".
//    When an article's lead picture is not a photo, look through the article's other
//    pictures. Never fall back to a non-photo: no picture beats a map.
// 2. The right place. A search can land on a nearby but different place (a waterfall's
//    query landing on the town next to it). If both have coordinates and they are far
//    apart, that article is skipped.
// 3. No repeats. Two stops of one trip never show the same photo (see `claimed`).

export interface PlaceInfo { image?: string; imageLarge?: string; thumb?: string; extract?: string; url?: string; title?: string }
export interface PlaceQuery { name: string; wiki?: string; country?: string; lat?: number; lng?: number }
type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<any> }>;

// Wikimedia only renders thumbnails at standard widths (330, 500, 960, 1280…).
const sized = (thumb: string, w: number) => thumb.replace(/\/\d+px-/, `/${w}px-`);

const NOT_A_PHOTO = /\b(map|mapa|karte|carte|locator|location|localizaci|situaci|flag|bandera|escudo|coat[_ ]of[_ ]arms|seal|emblem|relief|orthographic|topographic|logo|plan|plano|diagram|diagrama|chart|grafico|gráfico|stamp|sello)\b/i;

/** File name of a Wikimedia URL (thumbnail or original), decoded, spaces for underscores. */
export function fileOf(url: string): string {
  const parts = decodeURIComponent(url).split("/");
  // Thumbnails: .../thumb/a/ab/File.jpg/500px-File.jpg → the original name is the one before.
  const i = parts.indexOf("thumb");
  const name = i >= 0 && parts.length > i + 3 ? parts[i + 3] : parts[parts.length - 1];
  return name.replace(/[_-]/g, " ");
}

/** A photograph of a place, judging by its file: JPEG, and not named like a map or a symbol. */
export function isPhoto(url?: string): boolean {
  if (!url) return false;
  const f = fileOf(url);
  return /\.jpe?g$/i.test(f) && !NOT_A_PHOTO.test(f);
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface Article { title: string; extract?: string; url?: string; thumb?: string; coords?: { lat: number; lng: number }; lang: string }

async function summary(get: Fetch, lang: string, title: string): Promise<Article | null> {
  const res = await get(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);
  if (!res.ok) return null;
  const j = await res.json();
  if (j.type === "disambiguation") return null;
  return {
    title: j.title, lang, extract: j.extract,
    url: j.content_urls?.mobile?.page || j.content_urls?.desktop?.page,
    thumb: j.thumbnail?.source || j.originalimage?.source,
    coords: j.coordinates ? { lat: j.coordinates.lat, lng: j.coordinates.lon } : undefined,
  };
}

async function search(get: Fetch, lang: string, q: string): Promise<string | null> {
  const res = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=5&format=json&origin=*`);
  if (!res.ok) return null;
  // skip airports, stations and the like that share the place's name
  const hits: { title: string }[] = (await res.json()).query?.search ?? [];
  return hits.find((h) => !/^(Aeropuerto|Airport|Estación|Station|Anexo|Estadio|Club|Batalla|Battle)\b/i.test(h.title))?.title ?? null;
}

/** The article's own pictures, in page order: a photo further down when the lead one is a map. */
async function articlePhotos(get: Fetch, a: Article): Promise<string[]> {
  const res = await get(`https://${a.lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(a.title.replace(/ /g, "_"))}`);
  if (!res.ok) return [];
  const items: any[] = (await res.json()).items ?? [];
  const out: string[] = [];
  for (const it of items) {
    if (it.type !== "image") continue;
    const src: string | undefined = (it.srcset as { src: string; scale: string }[] | undefined)?.find((s) => s.scale === "1x")?.src || it.srcset?.[0]?.src;
    if (!src) continue;
    const url = src.startsWith("//") ? `https:${src}` : src;
    if (isPhoto(url)) out.push(url);
    if (out.length >= 4) break;
  }
  return out;
}

const asInfo = (a: Article, photo?: string): PlaceInfo => {
  const steps = !!photo && /\/\d+px-/.test(photo);
  return {
    title: a.title, extract: a.extract, url: a.url, thumb: photo,
    image: photo ? (steps ? sized(photo, 500) : photo) : undefined,
    imageLarge: photo ? (steps ? sized(photo, 960) : photo) : undefined,
  };
};

/**
 * Max distance between the place and an article's coordinates for it to count as the same
 * place. An article titled exactly like the place gets room for big places (an island, a
 * region); one that came from a search must be close: Kuang Si's falls are 29 km from
 * Luang Prabang, and a search for the falls landing on the town gave the town's photo.
 */
const EXACT_KM = 80;
const SEARCH_KM = 15;

/**
 * `claimed` maps a photo's file to the place that showed it first; another place
 * can't take it. Pass the same map for every place of a page.
 */
export async function lookupPlace(q: PlaceQuery, get: Fetch, claimed?: Map<string, string>, me = q.wiki || q.name): Promise<PlaceInfo | null> {
  const where = [q.name, q.country].filter(Boolean).join(" ");
  const attempts: [exact: boolean, run: () => Promise<Article | null>][] = [
    [true, () => (q.wiki ? summary(get, "es", q.wiki) : Promise.resolve(null))],
    [true, () => summary(get, "es", q.name)],
    [false, async () => { const t = await search(get, "es", where); return t ? summary(get, "es", t) : null; }],
    [true, () => summary(get, "en", q.name)],
    [false, async () => { const t = await search(get, "en", where); return t ? summary(get, "en", t) : null; }],
  ];
  const free = (url: string) => {
    const f = fileOf(url), owner = claimed?.get(f);
    return !owner || owner === me;
  };
  const claim = (url: string) => claimed?.set(fileOf(url), me);
  const tried = new Set<string>();
  let text: Article | null = null;
  for (const [exact, attempt] of attempts) {
    const a = await attempt().catch(() => null);
    if (!a || tried.has(`${a.lang}:${a.title}`)) continue;
    tried.add(`${a.lang}:${a.title}`);
    // A different place that happens to come up in the search.
    if (q.lat !== undefined && q.lng !== undefined && a.coords && km({ lat: q.lat, lng: q.lng }, a.coords) > (exact ? EXACT_KM : SEARCH_KM)) continue;
    if (!text && a.extract) text = a;
    let photo = isPhoto(a.thumb) && free(a.thumb!) ? a.thumb : undefined;
    if (!photo) photo = (await articlePhotos(get, a).catch(() => [])).find(free);
    if (photo) {
      claim(photo);
      return { ...asInfo(text || a, photo) };
    }
  }
  return text ? asInfo(text) : null;
}
