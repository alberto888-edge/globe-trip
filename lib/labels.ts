// Which country and city names to draw on the globe for the current view:
// big countries from far away, capitals and big cities as you get closer,
// smaller and touristy places when you're right on top of them.
import data from "./places.json";
import { distanceKm } from "./geo";

export interface PlaceLabel { id: string; kind: "country" | "city"; name: string; lat: number; lng: number; tier: number }

// Built once so the globe can keep the same DOM element for the same label.
const COUNTRIES: PlaceLabel[] = (data.countries as { n: string; lat: number; lng: number; t: number }[])
  .map((c, i) => ({ id: `c${i}`, kind: "country", name: c.n, lat: c.lat, lng: c.lng, tier: c.t }));
const CITIES: PlaceLabel[] = (data.cities as { n: string; lat: number; lng: number; t: number }[])
  .map((c, i) => ({ id: `p${i}`, kind: "city", name: c.n, lat: c.lat, lng: c.lng, tier: c.t }));

// Largest camera altitude (globe radii) at which each tier appears.
const SHOW = {
  country: { 1: 5, 2: 2.0, 3: 1.0 } as Record<number, number>,
  city: { 1: 1.3, 2: 0.75, 3: 0.4 } as Record<number, number>,
};
// Draw order when labels compete for space.
const PRIORITY = (l: PlaceLabel) => (l.kind === "country" ? [0, 0, 2, 5][l.tier] : [0, 1, 3, 4][l.tier]);

const SORTED = [...COUNTRIES, ...CITIES].sort((a, b) => PRIORITY(a) - PRIORITY(b));

export function visibleLabels(center: { lat: number; lng: number }, altitude: number, max = 40): PlaceLabel[] {
  const capDeg = (Math.acos(1 / (1 + altitude)) * 180) / Math.PI;
  const radiusKm = Math.min(capDeg * 0.9, altitude * 30 + 2) * 111.19;
  const minGapKm = Math.max(0.2, altitude * 4.5) * 111.19;
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
