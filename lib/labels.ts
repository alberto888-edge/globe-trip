// Country and city names: which to draw on the globe for the current view (big
// countries from far away, then capitals and big cities, then towns when you're
// right on top of them), and search by name with flags.
import data from "./places.json";
import { distanceKm, type LatLng } from "./geo";
import { currentLang } from "./lang";

export interface PlaceLabel { id: string; kind: "country" | "city"; name: string; alt?: string; lat: number; lng: number; tier: number; iso: string }
// n = Spanish name, e = English name when different.
type Raw = { n: string; e?: string; lat: number; lng: number; t: number; c: string; b?: string[] };

// The name in the language being shown, and the other one so search finds both.
const EN = currentLang() === "en";
const named = (c: Raw) => (EN ? { name: c.e || c.n, ...(c.e ? { alt: c.n } : {}) } : { name: c.n, ...(c.e ? { alt: c.e } : {}) });

// Built once so the globe can keep the same DOM element for the same label.
const COUNTRIES: PlaceLabel[] = (data.countries as Raw[])
  .map((c, i) => ({ id: `c${i}`, kind: "country", ...named(c), lat: c.lat, lng: c.lng, tier: c.t, iso: c.c }));
const CITIES: PlaceLabel[] = (data.cities as Raw[])
  .map((c, i) => ({ id: `p${i}`, kind: "city", ...named(c), lat: c.lat, lng: c.lng, tier: c.t, iso: c.c }));

const COUNTRY_BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
const LAND_NEIGHBOURS = new Map((data.countries as Raw[]).map((c) => [c.c, c.b || []]));
export const countryName = (iso?: string) => (iso && COUNTRY_BY_ISO.get(iso)?.name) || "";
export const countryByName = (name: string) => COUNTRIES.find((c) => norm(c.name) === norm(name) || (!!c.alt && norm(c.alt) === norm(name)));
export const countryByIso = (iso?: string) => (iso ? COUNTRY_BY_ISO.get(iso) : undefined);

/** 🇯🇵 from "JP". */
export const flag = (iso?: string) =>
  iso && /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "";

// Largest camera altitude (globe radii) at which each tier appears.
// Cities used to need a lot of zoom before any name showed up, which left the globe
// looking empty. The big ones now appear from almost as far out as countries; the
// small ones still wait, so the view never turns into a wall of text.
const SHOW = {
  country: { 1: 5, 2: 2.0, 3: 1.0 } as Record<number, number>,
  city: { 1: 2.6, 2: 1.5, 3: 0.72, 4: 0.3, 5: 0.12 } as Record<number, number>,
};
// Draw order when labels compete for space.
const PRIORITY = (l: PlaceLabel) => (l.kind === "country" ? [0, 0, 2, 5][l.tier] : [0, 1, 3, 4, 6, 7][l.tier]);
const byPriority = (a: PlaceLabel, b: PlaceLabel) => PRIORITY(a) - PRIORITY(b);

let SORTED = [...COUNTRIES, ...CITIES].sort(byPriority);
let ALL_CITIES = CITIES;

// Towns over ~50k people: loaded once after start-up (≈110 KB), for close zoom and search.
let more: Promise<boolean> | null = null;
export function loadMorePlaces(): Promise<boolean> {
  if (!more) {
    more = fetch("/cities.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Raw[]) => {
        const extra: PlaceLabel[] = list.map((c, i) => ({ id: `m${i}`, kind: "city", ...named(c), lat: c.lat, lng: c.lng, tier: c.t, iso: c.c }));
        ALL_CITIES = [...CITIES, ...extra];
        BY_ISO = null;
        SORTED = [...COUNTRIES, ...ALL_CITIES].sort(byPriority);
        return extra.length > 0;
      })
      .catch(() => false);
  }
  return more;
}

export function visibleLabels(center: { lat: number; lng: number }, altitude: number, max = 44): PlaceLabel[] {
  const capDeg = (Math.acos(1 / (1 + altitude)) * 180) / Math.PI;
  const radiusKm = Math.min(capDeg * 0.9, altitude * 30 + 2) * 111.19;
  const minGapKm = Math.max(0.08, altitude * 1.5) * 111.19; // rough pre-filter; the globe does exact on-screen spacing
  const out: PlaceLabel[] = [];
  for (const l of SORTED) {
    if (altitude > SHOW[l.kind][l.tier]) continue;
    if (distanceKm(center, l) > radiusKm) continue;
    if (out.some((o) => distanceKm(o, l) < minGapKm)) continue;
    out.push(l);
    if (out.length >= max) break;
  }
  return out;
}

// ---------------------------------------------------------------- search

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Countries first, then cities (bigger first); prefix matches beat matches inside a word. */
export function searchPlaces(query: string, limit = 7): PlaceLabel[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const at = (name: string) => {
    const n = norm(name);
    return n === q ? 0 : n.startsWith(q) ? 1 : n.split(/[\s\-'(]+/).some((w) => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : -1;
  };
  const score = (l: PlaceLabel) => {
    // Either language finds the place: "Kioto" and "Kyoto", "Londres" and "London".
    const own = at(l.name), other = l.alt ? at(l.alt) : -1;
    const where = own >= 0 && (other < 0 || own <= other) ? own : other;
    if (where < 0) return -1;
    return where * 10 + (l.kind === "country" ? 0 : 2 + l.tier);
  };
  const hits: { l: PlaceLabel; s: number }[] = [];
  for (const l of [...COUNTRIES, ...ALL_CITIES]) {
    const s = score(l);
    if (s >= 0) hits.push({ l, s });
  }
  hits.sort((a, b) => a.s - b.s || a.l.name.length - b.l.name.length);
  const seen = new Set<string>();
  return hits.map((h) => h.l).filter((l) => {
    const k = `${l.kind}|${norm(l.name)}|${l.iso}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, limit);
}

/** Best guess at a place from free text: "Río de Janeiro, Brasil", "Japón", "Kioto". */
export function resolvePlace(text: string): PlaceLabel | undefined {
  const parts = text.split(",").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return undefined;
  const iso = parts.length > 1 ? countryByName(parts[parts.length - 1])?.iso : undefined;
  const hits = searchPlaces(parts[0], 12);
  const exact = hits.filter((h) => norm(h.name) === norm(parts[0]));
  return (iso && (exact.find((h) => h.iso === iso) || hits.find((h) => h.iso === iso))) || exact[0] || hits[0];
}

// ---------------------------------------------------------------- countries as areas, not points

let BY_ISO: Map<string, PlaceLabel[]> | null = null;
function citiesOf(iso: string): PlaceLabel[] {
  if (!BY_ISO) {
    BY_ISO = new Map();
    for (const c of ALL_CITIES) {
      const l = BY_ISO.get(c.iso);
      if (l) l.push(c); else BY_ISO.set(c.iso, [c]);
    }
  }
  return BY_ISO.get(iso) || [];
}

/** Points that outline a country: its towns (thinned out for big countries) plus its centre. */
function outline(iso: string, max = 260): LatLng[] {
  const list = citiesOf(iso);
  const step = Math.max(1, Math.ceil(list.length / max));
  const pts: LatLng[] = list.filter((_, i) => i % step === 0);
  const c = COUNTRY_BY_ISO.get(iso);
  if (c) pts.push(c);
  return pts;
}

/** Rough distance from a point to a country (0 if it's inside, as far as its towns tell): km to its nearest town. */
export function kmToCountry(iso: string, p: LatLng): number {
  let best = Infinity;
  for (const x of outline(iso, 2000)) best = Math.min(best, distanceKm(x, p));
  return best;
}

// Cheap flat distance for bulk comparisons (good to a few % at these scales).
const flatKm = (a: LatLng, b: LatLng) => {
  const k = Math.PI / 180;
  let dLng = Math.abs(a.lng - b.lng);
  if (dLng > 180) dLng = 360 - dLng;
  const x = dLng * k * Math.cos(((a.lat + b.lat) / 2) * k), y = (a.lat - b.lat) * k;
  return Math.hypot(x, y) * 6371;
};

export interface NearCountry { iso: string; name: string; km: number; border: boolean }
const nearCache = new Map<string, NearCountry[]>();

/**
 * Countries to combine with `iso`: first the ones it shares a land border with, then the
 * closest across the sea, measured town to town (so Morocco counts as close to Spain even
 * though their centres are far apart). Within ~1.500 km, and a handful at least for islands.
 */
export function nearbyCountries(iso: string, max = 10): NearCountry[] {
  const key = `${iso}|${max}|${ALL_CITIES.length}`;
  const hit = nearCache.get(key);
  if (hit) return hit;
  const mine = outline(iso, Infinity);
  if (!mine.length) return [];
  const best = new Map<string, number>();
  const others = [...COUNTRIES, ...ALL_CITIES];
  for (const o of others) {
    if (o.iso === iso || !COUNTRY_BY_ISO.has(o.iso)) continue;
    const cur = best.get(o.iso) ?? Infinity;
    let d = Infinity;
    for (const m of mine) {
      // quick reject by latitude alone before the real maths
      if (Math.abs(m.lat - o.lat) * 111 >= Math.min(cur, d)) continue;
      d = Math.min(d, flatKm(m, o));
    }
    if (d < cur) best.set(o.iso, d);
  }
  const land = new Set(LAND_NEIGHBOURS.get(iso) || []);
  const all: NearCountry[] = [...best.entries()]
    .map(([i, km]) => ({ iso: i, name: countryName(i), km: land.has(i) ? 0 : Math.round(km), border: land.has(i) }))
    .sort((a, b) => Number(b.border) - Number(a.border) || a.km - b.km || (best.get(a.iso)! - best.get(b.iso)!));
  const close = all.filter((c) => c.border || c.km <= 1500);
  const out = (close.length >= 4 ? close : all.slice(0, 5)).slice(0, Math.max(max, land.size));
  nearCache.set(key, out);
  return out;
}
