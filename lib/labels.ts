// Country and city names: which to draw on the globe for the current view (big
// countries from far away, then capitals and big cities, then towns when you're
// right on top of them), and search by name with flags.
import data from "./places.json";
import { distanceKm } from "./geo";

export interface PlaceLabel { id: string; kind: "country" | "city"; name: string; lat: number; lng: number; tier: number; iso: string }
type Raw = { n: string; lat: number; lng: number; t: number; c: string };

// Built once so the globe can keep the same DOM element for the same label.
const COUNTRIES: PlaceLabel[] = (data.countries as Raw[])
  .map((c, i) => ({ id: `c${i}`, kind: "country", name: c.n, lat: c.lat, lng: c.lng, tier: c.t, iso: c.c }));
const CITIES: PlaceLabel[] = (data.cities as Raw[])
  .map((c, i) => ({ id: `p${i}`, kind: "city", name: c.n, lat: c.lat, lng: c.lng, tier: c.t, iso: c.c }));

const COUNTRY_BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));
export const countryName = (iso?: string) => (iso && COUNTRY_BY_ISO.get(iso)?.name) || "";
export const countryByName = (name: string) => COUNTRIES.find((c) => norm(c.name) === norm(name));

/** 🇯🇵 from "JP". */
export const flag = (iso?: string) =>
  iso && /^[A-Z]{2}$/.test(iso) ? String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "";

// Largest camera altitude (globe radii) at which each tier appears.
const SHOW = {
  country: { 1: 5, 2: 2.0, 3: 1.0 } as Record<number, number>,
  city: { 1: 1.3, 2: 0.75, 3: 0.4, 4: 0.2, 5: 0.09 } as Record<number, number>,
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
        const extra: PlaceLabel[] = list.map((c, i) => ({ id: `m${i}`, kind: "city", name: c.n, lat: c.lat, lng: c.lng, tier: c.t, iso: c.c }));
        ALL_CITIES = [...CITIES, ...extra];
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
  const score = (l: PlaceLabel) => {
    const n = norm(l.name);
    const where = n === q ? 0 : n.startsWith(q) ? 1 : n.split(/[\s\-'(]+/).some((w) => w.startsWith(q)) ? 2 : n.includes(q) ? 3 : -1;
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
