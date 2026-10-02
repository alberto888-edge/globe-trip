import type { Candidate, Route, Stop } from "./types";
import { bestInsertIndex, orderStops } from "./geo";

/** "Día 3" or "Días 3–5" for each stop, from each stop's length in days. */
export function withDayRanges<T extends { days?: number }>(stops: T[]): (T & { when: string })[] {
  let day = 1;
  return stops.map((s) => {
    const n = Math.max(1, Math.round(s.days || 1));
    const when = n === 1 ? `Día ${day}` : `Días ${day}–${day + n - 1}`;
    day += n;
    return { ...s, days: n, when };
  });
}

/** Builds a route from the places the person kept: the video's order, unless that zig-zags. */
export function routeFromCandidates(name: string, picked: Candidate[], source: string | null, sources?: Route["sources"], risks?: Route["risks"]): Route {
  const stops: Stop[] = withDayRanges(orderStops(picked)).map((c) => ({
    name: c.name, country: c.country, sub: c.sub, note: c.note, lat: c.lat, lng: c.lng, days: c.days, wiki: c.wiki, when: c.when,
    ...(c.spots?.length ? { spots: c.spots } : {}),
  }));
  return {
    id: `v${Date.now().toString(36)}`,
    name,
    days: stops.reduce((a, s) => a + (s.days || 1), 0),
    stops,
    kind: "video",
    ai: true,
    source,
    sources,
    risks,
  };
}

/** Days a stop lasts, from its own count or its label ("Días 3–5" = 3). */
export function stopDays(s: { days?: number; when?: string }): number {
  if (s.days) return Math.max(1, Math.round(s.days));
  const m = s.when?.match(/(\d+)\s*[–-]\s*(\d+)/);
  return m ? Math.max(1, Number(m[2]) - Number(m[1]) + 1) : 1;
}

function retime(route: Route, stops: Stop[]): Route {
  const ranged = withDayRanges(stops.map((s) => ({ ...s, days: stopDays(s) })));
  return { ...route, stops: ranged, days: ranged.reduce((a, s) => a + (s.days || 1), 0), edited: true };
}

/** Adds a stop where it makes the fewest extra km, and shifts the days after it. */
export function addStop(route: Route, stop: Omit<Stop, "when">): { route: Route; at: number } {
  const at = bestInsertIndex(route.stops, stop);
  const stops = [...route.stops.slice(0, at), { ...stop, when: "", added: true }, ...route.stops.slice(at)];
  return { route: retime(route, stops), at };
}

export function removeStop(route: Route, index: number): Route {
  return retime(route, route.stops.filter((_, i) => i !== index));
}
