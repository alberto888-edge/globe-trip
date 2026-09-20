import type { Candidate, Route, Stop } from "./types";

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

/** Builds a route from the places the person kept, in the video's order. */
export function routeFromCandidates(name: string, picked: Candidate[], source: string | null, sources?: Route["sources"]): Route {
  const stops: Stop[] = withDayRanges(picked).map((c) => ({
    name: c.name, country: c.country, sub: c.sub, note: c.note, lat: c.lat, lng: c.lng, days: c.days, wiki: c.wiki, when: c.when,
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
  };
}
